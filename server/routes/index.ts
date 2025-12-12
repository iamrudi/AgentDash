import { Router, type Express } from 'express';
import authRoutes from './auth';
import userRoutes from './user';
import clientRoutes from './client';
import agencyRoutes from './agency';
import staffRoutes from './staff';
import crmRoutes from './crm';
import settingsRoutes from './settings';
import superadminRoutes from './superadmin';
import invoicesRoutes from './invoices';

export interface DomainRouter {
  subpath: string;
  router: Router;
}

const domainRegistry: DomainRouter[] = [];

export function registerDomainRouter(subpath: string, router: Router): void {
  if (!subpath.startsWith('/')) {
    throw new Error(`Domain subpath must start with /: ${subpath}`);
  }
  domainRegistry.push({ subpath, router });
}

registerDomainRouter('/auth', authRoutes);
registerDomainRouter('/user', userRoutes);
registerDomainRouter('/client', clientRoutes);
registerDomainRouter('/agency', agencyRoutes);
registerDomainRouter('/staff', staffRoutes);
registerDomainRouter('/crm', crmRoutes);
registerDomainRouter('/settings', settingsRoutes);
registerDomainRouter('/superadmin', superadminRoutes);
registerDomainRouter('/invoices', invoicesRoutes);

export function mountDomainRouters(app: Express): void {
  for (const { subpath, router } of domainRegistry) {
    app.use(`/api${subpath}`, router);
  }
}

export function getDomainRouters(): readonly DomainRouter[] {
  return domainRegistry;
}

export { authRoutes };
