import type { IStorage } from "../../storage";

interface PrintTokenPayload {
  userId: string;
  agencyId: string;
  role: string;
}

interface ProposalPrintDeps {
  generatePrintToken: (proposalId: string, userId: string, agencyId: string, role: string) => Promise<string>;
  validatePrintToken: (token: string, proposalId: string) => Promise<PrintTokenPayload | null>;
  parseMarkdown: (input: string) => Promise<string>;
  now: () => Date;
}

const defaultDeps: ProposalPrintDeps = {
  generatePrintToken: (...args) => {
    return import("../../lib/print-tokens").then((mod) => mod.generatePrintToken(...args));
  },
  validatePrintToken: (...args) => {
    return import("../../lib/print-tokens").then((mod) => mod.validatePrintToken(...args) as PrintTokenPayload | null);
  },
  parseMarkdown: async (input) => {
    const { marked } = await import("marked");
    return marked.parse(input) as string;
  },
  now: () => new Date(),
};

export interface ProposalPrintResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export class ProposalPrintService {
  constructor(private readonly storage: IStorage, private readonly deps: ProposalPrintDeps = defaultDeps) {}

  async createPrintToken(input: {
    proposalId: string;
    userId?: string;
    agencyId?: string;
    role?: string;
  }): Promise<ProposalPrintResult<{ token: string }>> {
    const proposal = await this.storage.getProposalById(input.proposalId);
    if (!proposal) {
      return { ok: false, status: 404, error: "Proposal not found" };
    }

    if (!input.agencyId || proposal.agencyId !== input.agencyId) {
      return { ok: false, status: 403, error: "You do not have permission to access this proposal" };
    }

    if (input.role !== "Admin") {
      return { ok: false, status: 403, error: "Only admins can export proposals" };
    }

    if (!input.userId) {
      return { ok: false, status: 403, error: "Unauthorized" };
    }

    const token = await this.deps.generatePrintToken(input.proposalId, input.userId, input.agencyId, input.role);
    return { ok: true, status: 200, data: { token } };
  }

  async renderPrintView(input: { proposalId: string; token?: string }): Promise<ProposalPrintResult<{ html: string }>> {
    if (!input.token) {
      return {
        ok: false,
        status: 401,
        error: '<html><body><h1>Unauthorized</h1><p>Print token required.</p></body></html>',
      };
    }

    const tokenData = await this.deps.validatePrintToken(input.token, input.proposalId);
    if (!tokenData) {
      return {
        ok: false,
        status: 401,
        error: '<html><body><h1>Unauthorized</h1><p>Invalid or expired print token.</p></body></html>',
      };
    }

    const proposal = await this.storage.getProposalById(input.proposalId);
    if (!proposal) {
      return {
        ok: false,
        status: 404,
        error: '<html><body><h1>Not Found</h1><p>Proposal not found.</p></body></html>',
      };
    }

    if (proposal.agencyId !== tokenData.agencyId) {
      return {
        ok: false,
        status: 403,
        error: '<html><body><h1>Forbidden</h1><p>Invalid print token for this proposal.</p></body></html>',
      };
    }

    const sections = await this.storage.getProposalSectionsByProposalId(input.proposalId);
    const deal = await this.storage.getDealById(proposal.dealId);
    let contact: any = null;
    if (deal?.contactId) {
      contact = await this.storage.getContactById(deal.contactId);
    }

    const processedSections = [] as Array<{ title: string; content: string }>;
    for (const section of sections) {
      processedSections.push({
        title: section.title,
        content: await this.deps.parseMarkdown(section.content),
      });
    }

    const now = this.deps.now();
    const html = this.buildPrintHtml({ proposal, contact, processedSections, now });
    return { ok: true, status: 200, data: { html } };
  }

  private buildPrintHtml(input: {
    proposal: any;
    contact: any;
    processedSections: Array<{ title: string; content: string }>;
    now: Date;
  }): string {
    const { proposal, contact, processedSections, now } = input;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${proposal.name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 60px 80px; max-width: 1000px; margin: 0 auto; }
            .print-button { position: fixed; top: 20px; right: 20px; background: #0a84ff; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
            .header { margin-bottom: 60px; padding-bottom: 30px; border-bottom: 3px solid #0a84ff; }
            .proposal-title { font-size: 36px; font-weight: 700; margin-bottom: 12px; color: #0a84ff; }
            .meta-info { font-size: 14px; color: #666; }
            .client-info { margin-bottom: 40px; padding: 20px; background: #f5f5f7; border-radius: 8px; }
            .section { margin-bottom: 40px; page-break-inside: avoid; }
            .section-title { font-size: 24px; font-weight: 600; margin-bottom: 16px; }
            .section-content { font-size: 14px; line-height: 1.8; }
            .footer { margin-top: 80px; padding-top: 30px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px; }
            @media print { .print-button { display: none; } }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">Print to PDF</button>
          <div class="header">
            <h1 class="proposal-title">${proposal.name}</h1>
            <div class="meta-info">Status: <strong>${proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}</strong> |
              Created: ${new Date(proposal.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          ${contact ? `
          <div class="client-info">
            <h3>Prepared For:</h3>
            <div>${contact.firstName} ${contact.lastName}</div>
            ${contact.email ? `<div>${contact.email}</div>` : ''}
            ${contact.phone ? `<div>${contact.phone}</div>` : ''}
          </div>` : ''}
          ${processedSections
            .map(
              (section) => `
            <div class="section">
              <h2 class="section-title">${section.title}</h2>
              <div class="section-content">${section.content}</div>
            </div>`
            )
            .join('')}
          <div class="footer">Generated on ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </body>
      </html>
    `;
  }
}
