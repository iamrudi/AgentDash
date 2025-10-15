import swaggerJsdoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agency Client Portal API',
      version: '1.0.0',
      description: `
        A comprehensive multi-tenant agency management platform API.
        
        ## Features
        - Multi-tenant architecture with strict tenant isolation
        - Role-based access control (Admin, Staff, Client)
        - Google Analytics 4 & Search Console integration
        - AI-powered recommendations using Google Gemini
        - Project & task management
        - Invoice automation
        - Real-time chat with Server-Sent Events
        - SEO audit tools
        - Content generation capabilities
        
        ## Authentication
        All endpoints require authentication via session cookies set by Supabase Auth.
        
        ## Rate Limiting
        - General API: 100 requests per 15 minutes
        - Authentication: 5 requests per 15 minutes
        - AI endpoints: 20 requests per hour
      `,
      contact: {
        name: 'API Support',
        email: 'support@agencyportal.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://your-production-domain.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
          description: 'Session cookie set by Supabase Auth'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        Client: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            companyName: { type: 'string' },
            profileId: { type: 'string', format: 'uuid' },
            agencyId: { type: 'string', format: 'uuid' },
            businessContext: { type: 'string', nullable: true },
            retainerAmount: { type: 'string', nullable: true },
            billingDay: { type: 'integer', nullable: true },
            leadValue: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { 
              type: 'string',
              enum: ['Active', 'Completed', 'On Hold']
            },
            clientId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date', nullable: true },
            endDate: { type: 'string', format: 'date', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: {
              type: 'string',
              enum: ['Not Started', 'In Progress', 'Completed', 'Blocked']
            },
            priority: {
              type: 'string',
              enum: ['Low', 'Medium', 'High']
            },
            projectId: { type: 'string', format: 'uuid' },
            dueDate: { type: 'string', format: 'date', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        StrategicInitiative: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            status: {
              type: 'string',
              enum: ['Needs Review', 'Awaiting Approval', 'Approved', 'In Progress', 'Completed', 'Measured', 'Rejected']
            },
            clientId: { type: 'string', format: 'uuid' },
            category: { type: 'string', nullable: true },
            priority: { type: 'string', nullable: true },
            estimatedImpact: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string' },
            totalAmount: { type: 'string' },
            status: {
              type: 'string',
              enum: ['Draft', 'Due', 'Paid', 'Overdue']
            },
            issueDate: { type: 'string', format: 'date' },
            dueDate: { type: 'string', format: 'date' },
            pdfUrl: { type: 'string', nullable: true },
            clientId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [
      {
        cookieAuth: []
      }
    ]
  },
  apis: ['./server/routes.ts', './server/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
