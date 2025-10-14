import { GoogleGenAI } from '@google/genai';
import { 
  getOnPageAnalysis, 
  DataForSeoCredentials,
  CompetitorAnalysis
} from '../lib/dataForSeo';

export interface OnPageTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'technical' | 'keywords' | 'meta';
}

export interface OnPageAuditResult {
  url: string;
  aiSummary: string;
  onPageTasks: OnPageTask[];
  technicalMetrics: {
    wordCount: number;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    metaDescription?: string;
    metaDescriptionLength?: number;
    title?: string;
    titleLength?: number;
  };
  rawAnalysis?: CompetitorAnalysis;
}

export class OnPageSeoAuditService {
  private genAI: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    this.genAI = new GoogleGenAI({ apiKey });
  }

  /**
   * Run on-page SEO audit using Data for SEO
   */
  async runOnPageAudit(
    url: string,
    dataForSeoCredentials: DataForSeoCredentials
  ): Promise<OnPageAuditResult> {
    // Get on-page analysis from Data for SEO
    const onPageAnalysis = await getOnPageAnalysis(dataForSeoCredentials, url);

    // Extract technical metrics
    const technicalMetrics = {
      wordCount: onPageAnalysis.word_count,
      h1Count: onPageAnalysis.headings.h1.length,
      h2Count: onPageAnalysis.headings.h2.length,
      h3Count: onPageAnalysis.headings.h3.length,
      metaDescription: onPageAnalysis.meta_description,
      metaDescriptionLength: onPageAnalysis.meta_description?.length,
      title: onPageAnalysis.title,
      titleLength: onPageAnalysis.title?.length,
    };

    // Generate AI-powered recommendations
    const { summary, tasks } = await this.generateAIRecommendations(url, onPageAnalysis);

    return {
      url,
      aiSummary: summary,
      onPageTasks: tasks,
      technicalMetrics,
      rawAnalysis: onPageAnalysis,
    };
  }

  /**
   * Generate AI-powered summary and actionable tasks
   */
  private async generateAIRecommendations(
    url: string,
    analysis: CompetitorAnalysis
  ): Promise<{ summary: string; tasks: OnPageTask[] }> {
    const prompt = `You are an SEO expert analyzing a website for on-page optimization opportunities.

URL: ${url}

Technical Metrics:
- Word Count: ${analysis.word_count}
- Title: "${analysis.title || 'Missing'}" (${analysis.title?.length || 0} characters)
- Meta Description: "${analysis.meta_description || 'Missing'}" (${analysis.meta_description?.length || 0} characters)
- H1 Headings: ${analysis.headings.h1.length} (${analysis.headings.h1.join(', ') || 'None'})
- H2 Headings: ${analysis.headings.h2.length}
- H3 Headings: ${analysis.headings.h3.length}

Please provide:

1. A brief 2-3 sentence summary of the current SEO state of this page

2. A prioritized list of 5-8 specific, actionable on-page SEO tasks that need to be completed. For each task, provide:
   - A clear title (8-12 words max)
   - A detailed description of what needs to be done
   - Priority (high/medium/low)
   - Category (content/technical/keywords/meta)

Focus on the most impactful improvements based on SEO best practices.

Return your response in this exact JSON format:
{
  "summary": "Your 2-3 sentence summary here",
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description of what to do",
      "priority": "high|medium|low",
      "category": "content|technical|keywords|meta"
    }
  ]
}`;

    const result = await this.genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt
    });
    
    const responseText = result.text;
    
    if (!responseText) {
      throw new Error('No response from AI model');
    }
    
    // Extract JSON from response (handling markdown code blocks)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }

    const aiResponse = JSON.parse(jsonText);

    // Add unique IDs to tasks
    const tasks: OnPageTask[] = aiResponse.tasks.map((task: any, index: number) => ({
      id: `task-${index + 1}`,
      title: task.title,
      description: task.description,
      priority: task.priority,
      category: task.category,
    }));

    return {
      summary: aiResponse.summary,
      tasks,
    };
  }
}
