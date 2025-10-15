import { storage } from "./storage";
import { db } from "./db";
import * as schema from "../shared/schema";

async function seed() {
  console.log("Starting database seed...");

  try {
    // Create admin user
    const adminUser = await storage.createUser({
      email: "admin@agency.com",
      password: "admin123",
    });

    const adminProfile = await storage.createProfile({
      userId: adminUser.id,
      fullName: "Admin User",
      role: "Admin",
    });

    // Create client user
    const clientUser = await storage.createUser({
      email: "client@company.com",
      password: "client123",
    });

    const clientProfile = await storage.createProfile({
      userId: clientUser.id,
      fullName: "John Doe",
      role: "Client",
    });

    const client = await storage.createClient({
      companyName: "Acme Corporation",
      profileId: clientProfile.id,
    });

    // Create staff user
    const staffUser = await storage.createUser({
      email: "staff@agency.com",
      password: "staff123",
    });

    const staffProfile = await storage.createProfile({
      userId: staffUser.id,
      fullName: "Jane Smith",
      role: "Staff",
    });

    // Create projects
    const project1 = await storage.createProject({
      name: "Website Redesign",
      status: "Active",
      description: "Complete redesign of company website with modern UI/UX",
      clientId: client.id,
    });

    const project2 = await storage.createProject({
      name: "SEO Optimization",
      status: "Active",
      description: "Improve search engine rankings and organic traffic",
      clientId: client.id,
    });

    const project3 = await storage.createProject({
      name: "Social Media Campaign",
      status: "Pending",
      description: "Q1 social media marketing campaign across all platforms",
      clientId: client.id,
    });

    // Create tasks
    const task1 = await storage.createTask({
      description: "Design homepage mockups",
      status: "In Progress",
      dueDate: "2025-11-15",
      priority: "High",
      projectId: project1.id,
    });

    const task2 = await storage.createTask({
      description: "Implement responsive navigation",
      status: "Pending",
      dueDate: "2025-11-20",
      priority: "High",
      projectId: project1.id,
    });

    const task3 = await storage.createTask({
      description: "Keyword research and analysis",
      status: "Completed",
      dueDate: "2025-10-30",
      priority: "Medium",
      projectId: project2.id,
    });

    const task4 = await storage.createTask({
      description: "Optimize meta descriptions",
      status: "In Progress",
      dueDate: "2025-11-10",
      priority: "Medium",
      projectId: project2.id,
    });

    // Create staff assignments
    await storage.createStaffAssignment({
      taskId: task1.id,
      staffProfileId: staffProfile.id,
    });

    await storage.createStaffAssignment({
      taskId: task2.id,
      staffProfileId: staffProfile.id,
    });

    await storage.createStaffAssignment({
      taskId: task4.id,
      staffProfileId: staffProfile.id,
    });

    // Create invoices
    await storage.createInvoice({
      invoiceNumber: "INV-2025-001",
      amount: "5000.00",
      status: "Paid",
      dueDate: "2025-10-01",
      pdfUrl: "/invoices/inv-2025-001.pdf",
      clientId: client.id,
    });

    await storage.createInvoice({
      invoiceNumber: "INV-2025-002",
      amount: "7500.00",
      status: "Pending",
      dueDate: "2025-11-15",
      pdfUrl: "/invoices/inv-2025-002.pdf",
      clientId: client.id,
    });

    await storage.createInvoice({
      invoiceNumber: "INV-2025-003",
      amount: "3200.00",
      status: "Overdue",
      dueDate: "2025-10-25",
      pdfUrl: "/invoices/inv-2025-003.pdf",
      clientId: client.id,
    });

    // Create recommendations
    await storage.createRecommendation({
      title: "Implement A/B Testing for Landing Pages",
      observation: "Current landing page conversion rate is 2.3%, below industry average of 3.5%",
      proposedAction: "Set up A/B testing framework to test different headlines, CTAs, and layouts",
      status: "Draft",
      cost: "2500.00",
      impact: "High",
      clientId: client.id,
      sentToClient: "false",
      clientResponse: null,
      clientFeedback: null,
    });

    await storage.createRecommendation({
      title: "Expand Google Ads Budget",
      observation: "Current campaigns have 8.2% CTR and $3.50 CPA, significantly outperforming benchmarks",
      proposedAction: "Increase monthly Google Ads budget by 50% to capitalize on high-performing campaigns",
      status: "Sent",
      cost: "15000.00",
      impact: "High",
      clientId: client.id,
      sentToClient: "true",
      clientResponse: "pending",
      clientFeedback: null,
    });

    await storage.createRecommendation({
      title: "Add Live Chat Support",
      observation: "30% of website visitors spend more than 3 minutes on product pages without converting",
      proposedAction: "Implement live chat widget to provide real-time assistance and answer questions",
      status: "Approved",
      cost: "1200.00",
      impact: "Medium",
      clientId: client.id,
      sentToClient: "true",
      clientResponse: "approved",
      clientFeedback: "This sounds great! Let's proceed with the implementation.",
    });

    // Create daily metrics (last 30 days)
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      await storage.createMetric({
        date: date.toISOString().split('T')[0],
        clientId: client.id,
        source: "Google Ads",
        sessions: Math.floor(Math.random() * 500) + 300,
        conversions: Math.floor(Math.random() * 30) + 10,
        impressions: Math.floor(Math.random() * 10000) + 5000,
        clicks: Math.floor(Math.random() * 800) + 400,
        spend: (Math.random() * 1000 + 500).toFixed(2),
      });

      await storage.createMetric({
        date: date.toISOString().split('T')[0],
        clientId: client.id,
        source: "Facebook Ads",
        sessions: Math.floor(Math.random() * 300) + 200,
        conversions: Math.floor(Math.random() * 20) + 5,
        impressions: Math.floor(Math.random() * 8000) + 4000,
        clicks: Math.floor(Math.random() * 600) + 300,
        spend: (Math.random() * 800 + 300).toFixed(2),
      });
    }

    // =================================================================
    // START: Add Proposal Template Seeding Logic
    // =================================================================
    console.log('Seeding proposal templates...');

    // Find the first agency to associate the templates with
    const agencies = await db.select().from(schema.agencies).limit(1);
    if (agencies.length === 0) {
      console.log('No agencies found. Skipping proposal template seeding.');
    } else {
      const agencyId = agencies[0].id;

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
        {
          name: 'Next Steps',
          category: 'Core',
          content: `## Next Steps\n\nWe're excited about the opportunity to partner with {{client.name}}. To move forward:\n\n1. **Review this proposal** and share any questions or feedback.\n2. **Schedule a kick-off call** to finalize details and timelines.\n3. **Sign the agreement** to officially begin our partnership.\n\nWe look forward to helping you achieve your business goals!`,
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
      ];

      // Insert templates into the database
      await db
        .insert(schema.proposalTemplates)
        .values(templates.map(t => ({ ...t, agencyId })))
        .onConflictDoNothing(); // Prevents duplicates if seed is run again
        
      console.log(`Seeded ${templates.length} proposal templates for agency ${agencyId}.`);
    }
    // =================================================================
    // END: Add Proposal Template Seeding Logic
    // =================================================================

    console.log("✅ Database seeded successfully!");
    console.log("\nTest accounts:");
    console.log("Admin: admin@agency.com / admin123");
    console.log("Client: client@company.com / client123");
    console.log("Staff: staff@agency.com / staff123");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
