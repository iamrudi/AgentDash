import { Router, type Express } from 'express';
import authRoutes from './auth';

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

export function mountDomainRouters(app: Express): void {
  for (const { subpath, router } of domainRegistry) {
    app.use(`/api${subpath}`, router);
  }
}

export function getDomainRouters(): readonly DomainRouter[] {
  return domainRegistry;
}

export { authRoutes };
