import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/supabase-auth';
import { storage } from '../storage';

const router = Router();

router.post("/:id/print-token", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const proposal = await storage.getProposalById(id);
    
    if (!proposal) {
      return res.status(404).json({ message: "Proposal not found" });
    }
    
    if (proposal.agencyId !== req.user!.agencyId) {
      return res.status(403).json({ message: "You do not have permission to access this proposal" });
    }
    
    if (req.user!.role !== 'Admin') {
      return res.status(403).json({ message: "Only admins can export proposals" });
    }
    
    const { generatePrintToken } = await import('../lib/print-tokens');
    const printToken = generatePrintToken(
      id,
      req.user!.id,
      req.user!.agencyId,
      req.user!.role
    );
    
    res.json({ token: printToken });
  } catch (error: any) {
    console.error("Generate print token error:", error);
    res.status(500).json({ message: error.message || "Failed to generate print token" });
  }
});

router.get("/:id/print", async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).send('<html><body><h1>Unauthorized</h1><p>Print token required.</p></body></html>');
    }

    const { validatePrintToken } = await import('../lib/print-tokens');
    const tokenData = validatePrintToken(token, id);
    
    if (!tokenData) {
      return res.status(401).send('<html><body><h1>Unauthorized</h1><p>Invalid or expired print token.</p></body></html>');
    }
    
    const proposal = await storage.getProposalById(id);
    
    if (!proposal) {
      return res.status(404).send('<html><body><h1>Not Found</h1><p>Proposal not found.</p></body></html>');
    }
    
    if (proposal.agencyId !== tokenData.agencyId) {
      return res.status(403).send('<html><body><h1>Forbidden</h1><p>Invalid print token for this proposal.</p></body></html>');
    }

    const sections = await storage.getProposalSectionsByProposalId(id);
    
    const deal = await storage.getDealById(proposal.dealId);
    let contact = null;
    if (deal?.contactId) {
      contact = await storage.getContactById(deal.contactId);
    }

    const { marked } = await import('marked');
    const processedSections = sections.map(section => ({
      ...section,
      content: marked.parse(section.content) as string
    }));

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${proposal.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
              line-height: 1.6;
              color: #1a1a1a;
              padding: 60px 80px;
              background: white;
              max-width: 1000px;
              margin: 0 auto;
            }
            
            .print-button {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #0a84ff;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(10, 132, 255, 0.3);
              transition: background 0.2s;
            }
            
            .print-button:hover {
              background: #0077ed;
            }
            
            .header {
              margin-bottom: 60px;
              padding-bottom: 30px;
              border-bottom: 3px solid #0a84ff;
            }
            
            .proposal-title {
              font-size: 36px;
              font-weight: 700;
              margin-bottom: 12px;
              color: #0a84ff;
            }
            
            .meta-info {
              font-size: 14px;
              color: #666;
            }
            
            .client-info {
              margin-bottom: 40px;
              padding: 20px;
              background: #f5f5f7;
              border-radius: 8px;
            }
            
            .client-info h3 {
              font-size: 16px;
              margin-bottom: 8px;
              color: #0a84ff;
            }
            
            .section {
              margin-bottom: 40px;
              page-break-inside: avoid;
            }
            
            .section-title {
              font-size: 24px;
              font-weight: 600;
              margin-bottom: 16px;
              color: #1a1a1a;
            }
            
            .section-content {
              font-size: 14px;
              line-height: 1.8;
            }
            
            .section-content h1,
            .section-content h2,
            .section-content h3 {
              margin-top: 24px;
              margin-bottom: 12px;
            }
            
            .section-content p {
              margin-bottom: 12px;
            }
            
            .section-content ul,
            .section-content ol {
              margin-left: 24px;
              margin-bottom: 12px;
            }
            
            .section-content table {
              width: 100%;
              border-collapse: collapse;
              margin: 16px 0;
            }
            
            .section-content th,
            .section-content td {
              border: 1px solid #e0e0e0;
              padding: 8px 12px;
              text-align: left;
            }
            
            .section-content th {
              background: #f5f5f7;
              font-weight: 600;
            }
            
            .footer {
              margin-top: 80px;
              padding-top: 30px;
              border-top: 1px solid #e0e0e0;
              text-align: center;
              color: #999;
              font-size: 12px;
            }
            
            @media print {
              body {
                padding: 40px;
              }
              
              .print-button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Print to PDF</button>
          
          <div class="header">
            <h1 class="proposal-title">${proposal.name}</h1>
            <div class="meta-info">
              Status: <strong>${proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}</strong> | 
              Created: ${new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          
          ${contact ? `
          <div class="client-info">
            <h3>Prepared For:</h3>
            <div>${contact.firstName} ${contact.lastName}</div>
            ${contact.email ? `<div>${contact.email}</div>` : ''}
            ${contact.phone ? `<div>${contact.phone}</div>` : ''}
          </div>
          ` : ''}
          
          ${processedSections.map(section => `
            <div class="section">
              <h2 class="section-title">${section.title}</h2>
              <div class="section-content">${section.content}</div>
            </div>
          `).join('')}
          
          <div class="footer">
            Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error: any) {
    console.error('[PDF Print] Error:', error);
    res.status(500).send('<html><body><h1>Error</h1><p>Failed to generate print view.</p></body></html>');
  }
});

export default router;
