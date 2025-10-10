import { storage } from "./storage";

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
