import { Request, Response } from "express";
import { vi } from "vitest";

export interface MockUser {
  id: string;
  email: string;
  role: "Admin" | "Staff" | "Client";
  agencyId?: string;
  clientId?: string;
  isSuperAdmin?: boolean;
}

export function createMockRequest(overrides: Partial<Request & { user?: MockUser }> = {}): Request {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    path: "/test",
    method: "GET",
    ...overrides,
  } as Request;
}

export function createMockResponse(): Response & { 
  statusCode?: number; 
  jsonData?: any;
  getStatus: () => number;
  getJson: () => any;
} {
  let statusCode = 200;
  let jsonData: any = null;

  const res = {
    status: vi.fn(function(code: number) {
      statusCode = code;
      return this;
    }),
    json: vi.fn(function(data: any) {
      jsonData = data;
      return this;
    }),
    send: vi.fn(function(data: any) {
      return this;
    }),
    getStatus: () => statusCode,
    getJson: () => jsonData,
  } as any;

  return res;
}

export function createMockNext() {
  return vi.fn();
}

export function createMockStorage() {
  return {
    getClientById: vi.fn(),
    getClientsByAgency: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    deleteClient: vi.fn(),
    getProjectById: vi.fn(),
    getProjectsByClient: vi.fn(),
    getProjectsByAgency: vi.fn(),
    createProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    getTaskById: vi.fn(),
    getTasksByProject: vi.fn(),
    getTasksByAssignee: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    getProfileById: vi.fn(),
    getProfileByEmail: vi.fn(),
    getProfilesByAgency: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    getAgencyById: vi.fn(),
    createAgency: vi.fn(),
    updateAgency: vi.fn(),
    deleteAgency: vi.fn(),
  };
}

export const testAgencyA = {
  id: "agency-a-uuid",
  name: "Test Agency A",
};

export const testAgencyB = {
  id: "agency-b-uuid",
  name: "Test Agency B",
};

export const testClientA = {
  id: "client-a-uuid",
  companyName: "Client A Corp",
  agencyId: testAgencyA.id,
  email: "client-a@example.com",
};

export const testClientB = {
  id: "client-b-uuid",
  companyName: "Client B Corp",
  agencyId: testAgencyB.id,
  email: "client-b@example.com",
};

export const testUsers = {
  adminAgencyA: {
    id: "admin-a-uuid",
    email: "admin@agencya.com",
    role: "Admin" as const,
    agencyId: testAgencyA.id,
    isSuperAdmin: false,
  },
  adminAgencyB: {
    id: "admin-b-uuid",
    email: "admin@agencyb.com",
    role: "Admin" as const,
    agencyId: testAgencyB.id,
    isSuperAdmin: false,
  },
  staffAgencyA: {
    id: "staff-a-uuid",
    email: "staff@agencya.com",
    role: "Staff" as const,
    agencyId: testAgencyA.id,
    isSuperAdmin: false,
  },
  clientUserA: {
    id: "client-user-a-uuid",
    email: "user@clienta.com",
    role: "Client" as const,
    clientId: testClientA.id,
    agencyId: testAgencyA.id,
    isSuperAdmin: false,
  },
  superAdmin: {
    id: "super-admin-uuid",
    email: "superadmin@platform.com",
    role: "Admin" as const,
    agencyId: testAgencyA.id,
    isSuperAdmin: true,
  },
};
