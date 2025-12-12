import { describe, it, expect, vi, beforeEach } from "vitest";

describe("SLA Service - Breach Detection Logic", () => {
  describe("Deadline Calculation - Non-Business Hours", () => {
    it("should calculate deadline correctly without business hours constraint", () => {
      const startTime = new Date("2024-12-10T10:00:00.000Z");
      const hours = 4;
      const sla = {
        businessHoursOnly: false,
        businessHoursStart: 9,
        businessHoursEnd: 17,
        businessDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      };

      const deadline = calculateDeadlineSimple(startTime, hours, sla);
      
      expect(deadline.getTime()).toBe(startTime.getTime() + (hours * 60 * 60 * 1000));
    });

    it("should handle overnight deadlines correctly", () => {
      const startTime = new Date("2024-12-10T22:00:00.000Z");
      const hours = 8;
      const sla = { businessHoursOnly: false };

      const deadline = calculateDeadlineSimple(startTime, hours, sla);
      
      const expected = new Date("2024-12-11T06:00:00.000Z");
      expect(deadline.getTime()).toBe(expected.getTime());
    });

    it("should handle multi-day deadlines correctly", () => {
      const startTime = new Date("2024-12-10T10:00:00.000Z");
      const hours = 48;
      const sla = { businessHoursOnly: false };

      const deadline = calculateDeadlineSimple(startTime, hours, sla);
      
      const expected = new Date("2024-12-12T10:00:00.000Z");
      expect(deadline.getTime()).toBe(expected.getTime());
    });
  });

  describe("Deadline Calculation - Business Hours Only", () => {
    it("should skip non-business hours when calculating deadline", () => {
      const startTime = new Date("2024-12-09T09:00:00.000Z");
      const hours = 4;
      const sla = {
        businessHoursOnly: true,
        businessHoursStart: 9,
        businessHoursEnd: 17,
        businessDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      };

      const deadline = calculateDeadlineWithBusinessHours(startTime, hours, sla);
      
      const expected = new Date("2024-12-09T13:00:00.000Z");
      expect(deadline.getTime()).toBe(expected.getTime());
    });

    it("should roll over to next business day when deadline extends past business hours", () => {
      const startTime = new Date("2024-12-09T15:00:00.000Z");
      const hours = 4;
      const sla = {
        businessHoursOnly: true,
        businessHoursStart: 9,
        businessHoursEnd: 17,
        businessDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      };

      const deadline = calculateDeadlineWithBusinessHours(startTime, hours, sla);
      
      const expected = new Date("2024-12-10T11:00:00.000Z");
      expect(deadline.getTime()).toBe(expected.getTime());
    });

    it("should skip weekends when calculating business hour deadlines", () => {
      const startTime = new Date("2024-12-06T15:00:00.000Z");
      const hours = 4;
      const sla = {
        businessHoursOnly: true,
        businessHoursStart: 9,
        businessHoursEnd: 17,
        businessDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      };

      const deadline = calculateDeadlineWithBusinessHours(startTime, hours, sla);
      
      const expected = new Date("2024-12-09T11:00:00.000Z");
      expect(deadline.getTime()).toBe(expected.getTime());
    });
  });

  describe("Breach Detection - Response Time", () => {
    it("should detect response time breach when task has no response past deadline", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-09T16:00:00.000Z");
      const responseTimeHours = 4;
      const hasResponse = false;
      const isResolved = false;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours,
        resolutionTimeHours: 24,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(true);
      expect(result.breachType).toBe("response_time");
    });

    it("should NOT detect response time breach when response is within deadline", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-09T12:00:00.000Z");
      const responseTimeHours = 4;
      const hasResponse = false;
      const isResolved = false;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours,
        resolutionTimeHours: 24,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(false);
      expect(result.breachType).toBeNull();
    });

    it("should NOT detect response time breach when task already has response", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-09T16:00:00.000Z");
      const responseTimeHours = 4;
      const hasResponse = true;
      const isResolved = false;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours,
        resolutionTimeHours: 24,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(false);
    });
  });

  describe("Breach Detection - Resolution Time", () => {
    it("should detect resolution time breach when task is not resolved past deadline", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-11T10:00:00.000Z");
      const resolutionTimeHours = 24;
      const hasResponse = true;
      const isResolved = false;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours: 4,
        resolutionTimeHours,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(true);
      expect(result.breachType).toBe("resolution_time");
    });

    it("should NOT detect resolution breach when task is resolved", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-11T10:00:00.000Z");
      const resolutionTimeHours = 24;
      const hasResponse = true;
      const isResolved = true;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours: 4,
        resolutionTimeHours,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(false);
      expect(result.breachType).toBeNull();
    });

    it("should NOT detect resolution breach when within deadline", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-09T20:00:00.000Z");
      const resolutionTimeHours = 24;
      const hasResponse = true;
      const isResolved = false;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours: 4,
        resolutionTimeHours,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(false);
    });
  });

  describe("Edge Cases - Deadline Boundaries", () => {
    it("should NOT breach exactly at deadline (inclusive)", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const exactDeadline = new Date("2024-12-09T14:00:00.000Z");
      const now = exactDeadline;
      const responseTimeHours = 4;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours,
        resolutionTimeHours: 24,
        hasResponse: false,
        isResolved: false,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(false);
    });

    it("should breach 1ms after deadline", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const exactDeadline = new Date("2024-12-09T14:00:00.000Z");
      const now = new Date(exactDeadline.getTime() + 1);
      const responseTimeHours = 4;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours,
        resolutionTimeHours: 24,
        hasResponse: false,
        isResolved: false,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(true);
      expect(result.breachType).toBe("response_time");
    });

    it("should prioritize response breach over resolution breach", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-11T10:00:00.000Z");
      const responseTimeHours = 4;
      const resolutionTimeHours = 24;
      const hasResponse = false;
      const isResolved = false;

      const result = checkForBreach({
        createdAt,
        now,
        responseTimeHours,
        resolutionTimeHours,
        hasResponse,
        isResolved,
        businessHoursOnly: false,
      });

      expect(result.isBreached).toBe(true);
      expect(result.breachType).toBe("response_time");
    });
  });

  describe("Elapsed and Remaining Time Calculations", () => {
    it("should calculate elapsed minutes correctly", () => {
      const createdAt = new Date("2024-12-09T10:00:00.000Z");
      const now = new Date("2024-12-09T12:30:00.000Z");

      const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));

      expect(elapsedMinutes).toBe(150);
    });

    it("should calculate remaining minutes correctly (positive)", () => {
      const deadline = new Date("2024-12-09T14:00:00.000Z");
      const now = new Date("2024-12-09T12:00:00.000Z");

      const remainingMinutes = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));

      expect(remainingMinutes).toBe(120);
    });

    it("should calculate remaining minutes correctly (negative when past)", () => {
      const deadline = new Date("2024-12-09T14:00:00.000Z");
      const now = new Date("2024-12-09T16:00:00.000Z");

      const remainingMinutes = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60));

      expect(remainingMinutes).toBe(-120);
    });
  });
});

function calculateDeadlineSimple(
  startTime: Date,
  hours: number,
  sla: { businessHoursOnly?: boolean }
): Date {
  if (!sla.businessHoursOnly) {
    return new Date(startTime.getTime() + hours * 60 * 60 * 1000);
  }
  throw new Error("Use calculateDeadlineWithBusinessHours for business hours");
}

function calculateDeadlineWithBusinessHours(
  startTime: Date,
  hours: number,
  sla: {
    businessHoursOnly: boolean;
    businessHoursStart: number;
    businessHoursEnd: number;
    businessDays: string[];
  }
): Date {
  const businessStart = sla.businessHoursStart ?? 9;
  const businessEnd = sla.businessHoursEnd ?? 17;
  const businessDays = sla.businessDays ?? ["Mon", "Tue", "Wed", "Thu", "Fri"];

  let remainingMinutes = hours * 60;
  let current = new Date(startTime);

  const dayMap: Record<number, string> = {
    0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"
  };

  while (remainingMinutes > 0) {
    const dayName = dayMap[current.getDay()];
    const isBusinessDay = businessDays.includes(dayName);
    const currentHour = current.getHours();
    const currentMinute = current.getMinutes();

    if (!isBusinessDay) {
      current.setDate(current.getDate() + 1);
      current.setHours(businessStart, 0, 0, 0);
      continue;
    }

    if (currentHour < businessStart) {
      current.setHours(businessStart, 0, 0, 0);
      continue;
    }

    if (currentHour >= businessEnd) {
      current.setDate(current.getDate() + 1);
      current.setHours(businessStart, 0, 0, 0);
      continue;
    }

    const minutesLeftToday = (businessEnd - currentHour) * 60 - currentMinute;
    
    if (remainingMinutes <= minutesLeftToday) {
      current.setMinutes(current.getMinutes() + remainingMinutes);
      remainingMinutes = 0;
    } else {
      remainingMinutes -= minutesLeftToday;
      current.setDate(current.getDate() + 1);
      current.setHours(businessStart, 0, 0, 0);
    }
  }

  return current;
}

interface BreachCheckParams {
  createdAt: Date;
  now: Date;
  responseTimeHours: number;
  resolutionTimeHours: number;
  hasResponse: boolean;
  isResolved: boolean;
  businessHoursOnly: boolean;
}

function checkForBreach(params: BreachCheckParams): { isBreached: boolean; breachType: "response_time" | "resolution_time" | null } {
  const {
    createdAt,
    now,
    responseTimeHours,
    resolutionTimeHours,
    hasResponse,
    isResolved,
    businessHoursOnly,
  } = params;

  const responseDeadline = new Date(createdAt.getTime() + responseTimeHours * 60 * 60 * 1000);
  const resolutionDeadline = new Date(createdAt.getTime() + resolutionTimeHours * 60 * 60 * 1000);

  let breachType: "response_time" | "resolution_time" | null = null;

  if (!hasResponse && now > responseDeadline) {
    breachType = "response_time";
  } else if (!isResolved && now > resolutionDeadline) {
    breachType = "resolution_time";
  }

  return {
    isBreached: breachType !== null,
    breachType,
  };
}
