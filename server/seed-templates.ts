import { db } from "./db";
import * as schema from "../shared/schema";

async function seedTemplates() {
  console.log("Seeding proposal templates...");

  try {
    // Find the first agency to associate the templates with
    const agencies = await db.select().from(schema.agencies).limit(1);
    
    if (agencies.length === 0) {
      console.log("❌ No agencies found. Please create an agency first.");
      process.exit(1);
    }

    const agencyId = agencies[0].id;
    console.log(`Found agency: ${agencyId}`);

    const templates = [
      // --- Core Templates ---
      {
        name: 'Introduction',
        category: 'Core',
        content: `## Introduction\n\nHello {{contact.firstName}},\n\nThank you for the opportunity to present this proposal. Based on our recent discussions, we've developed a comprehensive strategy designed to help {{client.name}} achieve its digital marketing objectives. We are confident that our partnership will drive significant growth and a strong return on investment.`,
      },
      {
        name: 'Our Understanding of Your Needs',
        category: 'Core',
        content: `## Our Understanding of Your Needs\n\nWe understand that {{client.name}} is looking to achieve the following key goals:\n\n- **Goal 1:** [Describe the client's primary goal]\n- **Goal 2:** [Describe the client's secondary goal]\n- **Goal 3:** [Describe another client objective]\n\nThis proposal directly addresses these objectives with a targeted, data-driven approach.`,
      },
      {
        name: 'Executive Summary',
        category: 'Core',
        content: `## Executive Summary\n\nThis proposal outlines a strategic partnership with {{client.name}} to enhance online visibility and lead generation through a targeted digital marketing campaign. The total investment for this scope of work is **{{deal.value}}**. We project that these efforts will lead to measurable improvements in key performance indicators within the first quarter.`,
      },

      // --- Service Templates ---
      {
        name: 'Scope of Work: SEO',
        category: 'Services',
        content: `## Scope of Work: Search Engine Optimization (SEO)\n\nOur SEO strategy is designed to increase organic traffic and improve search engine rankings for your most valuable keywords.\n\n### Phase 1: Technical Audit & On-Page Optimization\n- Comprehensive website audit to identify technical issues.\n- Keyword research and mapping.\n- On-page optimization of meta titles, descriptions, and headers.\n- Schema markup implementation.\n\n### Phase 2: Content & Link Building\n- Monthly blog content creation (4-6 posts).\n- Strategic link building campaign.\n- Local SEO optimization (if applicable).\n\n### Phase 3: Monitoring & Reporting\n- Monthly ranking reports.\n- Quarterly strategy reviews.`,
      },
      {
        name: 'Scope of Work: PPC',
        category: 'Services',
        content: `## Scope of Work: Pay-Per-Click (PPC)\n\nOur PPC campaign will focus on driving immediate, qualified traffic to your website to generate leads.\n\n- **Campaign Setup:** Creation of campaigns on Google Ads and LinkedIn.\n- **Ad Copy & Creatives:** A/B testing of ad copy and visuals.\n- **Management:** Daily monitoring, bid management, and budget optimization.\n- **Reporting:** A monthly performance report detailing CPL, CPA, and ROAS.`,
      },
      {
        name: 'Scope of Work: Content Marketing',
        category: 'Services',
        content: `## Scope of Work: Content Marketing\n\nOur content strategy will position {{client.name}} as a thought leader in your industry.\n\n### Content Creation\n- 4-6 high-quality blog posts per month\n- Industry reports and whitepapers\n- Case studies and success stories\n\n### Content Distribution\n- Social media promotion\n- Email newsletter campaigns\n- Strategic guest posting\n\n### Performance Tracking\n- Content engagement metrics\n- Lead attribution analysis\n- Monthly content performance reports`,
      },

      // --- Pricing & Legal Templates ---
      {
        name: 'Pricing Table',
        category: 'Pricing',
        content: `## Investment\n\n| Service                  | Monthly Cost |\n| ------------------------ | :----------: |\n| SEO Services             |    $1,500    |\n| PPC Management (excl. ad spend) |     $750     |\n| **Total** |  **$2,250** |`,
      },
      {
        name: 'Timeline & Deliverables',
        category: 'Pricing',
        content: `## Timeline & Deliverables\n\n- **Month 1:** Technical SEO audit report, keyword strategy document.\n- **Month 2:** First two blog posts published, PPC campaigns launched.\n- **Month 3:** Monthly performance report, strategy review meeting.`,
      },
      {
        name: 'Terms & Conditions',
        category: 'Legal',
        content: `## Terms & Conditions\n\n- This proposal is valid for 30 days.\n- Invoices will be sent on the 1st of each month and are due on a NET 15 basis.\n- Either party may terminate this agreement with 30 days written notice.\n- All work produced will be the intellectual property of {{client.name}} upon receipt of final payment.`,
      },
      {
        name: 'Next Steps',
        category: 'Core',
        content: `## Next Steps\n\nWe're excited about the opportunity to partner with {{client.name}}. To move forward:\n\n1. **Review this proposal** and share any questions or feedback.\n2. **Schedule a kick-off call** to finalize details and timelines.\n3. **Sign the agreement** to officially begin our partnership.\n\nWe look forward to helping you achieve your business goals!`,
      },
    ];

    // Insert templates into the database
    await db
      .insert(schema.proposalTemplates)
      .values(templates.map(t => ({ ...t, agencyId })))
      .onConflictDoNothing(); // Prevents duplicates if seed is run again

    console.log(`✅ Successfully seeded ${templates.length} proposal templates!`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to seed templates:", error);
    process.exit(1);
  }
}

seedTemplates();
