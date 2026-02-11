import type { IStorage } from "../../storage";

export interface InitiativeDraftResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class InitiativeDraftService {
  constructor(private storage: IStorage) {}

  async createInitiative(payload: any): Promise<InitiativeDraftResult<unknown>> {
    try {
      const { billingType, cost, estimatedHours, ...rest } = payload ?? {};
      const initiativeData: any = { ...rest };

      let effectiveBillingType = billingType;
      if (!billingType) {
        if (estimatedHours && !cost) {
          effectiveBillingType = "hours";
        } else {
          effectiveBillingType = "cost";
        }
      }

      if (effectiveBillingType === "hours") {
        const hours = estimatedHours ? parseFloat(estimatedHours) : Number.NaN;
        if (Number.isNaN(hours) || hours <= 0) {
          return {
            ok: false,
            status: 400,
            error: "Valid estimated hours (> 0) required for hours-based billing",
          };
        }
        initiativeData.billingType = "hours";
        initiativeData.estimatedHours = hours;
        initiativeData.cost = null;
      } else {
        const costValue = cost ? parseFloat(cost) : Number.NaN;
        if (Number.isNaN(costValue) || costValue <= 0) {
          return {
            ok: false,
            status: 400,
            error: "Valid cost (> 0) required for cost-based billing",
          };
        }
        initiativeData.billingType = "cost";
        initiativeData.cost = costValue.toString();
        initiativeData.estimatedHours = null;
      }

      const initiative = await this.storage.createInitiative(initiativeData);
      return { ok: true, status: 201, data: initiative };
    } catch (error: any) {
      if (error.message?.includes("Opportunity must be approved")) {
        return { ok: false, status: 400, error: error.message };
      }
      return { ok: false, status: 500, error: error.message };
    }
  }

  async updateInitiative(id: string, payload: any): Promise<InitiativeDraftResult<unknown>> {
    try {
      const { title, observation, proposedAction, cost, impact, estimatedHours, billingType } = payload ?? {};
      const updates: any = {
        title,
        observation,
        proposedAction,
        impact,
      };

      if (billingType === "hours") {
        const hours = estimatedHours ? parseFloat(estimatedHours) : Number.NaN;
        if (Number.isNaN(hours) || hours <= 0) {
          return {
            ok: false,
            status: 400,
            error: "Valid estimated hours (> 0) required for hours-based billing",
          };
        }
        updates.billingType = "hours";
        updates.estimatedHours = hours;
        updates.cost = null;
      } else if (billingType === "cost") {
        const costValue = cost ? parseFloat(cost) : Number.NaN;
        if (Number.isNaN(costValue) || costValue <= 0) {
          return {
            ok: false,
            status: 400,
            error: "Valid cost (> 0) required for cost-based billing",
          };
        }
        updates.billingType = "cost";
        updates.cost = costValue.toString();
        updates.estimatedHours = null;
      } else if (cost !== undefined || estimatedHours !== undefined) {
        if (cost !== undefined) {
          const costValue = parseFloat(cost);
          if (Number.isNaN(costValue) || costValue <= 0) {
            return { ok: false, status: 400, error: "Valid cost (> 0) required" };
          }
          updates.cost = costValue.toString();
          updates.billingType = "cost";
        }
        if (estimatedHours !== undefined) {
          const hours = parseFloat(estimatedHours);
          if (Number.isNaN(hours) || hours <= 0) {
            return { ok: false, status: 400, error: "Valid estimated hours (> 0) required" };
          }
          updates.estimatedHours = hours;
          updates.billingType = "hours";
        }
      }

      const initiative = await this.storage.updateInitiative(id, updates);
      return { ok: true, status: 200, data: initiative };
    } catch (error: any) {
      return { ok: false, status: 500, error: error.message };
    }
  }
}
