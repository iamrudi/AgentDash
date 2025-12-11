import type { IStorage } from "../storage";
import type {
  WorkflowRule,
  WorkflowRuleVersion,
  WorkflowRuleCondition,
  RuleOperator,
} from "@shared/schema";

export interface RuleEvaluationContext {
  signal: Record<string, unknown>;
  client?: Record<string, unknown>;
  project?: Record<string, unknown>;
  history?: Array<Record<string, unknown>>;
}

export interface ConditionResult {
  conditionId: string;
  fieldPath: string;
  operator: string;
  passed: boolean;
  actualValue: unknown;
  expectedValue: unknown;
  error?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleVersionId: string;
  matched: boolean;
  conditionResults: ConditionResult[];
  evaluationContext: RuleEvaluationContext;
  durationMs: number;
  noPublishedVersion?: boolean;
}

export class RuleEngine {
  constructor(private storage: IStorage) {}

  async evaluateRule(
    rule: WorkflowRule,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    const version = await this.storage.getPublishedRuleVersion(rule.id);
    if (!version) {
      return {
        ruleId: rule.id,
        ruleVersionId: "",
        matched: false,
        conditionResults: [],
        evaluationContext: context,
        durationMs: Date.now() - startTime,
        noPublishedVersion: true,
      };
    }

    const conditions = await this.storage.getRuleConditionsByVersionId(version.id);
    const conditionResults = await this.evaluateConditions(conditions, version, context);

    const logic = version.conditionLogic || "all";
    const matched = this.applyLogic(conditionResults, logic);

    const result: RuleEvaluationResult = {
      ruleId: rule.id,
      ruleVersionId: version.id,
      matched,
      conditionResults,
      evaluationContext: context,
      durationMs: Date.now() - startTime,
    };

    await this.storage.createRuleEvaluation({
      ruleId: rule.id,
      ruleVersionId: version.id,
      matched,
      conditionResults: conditionResults as any,
      evaluationContext: context as any,
      durationMs: result.durationMs,
    });

    return result;
  }

  async evaluateRulesForSignal(
    agencyId: string,
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult[]> {
    const rules = await this.storage.getEnabledRulesByAgencyId(agencyId);
    const results: RuleEvaluationResult[] = [];

    for (const rule of rules) {
      const result = await this.evaluateRule(rule, context);
      results.push(result);
    }

    return results;
  }

  private async evaluateConditions(
    conditions: WorkflowRuleCondition[],
    version: WorkflowRuleVersion,
    context: RuleEvaluationContext
  ): Promise<ConditionResult[]> {
    const results: ConditionResult[] = [];

    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, version, context);
      results.push(result);
    }

    return results;
  }

  private async evaluateCondition(
    condition: WorkflowRuleCondition,
    version: WorkflowRuleVersion,
    context: RuleEvaluationContext
  ): Promise<ConditionResult> {
    try {
      const scope = condition.scope || "signal";
      const data = this.getScopeData(scope, context);
      const actualValue = this.getValueByPath(data, condition.fieldPath);
      const expectedValue = condition.comparisonValue;
      const operator = condition.operator as RuleOperator;

      let passed: boolean;

      switch (operator) {
        case "gt":
          passed = this.compareNumeric(actualValue, expectedValue, (a, b) => a > b);
          break;
        case "gte":
          passed = this.compareNumeric(actualValue, expectedValue, (a, b) => a >= b);
          break;
        case "lt":
          passed = this.compareNumeric(actualValue, expectedValue, (a, b) => a < b);
          break;
        case "lte":
          passed = this.compareNumeric(actualValue, expectedValue, (a, b) => a <= b);
          break;
        case "eq":
          passed = actualValue === expectedValue;
          break;
        case "neq":
          passed = actualValue !== expectedValue;
          break;
        case "contains":
          passed = this.evaluateContains(actualValue, expectedValue);
          break;
        case "not_contains":
          passed = !this.evaluateContains(actualValue, expectedValue);
          break;
        case "matches":
          passed = this.evaluateMatches(actualValue, expectedValue);
          break;
        case "in":
          passed = this.evaluateIn(actualValue, expectedValue);
          break;
        case "not_in":
          passed = !this.evaluateIn(actualValue, expectedValue);
          break;
        case "percent_change_gt":
          passed = this.evaluatePercentChange(actualValue, context, condition, version, "gt");
          break;
        case "percent_change_lt":
          passed = this.evaluatePercentChange(actualValue, context, condition, version, "lt");
          break;
        case "anomaly_zscore_gt":
          passed = this.evaluateAnomalyZScore(actualValue, context, version, expectedValue);
          break;
        case "inactivity_days_gt":
          passed = this.evaluateInactivityDays(context, version, expectedValue);
          break;
        case "changed_to":
          passed = this.evaluateChangedTo(actualValue, context, expectedValue);
          break;
        case "changed_from":
          passed = this.evaluateChangedFrom(context, condition.fieldPath, expectedValue);
          break;
        default:
          passed = false;
      }

      return {
        conditionId: condition.id,
        fieldPath: condition.fieldPath,
        operator,
        passed,
        actualValue,
        expectedValue,
      };
    } catch (error) {
      return {
        conditionId: condition.id,
        fieldPath: condition.fieldPath,
        operator: condition.operator,
        passed: false,
        actualValue: null,
        expectedValue: condition.comparisonValue,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private applyLogic(results: ConditionResult[], logic: string): boolean {
    if (results.length === 0) return false;

    if (logic === "any") {
      return results.some((r) => r.passed);
    }
    return results.every((r) => r.passed);
  }

  private getScopeData(scope: string, context: RuleEvaluationContext): Record<string, unknown> {
    switch (scope) {
      case "signal":
        return context.signal;
      case "client":
        return context.client || {};
      case "project":
        return context.project || {};
      case "context":
        return { ...context.signal, ...context.client, ...context.project };
      default:
        return context.signal;
    }
  }

  private getValueByPath(data: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private compareNumeric(
    actual: unknown,
    expected: unknown,
    comparator: (a: number, b: number) => boolean
  ): boolean {
    const actualNum = typeof actual === "number" ? actual : parseFloat(String(actual));
    const expectedNum = typeof expected === "number" ? expected : parseFloat(String(expected));

    if (isNaN(actualNum) || isNaN(expectedNum)) return false;
    return comparator(actualNum, expectedNum);
  }

  private evaluateContains(actual: unknown, expected: unknown): boolean {
    if (typeof actual === "string" && typeof expected === "string") {
      return actual.includes(expected);
    }
    if (Array.isArray(actual)) {
      return actual.includes(expected);
    }
    return false;
  }

  private evaluateMatches(actual: unknown, expected: unknown): boolean {
    if (typeof actual !== "string" || typeof expected !== "string") return false;
    try {
      const regex = new RegExp(expected);
      return regex.test(actual);
    } catch {
      return false;
    }
  }

  private evaluateIn(actual: unknown, expected: unknown): boolean {
    if (!Array.isArray(expected)) return false;
    return expected.includes(actual);
  }

  private evaluatePercentChange(
    actualValue: unknown,
    context: RuleEvaluationContext,
    condition: WorkflowRuleCondition,
    version: WorkflowRuleVersion,
    direction: "gt" | "lt"
  ): boolean {
    const history = context.history;
    if (!history || history.length === 0) return false;

    const thresholdConfig = version.thresholdConfig as { 
      windowDays?: number; 
      baselineType?: "average" | "previous" 
    } | null;
    const baselineType = thresholdConfig?.baselineType || "previous";

    const currentValue = typeof actualValue === "number" ? actualValue : parseFloat(String(actualValue));
    if (isNaN(currentValue)) return false;

    let baselineValue: number;

    if (baselineType === "previous") {
      const previousRecord = history[0];
      const previousValue = this.getValueByPath(previousRecord, condition.fieldPath);
      baselineValue = typeof previousValue === "number" ? previousValue : parseFloat(String(previousValue));
    } else {
      const values = history.map((record) => {
        const val = this.getValueByPath(record, condition.fieldPath);
        return typeof val === "number" ? val : parseFloat(String(val));
      }).filter((v) => !isNaN(v));

      if (values.length === 0) return false;
      baselineValue = values.reduce((a, b) => a + b, 0) / values.length;
    }

    if (isNaN(baselineValue) || baselineValue === 0) return false;

    const percentChange = ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100;
    const threshold = typeof condition.comparisonValue === "number" 
      ? condition.comparisonValue 
      : parseFloat(String(condition.comparisonValue));

    if (direction === "gt") {
      return Math.abs(percentChange) > threshold;
    }
    return Math.abs(percentChange) < threshold;
  }

  private evaluateAnomalyZScore(
    actualValue: unknown,
    context: RuleEvaluationContext,
    version: WorkflowRuleVersion,
    expectedValue: unknown
  ): boolean {
    const history = context.history;
    if (!history || history.length < 3) return false;

    const anomalyConfig = version.anomalyConfig as { 
      zScoreThreshold?: number;
    } | null;
    const zScoreThreshold = anomalyConfig?.zScoreThreshold || 
      (typeof expectedValue === "number" ? expectedValue : parseFloat(String(expectedValue)));

    if (isNaN(zScoreThreshold)) return false;

    const currentValue = typeof actualValue === "number" ? actualValue : parseFloat(String(actualValue));
    if (isNaN(currentValue)) return false;

    const values = history.map((record) => {
      if (typeof record === "number") return record;
      return parseFloat(String(record));
    }).filter((v) => !isNaN(v));

    if (values.length < 2) return false;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return false;

    const zScore = Math.abs((currentValue - mean) / stdDev);
    return zScore > zScoreThreshold;
  }

  private evaluateInactivityDays(
    context: RuleEvaluationContext,
    version: WorkflowRuleVersion,
    expectedValue: unknown
  ): boolean {
    const lifecycleConfig = version.lifecycleConfig as { 
      inactivityField?: string;
    } | null;
    const inactivityField = lifecycleConfig?.inactivityField || "lastActivityAt";

    const lastActivity = this.getValueByPath(context.client || context.signal, inactivityField);
    if (!lastActivity) return false;

    const lastActivityDate = new Date(String(lastActivity));
    if (isNaN(lastActivityDate.getTime())) return false;

    const now = new Date();
    const diffTime = now.getTime() - lastActivityDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const threshold = typeof expectedValue === "number" 
      ? expectedValue 
      : parseFloat(String(expectedValue));

    return diffDays > threshold;
  }

  private evaluateChangedTo(
    actualValue: unknown,
    context: RuleEvaluationContext,
    expectedValue: unknown
  ): boolean {
    const previousValue = (context.signal as any)._previousValue;
    return actualValue === expectedValue && previousValue !== expectedValue;
  }

  private evaluateChangedFrom(
    context: RuleEvaluationContext,
    fieldPath: string,
    expectedValue: unknown
  ): boolean {
    const previousValue = (context.signal as any)._previousValue;
    return previousValue === expectedValue;
  }
}

export function createRuleEngine(storage: IStorage): RuleEngine {
  return new RuleEngine(storage);
}
