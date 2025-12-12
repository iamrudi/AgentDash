import logger from "../middleware/logger";

export interface CronHeartbeat {
  name: string;
  lastRun: Date | null;
  lastStatus: "success" | "error" | "running" | "never_run";
  lastError?: string;
  schedule: string;
  runCount: number;
}

class CronHeartbeatService {
  private heartbeats: Map<string, CronHeartbeat> = new Map();
  private startTime: Date = new Date();

  register(name: string, schedule: string): void {
    this.heartbeats.set(name, {
      name,
      lastRun: null,
      lastStatus: "never_run",
      schedule,
      runCount: 0,
    });
    logger.info(`[CronHeartbeat] Registered cron job: ${name}`);
  }

  recordStart(name: string): void {
    const heartbeat = this.heartbeats.get(name);
    if (heartbeat) {
      heartbeat.lastStatus = "running";
      this.heartbeats.set(name, heartbeat);
    }
  }

  recordSuccess(name: string): void {
    const heartbeat = this.heartbeats.get(name);
    if (heartbeat) {
      heartbeat.lastRun = new Date();
      heartbeat.lastStatus = "success";
      heartbeat.lastError = undefined;
      heartbeat.runCount++;
      this.heartbeats.set(name, heartbeat);
      logger.info(`[CronHeartbeat] Job ${name} completed successfully`);
    }
  }

  recordError(name: string, error: string): void {
    const heartbeat = this.heartbeats.get(name);
    if (heartbeat) {
      heartbeat.lastRun = new Date();
      heartbeat.lastStatus = "error";
      heartbeat.lastError = error;
      heartbeat.runCount++;
      this.heartbeats.set(name, heartbeat);
      logger.error(`[CronHeartbeat] Job ${name} failed: ${error}`);
    }
  }

  getHeartbeat(name: string): CronHeartbeat | undefined {
    return this.heartbeats.get(name);
  }

  getAllHeartbeats(): CronHeartbeat[] {
    return Array.from(this.heartbeats.values());
  }

  getHealth(): {
    healthy: boolean;
    jobs: CronHeartbeat[];
    uptime: number;
    summary: {
      total: number;
      healthy: number;
      errors: number;
      neverRun: number;
    };
  } {
    const jobs = this.getAllHeartbeats();
    const now = new Date();
    
    const summary = {
      total: jobs.length,
      healthy: jobs.filter(j => j.lastStatus === "success").length,
      errors: jobs.filter(j => j.lastStatus === "error").length,
      neverRun: jobs.filter(j => j.lastStatus === "never_run").length,
    };

    const healthy = summary.errors === 0;
    const uptime = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);

    return {
      healthy,
      jobs,
      uptime,
      summary,
    };
  }
}

export const cronHeartbeat = new CronHeartbeatService();
