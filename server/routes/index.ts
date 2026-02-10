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
import intelligenceExtendedRoutes from './intelligence-extended';
import knowledgeRoutes from './knowledge';
import workflowsRoutes from './workflows';
import workflowExecutionsRoutes from './workflow-executions';
import lineageRoutes from './lineage';
import publicRoutes from './public';
import ruleEngineRoutes from './rule-engine';
import signalsRoutes from './signals';
import aiExecutionRoutes from './ai-execution';
import retentionPoliciesRoutes from './retention-policies';
import notificationsRoutes from './notifications';
import knowledgeDocumentsRoutes from './knowledge-documents';
import initiativesRoutes from './initiatives';
import oauthRoutes from './oauth';
import integrationsRoutes from './integrations';
import agencySettingsRoutes from './agency-settings';
import agencyTasksRoutes from './agency-tasks';
import agencyUsersRoutes from './agency-users';
import analyticsRoutes from './analytics';
import messagesRoutes from './messages';
import objectivesRoutes from './objectives';
import aiChatRoutes from './ai-chat';
import proposalsRoutes from './proposals';
import { agencyClientsRouter, clientsRouter as agencyClientsClientRouter } from './agency-clients';

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
registerDomainRouter('/intelligence', intelligenceExtendedRoutes);
registerDomainRouter('/knowledge', knowledgeRoutes);
registerDomainRouter('/workflows', workflowsRoutes);
registerDomainRouter('/workflow-executions', workflowExecutionsRoutes);
registerDomainRouter('/lineage', lineageRoutes);
registerDomainRouter('/public', publicRoutes);
registerDomainRouter('/', ruleEngineRoutes);
registerDomainRouter('/', signalsRoutes);
registerDomainRouter('/', aiExecutionRoutes);
registerDomainRouter('/retention-policies', retentionPoliciesRoutes);
registerDomainRouter('/notifications', notificationsRoutes);
registerDomainRouter('/knowledge-documents', knowledgeDocumentsRoutes);
registerDomainRouter('/initiatives', initiativesRoutes);
registerDomainRouter('/oauth', oauthRoutes);
registerDomainRouter('/integrations', integrationsRoutes);
registerDomainRouter('/agency/settings', agencySettingsRoutes);
registerDomainRouter('/agency', agencyTasksRoutes);
registerDomainRouter('/agency', agencyUsersRoutes);
registerDomainRouter('/analytics', analyticsRoutes);
registerDomainRouter('/agency/messages', messagesRoutes);
registerDomainRouter('/agency', objectivesRoutes);
registerDomainRouter('/ai', aiChatRoutes);
registerDomainRouter('/proposals', proposalsRoutes);
registerDomainRouter('/agency/clients', agencyClientsRouter);
registerDomainRouter('/clients', agencyClientsClientRouter);

export function mountDomainRouters(app: Express): void {
  for (const { subpath, router } of domainRegistry) {
    app.use(`/api${subpath}`, router);
  }
}

export function getDomainRouters(): readonly DomainRouter[] {
  return domainRegistry;
}

export { authRoutes };
