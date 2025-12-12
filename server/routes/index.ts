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
import tasksRoutes from './tasks';
import intelligenceRoutes from './intelligence';
import knowledgeRoutes from './knowledge';
import workflowsRoutes from './workflows';
import workflowExecutionsRoutes from './workflow-executions';
import lineageRoutes from './lineage';
import publicRoutes from './public';
import ruleEngineRoutes from './rule-engine';

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
registerDomainRouter('/tasks', tasksRoutes);
registerDomainRouter('/intelligence', intelligenceRoutes);
registerDomainRouter('/knowledge', knowledgeRoutes);
registerDomainRouter('/workflows', workflowsRoutes);
registerDomainRouter('/workflow-executions', workflowExecutionsRoutes);
registerDomainRouter('/lineage', lineageRoutes);
registerDomainRouter('/public', publicRoutes);
registerDomainRouter('/', ruleEngineRoutes);

export function mountDomainRouters(app: Express): void {
  for (const { subpath, router } of domainRegistry) {
    app.use(`/api${subpath}`, router);
  }
}

export function getDomainRouters(): readonly DomainRouter[] {
  return domainRegistry;
}

export { authRoutes };
