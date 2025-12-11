import { Router, Request, Response } from "express";
import { anomalyDetectionService, MetricType, AnomalyThreshold } from "./anomaly-detection";
import { db } from "../db";
import { clientAnomalyThresholds, clients } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

async function verifyClientBelongsToAgency(clientId: string, agencyId: string): Promise<boolean> {
  const client = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.agencyId, agencyId)))
    .limit(1);
  return client.length > 0;
}

export const analyticsRouter = Router();

const thresholdSchema = z.object({
  metricType: z.enum(['sessions', 'conversions', 'clicks', 'impressions', 'organicClicks', 'organicImpressions', 'avgPosition', 'spend']),
  zScoreThreshold: z.number().min(1).max(5).optional().default(2.5),
  percentChangeThreshold: z.number().min(5).max(100).optional().default(30),
  minDataPoints: z.number().min(7).max(60).optional().default(14),
  enabled: z.boolean().optional().default(true),
});

analyticsRouter.get("/anomalies/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    const anomalies = await anomalyDetectionService.detectAnomaliesForClient(
      clientId,
      agencyId
    );

    const trueAnomalies = anomalies.filter(a => !a.isFalsePositive);
    const falsePositives = anomalies.filter(a => a.isFalsePositive);

    res.json({
      clientId,
      totalDetected: anomalies.length,
      trueAnomalies: trueAnomalies.length,
      falsePositives: falsePositives.length,
      anomalies: trueAnomalies,
      filteredOut: falsePositives,
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error detecting anomalies:", error);
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.get("/trends/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    const trends = await anomalyDetectionService.analyzeTrends(clientId);

    res.json({
      clientId,
      trends,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error analyzing trends:", error);
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.post("/anomalies/scan", async (req: Request, res: Response) => {
  try {
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const results = await anomalyDetectionService.runAnomalyDetectionForAgency(agencyId);

    const totalAnomalies = results.reduce((sum, r) => sum + r.anomalies.length, 0);
    const totalSignals = results.reduce((sum, r) => sum + r.signalsCreated, 0);

    res.json({
      agencyId,
      clientsScanned: results.length,
      totalAnomalies,
      totalSignalsCreated: totalSignals,
      results: results.map(r => ({
        clientId: r.clientId,
        anomaliesDetected: r.anomalies.length,
        signalsCreated: r.signalsCreated,
        anomalies: r.anomalies.filter(a => !a.isFalsePositive).map(a => ({
          id: a.id,
          metricType: a.metricType,
          anomalyType: a.anomalyType,
          severity: a.severity,
          percentChange: a.percentChange,
          confidence: a.confidence,
        })),
      })),
      scannedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error scanning for anomalies:", error);
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.post("/anomalies/:clientId/convert", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    const anomalies = await anomalyDetectionService.detectAnomaliesForClient(
      clientId,
      agencyId
    );

    const trueAnomalies = anomalies.filter(a => !a.isFalsePositive);
    const signalIds: string[] = [];
    
    for (const anomaly of trueAnomalies) {
      const signalId = await anomalyDetectionService.convertAnomalyToSignal(anomaly);
      if (signalId) {
        signalIds.push(signalId);
      }
    }

    res.json({
      clientId,
      anomaliesDetected: anomalies.length,
      falsePositivesFiltered: anomalies.length - trueAnomalies.length,
      signalsCreated: signalIds.length,
      signalIds,
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error converting anomalies to signals:", error);
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.get("/statistics/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    const historicalData = await anomalyDetectionService["getHistoricalMetrics"](clientId, 30);
    
    if (historicalData.length === 0) {
      return res.json({
        clientId,
        dataPoints: 0,
        message: "No historical data available",
      });
    }

    const metricTypes: MetricType[] = [
      'sessions', 'conversions', 'clicks', 'impressions',
      'organicClicks', 'organicImpressions', 'avgPosition'
    ];

    const statistics: Record<string, {
      mean: number;
      stdDev: number;
      min: number;
      max: number;
      dataPoints: number;
    }> = {};

    for (const metricType of metricTypes) {
      const values = historicalData.map(d => d.metrics[metricType]).filter(v => v !== undefined);
      
      if (values.length > 0) {
        const mean = anomalyDetectionService.calculateMean(values);
        const stdDev = anomalyDetectionService.calculateStdDev(values);
        
        statistics[metricType] = {
          mean: Math.round(mean * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          min: Math.min(...values),
          max: Math.max(...values),
          dataPoints: values.length,
        };
      }
    }

    res.json({
      clientId,
      period: {
        start: historicalData[historicalData.length - 1]?.date,
        end: historicalData[0]?.date,
        days: historicalData.length,
      },
      statistics,
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error fetching statistics:", error);
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.get("/thresholds/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    const thresholds = await db
      .select()
      .from(clientAnomalyThresholds)
      .where(eq(clientAnomalyThresholds.clientId, clientId));

    res.json({
      clientId,
      thresholds: thresholds.map(t => ({
        id: t.id,
        metricType: t.metricType,
        zScoreThreshold: parseFloat(t.zScoreThreshold || "2.5"),
        percentChangeThreshold: parseFloat(t.percentChangeThreshold || "30"),
        minDataPoints: t.minDataPoints || 14,
        enabled: t.enabled,
      })),
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error fetching thresholds:", error);
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.post("/thresholds/:clientId", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    const validated = thresholdSchema.parse(req.body);

    const existing = await db
      .select()
      .from(clientAnomalyThresholds)
      .where(and(
        eq(clientAnomalyThresholds.clientId, clientId),
        eq(clientAnomalyThresholds.metricType, validated.metricType)
      ));

    if (existing.length > 0) {
      const updated = await db
        .update(clientAnomalyThresholds)
        .set({
          zScoreThreshold: validated.zScoreThreshold.toString(),
          percentChangeThreshold: validated.percentChangeThreshold.toString(),
          minDataPoints: validated.minDataPoints,
          enabled: validated.enabled,
          updatedAt: new Date(),
        })
        .where(eq(clientAnomalyThresholds.id, existing[0].id))
        .returning();

      return res.json({
        message: "Threshold updated",
        threshold: updated[0],
      });
    }

    const created = await db
      .insert(clientAnomalyThresholds)
      .values({
        clientId,
        metricType: validated.metricType,
        zScoreThreshold: validated.zScoreThreshold.toString(),
        percentChangeThreshold: validated.percentChangeThreshold.toString(),
        minDataPoints: validated.minDataPoints,
        enabled: validated.enabled,
      })
      .returning();

    res.status(201).json({
      message: "Threshold created",
      threshold: created[0],
    });
  } catch (error: any) {
    console.error("[ANALYTICS] Error creating/updating threshold:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

analyticsRouter.delete("/thresholds/:clientId/:metricType", async (req: Request, res: Response) => {
  try {
    const { clientId, metricType } = req.params;
    const agencyId = (req as any).agencyId;
    
    if (!agencyId) {
      return res.status(400).json({ error: "Agency context required" });
    }

    const belongsToAgency = await verifyClientBelongsToAgency(clientId, agencyId);
    if (!belongsToAgency) {
      return res.status(403).json({ error: "Access denied: client does not belong to your agency" });
    }

    await db
      .delete(clientAnomalyThresholds)
      .where(and(
        eq(clientAnomalyThresholds.clientId, clientId),
        eq(clientAnomalyThresholds.metricType, metricType)
      ));

    res.json({ message: "Threshold deleted, defaults will be used" });
  } catch (error: any) {
    console.error("[ANALYTICS] Error deleting threshold:", error);
    res.status(500).json({ error: error.message });
  }
});
