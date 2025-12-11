import { createHash } from "crypto";
import { db } from "../db";
import { 
  dailyMetrics, 
  workflowSignals, 
  clients,
  agencySettings,
  clientAnomalyThresholds
} from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { SignalRouter } from "../workflow/signal-router";

export type MetricType = 
  | 'sessions'
  | 'conversions'
  | 'clicks'
  | 'impressions'
  | 'organicClicks'
  | 'organicImpressions'
  | 'avgPosition'
  | 'spend';

export type AnomalyType = 
  | 'traffic_drop'
  | 'traffic_spike'
  | 'conversion_drop'
  | 'conversion_spike'
  | 'ranking_loss'
  | 'ranking_gain'
  | 'bounce_rate_spike'
  | 'impression_drop'
  | 'click_drop'
  | 'spend_anomaly';

export interface AnomalyThreshold {
  metricType: MetricType;
  zScoreThreshold: number;
  percentChangeThreshold: number;
  minDataPoints: number;
  enabled: boolean;
}

export interface DetectedAnomaly {
  id: string;
  clientId: string;
  agencyId: string;
  metricType: MetricType;
  anomalyType: AnomalyType;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  zScore: number;
  percentChange: number;
  confidence: number;
  detectedAt: Date;
  dataPointDate: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isFalsePositive: boolean;
  metadata: Record<string, unknown>;
}

export interface TrendAnalysis {
  clientId: string;
  metricType: MetricType;
  weekOverWeek: {
    current: number;
    previous: number;
    percentChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  monthOverMonth: {
    current: number;
    previous: number;
    percentChange: number;
    trend: 'up' | 'down' | 'stable';
  };
}

const DEFAULT_THRESHOLDS: Record<MetricType, AnomalyThreshold> = {
  sessions: {
    metricType: 'sessions',
    zScoreThreshold: 2.5,
    percentChangeThreshold: 30,
    minDataPoints: 14,
    enabled: true,
  },
  conversions: {
    metricType: 'conversions',
    zScoreThreshold: 2.0,
    percentChangeThreshold: 25,
    minDataPoints: 14,
    enabled: true,
  },
  clicks: {
    metricType: 'clicks',
    zScoreThreshold: 2.5,
    percentChangeThreshold: 30,
    minDataPoints: 14,
    enabled: true,
  },
  impressions: {
    metricType: 'impressions',
    zScoreThreshold: 2.5,
    percentChangeThreshold: 30,
    minDataPoints: 14,
    enabled: true,
  },
  organicClicks: {
    metricType: 'organicClicks',
    zScoreThreshold: 2.5,
    percentChangeThreshold: 30,
    minDataPoints: 14,
    enabled: true,
  },
  organicImpressions: {
    metricType: 'organicImpressions',
    zScoreThreshold: 2.5,
    percentChangeThreshold: 30,
    minDataPoints: 14,
    enabled: true,
  },
  avgPosition: {
    metricType: 'avgPosition',
    zScoreThreshold: 2.0,
    percentChangeThreshold: 15,
    minDataPoints: 14,
    enabled: true,
  },
  spend: {
    metricType: 'spend',
    zScoreThreshold: 2.0,
    percentChangeThreshold: 20,
    minDataPoints: 7,
    enabled: true,
  },
};

export class AnomalyDetectionService {
  private signalRouter: SignalRouter;

  constructor() {
    this.signalRouter = new SignalRouter();
  }

  /**
   * Calculate Z-score for a value given a dataset
   * Z-score = (value - mean) / standardDeviation
   */
  calculateZScore(value: number, dataset: number[]): number {
    if (dataset.length === 0) return 0;
    
    const mean = dataset.reduce((sum, v) => sum + v, 0) / dataset.length;
    const variance = dataset.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / dataset.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    return (value - mean) / stdDev;
  }

  /**
   * Calculate Interquartile Range (IQR) bounds for outlier detection
   * Outliers are values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
   */
  calculateIQRBounds(dataset: number[]): { lowerBound: number; upperBound: number; q1: number; q3: number; iqr: number } {
    if (dataset.length < 4) {
      return { lowerBound: -Infinity, upperBound: Infinity, q1: 0, q3: 0, iqr: 0 };
    }

    const sorted = [...dataset].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    return {
      lowerBound: q1 - 1.5 * iqr,
      upperBound: q3 + 1.5 * iqr,
      q1,
      q3,
      iqr,
    };
  }

  /**
   * Calculate mean of a dataset
   */
  calculateMean(dataset: number[]): number {
    if (dataset.length === 0) return 0;
    return dataset.reduce((sum, v) => sum + v, 0) / dataset.length;
  }

  /**
   * Calculate standard deviation
   */
  calculateStdDev(dataset: number[]): number {
    if (dataset.length === 0) return 0;
    const mean = this.calculateMean(dataset);
    const variance = dataset.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / dataset.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate percent change between two values
   */
  calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Determine anomaly severity based on Z-score and percent change
   */
  determineSeverity(zScore: number, percentChange: number): 'low' | 'medium' | 'high' | 'critical' {
    const absZScore = Math.abs(zScore);
    const absPercentChange = Math.abs(percentChange);
    
    if (absZScore >= 4 || absPercentChange >= 75) return 'critical';
    if (absZScore >= 3 || absPercentChange >= 50) return 'high';
    if (absZScore >= 2.5 || absPercentChange >= 30) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence score (0-1) for the anomaly detection
   */
  calculateConfidence(zScore: number, dataPoints: number, iqrOutlier: boolean): number {
    let confidence = 0;
    
    // Z-score contribution (up to 0.4)
    const absZScore = Math.abs(zScore);
    if (absZScore >= 3) confidence += 0.4;
    else if (absZScore >= 2.5) confidence += 0.3;
    else if (absZScore >= 2) confidence += 0.2;
    else confidence += 0.1;
    
    // Data points contribution (up to 0.3)
    if (dataPoints >= 30) confidence += 0.3;
    else if (dataPoints >= 21) confidence += 0.25;
    else if (dataPoints >= 14) confidence += 0.2;
    else confidence += 0.1;
    
    // IQR outlier contribution (up to 0.3)
    if (iqrOutlier) confidence += 0.3;
    
    return Math.min(confidence, 1);
  }

  /**
   * Detect if a value is a false positive based on patterns
   */
  isFalsePositive(
    metricType: MetricType,
    value: number,
    dataset: number[],
    zScore: number,
    dayOfWeek: number
  ): boolean {
    // Weekend patterns for traffic metrics
    if (['sessions', 'clicks', 'impressions'].includes(metricType)) {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend traffic naturally lower - less likely to be anomaly if drop is moderate
        if (zScore > -3 && zScore < 0) {
          return true;
        }
      }
    }

    // Seasonal patterns - check if similar values occurred recently
    const similarValues = dataset.filter(v => 
      Math.abs(v - value) < Math.abs(value * 0.1)
    );
    
    if (similarValues.length >= 2) {
      // Value has occurred before, less likely to be true anomaly
      return true;
    }

    // Very small absolute values
    if (Math.abs(value) < 5 && metricType !== 'avgPosition') {
      return true;
    }

    return false;
  }

  /**
   * Map metric type to anomaly type based on direction
   */
  mapToAnomalyType(metricType: MetricType, direction: 'up' | 'down'): AnomalyType {
    const mapping: Record<MetricType, { up: AnomalyType; down: AnomalyType }> = {
      sessions: { up: 'traffic_spike', down: 'traffic_drop' },
      conversions: { up: 'conversion_spike', down: 'conversion_drop' },
      clicks: { up: 'traffic_spike', down: 'click_drop' },
      impressions: { up: 'traffic_spike', down: 'impression_drop' },
      organicClicks: { up: 'traffic_spike', down: 'click_drop' },
      organicImpressions: { up: 'traffic_spike', down: 'impression_drop' },
      avgPosition: { up: 'ranking_loss', down: 'ranking_gain' }, // Higher position number = worse
      spend: { up: 'spend_anomaly', down: 'spend_anomaly' },
    };
    
    return mapping[metricType][direction];
  }

  /**
   * Get historical metrics for a client
   */
  async getHistoricalMetrics(
    clientId: string,
    days: number = 30
  ): Promise<Array<{ date: string; metrics: Record<MetricType, number> }>> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await db
      .select()
      .from(dailyMetrics)
      .where(
        and(
          eq(dailyMetrics.clientId, clientId),
          gte(dailyMetrics.date, startDate.toISOString().split('T')[0]),
          lte(dailyMetrics.date, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(dailyMetrics.date));

    return metrics.map(m => ({
      date: m.date,
      metrics: {
        sessions: m.sessions || 0,
        conversions: m.conversions || 0,
        clicks: m.clicks || 0,
        impressions: m.impressions || 0,
        organicClicks: m.organicClicks || 0,
        organicImpressions: m.organicImpressions || 0,
        avgPosition: m.avgPosition ? parseFloat(m.avgPosition) : 0,
        spend: m.spend ? parseFloat(m.spend) : 0,
      },
    }));
  }

  /**
   * Fetch stored thresholds for a client from the database
   */
  async getStoredThresholds(clientId: string): Promise<Partial<Record<MetricType, AnomalyThreshold>>> {
    const storedThresholds = await db
      .select()
      .from(clientAnomalyThresholds)
      .where(eq(clientAnomalyThresholds.clientId, clientId));

    const thresholdMap: Partial<Record<MetricType, AnomalyThreshold>> = {};
    
    for (const stored of storedThresholds) {
      const metricType = stored.metricType as MetricType;
      thresholdMap[metricType] = {
        metricType,
        zScoreThreshold: parseFloat(stored.zScoreThreshold || "2.5"),
        percentChangeThreshold: parseFloat(stored.percentChangeThreshold || "30"),
        minDataPoints: stored.minDataPoints || 14,
        enabled: stored.enabled ?? true,
      };
    }

    return thresholdMap;
  }

  /**
   * Detect anomalies for a specific client
   */
  async detectAnomaliesForClient(
    clientId: string,
    agencyId: string,
    thresholds?: Partial<Record<MetricType, AnomalyThreshold>>
  ): Promise<DetectedAnomaly[]> {
    const historicalData = await this.getHistoricalMetrics(clientId, 45);
    
    if (historicalData.length < 7) {
      console.log(`[ANOMALY] Insufficient data for client ${clientId}: ${historicalData.length} days`);
      return [];
    }

    // Fetch stored thresholds from database if not provided
    const storedThresholds = thresholds || await this.getStoredThresholds(clientId);

    const anomalies: DetectedAnomaly[] = [];
    const latestData = historicalData[0];
    const historicalValues = historicalData.slice(1);
    const currentDate = new Date(latestData.date);

    const metricTypes: MetricType[] = [
      'sessions', 'conversions', 'clicks', 'impressions',
      'organicClicks', 'organicImpressions', 'avgPosition', 'spend'
    ];

    for (const metricType of metricTypes) {
      // Use stored threshold, then provided threshold, then default
      const threshold = storedThresholds?.[metricType] || DEFAULT_THRESHOLDS[metricType];
      
      if (!threshold.enabled) continue;
      if (historicalValues.length < threshold.minDataPoints) continue;

      const currentValue = latestData.metrics[metricType];
      const historicalDataset = historicalValues.map(h => h.metrics[metricType]);
      
      // Calculate statistics
      const zScore = this.calculateZScore(currentValue, historicalDataset);
      const mean = this.calculateMean(historicalDataset);
      const percentChange = this.calculatePercentChange(currentValue, mean);
      const iqrBounds = this.calculateIQRBounds(historicalDataset);
      const isIQROutlier = currentValue < iqrBounds.lowerBound || currentValue > iqrBounds.upperBound;

      // Check if anomaly
      if (Math.abs(zScore) >= threshold.zScoreThreshold || 
          Math.abs(percentChange) >= threshold.percentChangeThreshold) {
        
        const direction = currentValue > mean ? 'up' : 'down';
        const dayOfWeek = currentDate.getDay();
        
        const isFalsePos = this.isFalsePositive(
          metricType, currentValue, historicalDataset, zScore, dayOfWeek
        );
        
        const confidence = this.calculateConfidence(zScore, historicalDataset.length, isIQROutlier);
        
        // Skip low confidence anomalies
        if (confidence < 0.4 && !isIQROutlier) continue;

        const anomaly: DetectedAnomaly = {
          id: createHash('sha256')
            .update(`${clientId}:${metricType}:${latestData.date}`)
            .digest('hex').substring(0, 16),
          clientId,
          agencyId,
          metricType,
          anomalyType: this.mapToAnomalyType(metricType, direction),
          currentValue,
          expectedValue: mean,
          deviation: currentValue - mean,
          zScore,
          percentChange,
          confidence,
          detectedAt: new Date(),
          dataPointDate: latestData.date,
          severity: this.determineSeverity(zScore, percentChange),
          isFalsePositive: isFalsePos,
          metadata: {
            iqrBounds,
            isIQROutlier,
            dataPointCount: historicalDataset.length,
            stdDev: this.calculateStdDev(historicalDataset),
          },
        };

        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  /**
   * Convert detected anomaly to a workflow signal
   */
  async convertAnomalyToSignal(anomaly: DetectedAnomaly): Promise<string | null> {
    if (anomaly.isFalsePositive) {
      console.log(`[ANOMALY] Skipping false positive anomaly: ${anomaly.id}`);
      return null;
    }

    const signalPayload = {
      anomalyId: anomaly.id,
      clientId: anomaly.clientId,
      metricType: anomaly.metricType,
      anomalyType: anomaly.anomalyType,
      currentValue: anomaly.currentValue,
      expectedValue: anomaly.expectedValue,
      deviation: anomaly.deviation,
      zScore: anomaly.zScore,
      percentChange: anomaly.percentChange,
      confidence: anomaly.confidence,
      severity: anomaly.severity,
      dataPointDate: anomaly.dataPointDate,
      detectedAt: anomaly.detectedAt.toISOString(),
    };

    try {
      const result = await this.signalRouter.ingestSignal(
        anomaly.agencyId,
        'analytics',
        signalPayload,
        anomaly.clientId
      );

      console.log(`[ANOMALY] Created signal ${result.signal.id} for anomaly ${anomaly.id}`);
      return result.signal.id;
    } catch (error: any) {
      console.error(`[ANOMALY] Failed to create signal for anomaly ${anomaly.id}:`, error.message);
      return null;
    }
  }

  /**
   * Analyze trends for a client (WoW, MoM)
   */
  async analyzeTrends(clientId: string): Promise<TrendAnalysis[]> {
    const historicalData = await this.getHistoricalMetrics(clientId, 60);
    
    if (historicalData.length < 14) {
      return [];
    }

    const trends: TrendAnalysis[] = [];
    const metricTypes: MetricType[] = [
      'sessions', 'conversions', 'clicks', 'impressions',
      'organicClicks', 'organicImpressions', 'avgPosition'
    ];

    // Split data into periods
    const currentWeek = historicalData.slice(0, 7);
    const previousWeek = historicalData.slice(7, 14);
    const currentMonth = historicalData.slice(0, 30);
    const previousMonth = historicalData.slice(30, 60);

    for (const metricType of metricTypes) {
      const currentWeekAvg = this.calculateMean(currentWeek.map(d => d.metrics[metricType]));
      const previousWeekAvg = this.calculateMean(previousWeek.map(d => d.metrics[metricType]));
      const currentMonthAvg = currentMonth.length > 0 
        ? this.calculateMean(currentMonth.map(d => d.metrics[metricType]))
        : 0;
      const previousMonthAvg = previousMonth.length > 0
        ? this.calculateMean(previousMonth.map(d => d.metrics[metricType]))
        : 0;

      const wowChange = this.calculatePercentChange(currentWeekAvg, previousWeekAvg);
      const momChange = this.calculatePercentChange(currentMonthAvg, previousMonthAvg);

      const getTrend = (change: number): 'up' | 'down' | 'stable' => {
        if (change > 5) return 'up';
        if (change < -5) return 'down';
        return 'stable';
      };

      trends.push({
        clientId,
        metricType,
        weekOverWeek: {
          current: currentWeekAvg,
          previous: previousWeekAvg,
          percentChange: wowChange,
          trend: getTrend(wowChange),
        },
        monthOverMonth: {
          current: currentMonthAvg,
          previous: previousMonthAvg,
          percentChange: momChange,
          trend: getTrend(momChange),
        },
      });
    }

    return trends;
  }

  /**
   * Run anomaly detection for all clients in an agency
   */
  async runAnomalyDetectionForAgency(
    agencyId: string
  ): Promise<{ clientId: string; anomalies: DetectedAnomaly[]; signalsCreated: number }[]> {
    const agencyClients = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.agencyId, agencyId));

    const results = [];

    for (const client of agencyClients) {
      try {
        const anomalies = await this.detectAnomaliesForClient(client.id, agencyId);
        let signalsCreated = 0;

        for (const anomaly of anomalies) {
          if (!anomaly.isFalsePositive) {
            const signalId = await this.convertAnomalyToSignal(anomaly);
            if (signalId) signalsCreated++;
          }
        }

        results.push({
          clientId: client.id,
          anomalies,
          signalsCreated,
        });

        console.log(`[ANOMALY] Client ${client.id}: ${anomalies.length} anomalies, ${signalsCreated} signals`);
      } catch (error: any) {
        console.error(`[ANOMALY] Error processing client ${client.id}:`, error.message);
      }
    }

    return results;
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
