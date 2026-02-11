import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';
import { ProposalPrintService } from '../application/proposals/proposal-print-service';

const router = Router();
const proposalPrintService = new ProposalPrintService(storage);

export function createProposalPrintTokenHandler(service: ProposalPrintService = proposalPrintService) {
  return async (req: AuthRequest, res: any) => {
    try {
      const result = await service.createPrintToken({
        proposalId: req.params.id,
        userId: req.user?.id,
        agencyId: req.user?.agencyId,
        role: req.user?.role,
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.error });
      }
      return res.status(result.status).json(result.data);
    } catch (error: any) {
      console.error('Generate print token error:', error);
      return res.status(500).json({ message: error.message || 'Failed to generate print token' });
    }
  };
}

router.post('/:id/print-token', requireAuth, createProposalPrintTokenHandler());

export function createProposalPrintViewHandler(service: ProposalPrintService = proposalPrintService) {
  return async (req: any, res: any) => {
    try {
      const result = await service.renderPrintView({
        proposalId: req.params.id,
        token: req.query.token as string | undefined,
      });
      if (!result.ok) {
        return res.status(result.status).send(result.error);
      }
      res.setHeader('Content-Type', 'text/html');
      return res.status(result.status).send(result.data?.html);
    } catch (error: any) {
      console.error('[PDF Print] Error:', error);
      return res.status(500).send('<html><body><h1>Error</h1><p>Failed to generate print view.</p></body></html>');
    }
  };
}

router.get('/:id/print', createProposalPrintViewHandler());

export default router;
