import { Router, type Express } from 'express';
import authRoutes from './auth';

export interface DomainRouter {
  prefix: string;
  router: Router;
}

const domainRouters: DomainRouter[] = [
  { prefix: '/api/auth', router: authRoutes },
];

export function buildApiRouter(): Router {
  const apiRouter = Router();

  for (const { prefix, router } of domainRouters) {
    apiRouter.use(prefix.replace('/api', ''), router);
  }

  return apiRouter;
}

export function mountDomainRouters(app: Express): void {
  const apiRouter = buildApiRouter();
  app.use('/api', apiRouter);
}

export { authRoutes };
