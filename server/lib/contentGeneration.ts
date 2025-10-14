import { GoogleGenAI } from "@google/genai";
import { DataForSeoCredentials, getSerpData, getContentGapKeywords } from "./dataForSeo";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ContentIdea {
  title: string;
  description: string;
  targetKeywords: string[];
  searchVolume: number;
  difficulty: string;
  contentType: string;
}

export interface ContentBrief {
  title: string;
  targetKeywords: string[];
  wordCount: number;
  outline: string[];
  tone: string;
  targetAudience: string;
  keyPoints: string[];
  competitorInsights: string;
}

export interface ContentOptimization {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  keywordOpportunities: string[];
  readabilityScore: number;
  seoRecommendations: string[];
}

export async function generateContentIdeas(
  credentials: DataForSeoCredentials,
  clientDomain: string,
  primaryKeyword: string,
  competitorUrls: string[],
  locationCode: number = 2840 // United States
): Promise<ContentIdea[]> {
  try {
    // Get content gap keywords from Data for SEO
    const contentGaps = await getContentGapKeywords(
      credentials,
      clientDomain,
      competitorUrls.slice(0, 3), // Limit to 3 competitors
      locationCode
    );

    // Get SERP data for competitor analysis
    const serpData = await getSerpData(
      credentials,
      primaryKeyword,
      "United States"
    );

    // Prepare context for Gemini
    const context = {
      primaryKeyword,
      relatedKeywords: contentGaps.slice(0, 20).map(gap => ({
        keyword: gap.keyword,
        searchVolume: gap.searchVolume,
        difficulty: gap.keyword_difficulty,
      })),
      topResults: serpData.items.slice(0, 10).map(item => ({
        title: item.title,
        url: item.url,
        description: item.description,
      })),
      competitorUrls,
    };

    const prompt = `As a content strategist, analyze the following keyword and SERP data to generate 5 compelling content ideas.

Primary Keyword: ${primaryKeyword}

Related Keywords: ${JSON.stringify(context.relatedKeywords.slice(0, 10), null, 2)}

Top Ranking Content: ${JSON.stringify(context.topResults, null, 2)}

Generate 5 unique content ideas that:
1. Target the primary keyword or closely related keywords
2. Fill content gaps in the current SERP
3. Provide unique angles or perspectives
4. Are optimized for search intent
5. Have commercial or informational value

Return ONLY a valid JSON array with this exact structure (no markdown, no code blocks, just the JSON):
[
  {
    "title": "Compelling article title",
    "description": "Brief description of the content angle (2-3 sentences)",
    "targetKeywords": ["primary keyword", "related keyword 1", "related keyword 2"],
    "searchVolume": estimated_monthly_searches,
    "difficulty": "Easy|Medium|Hard",
    "contentType": "How-to Guide|Listicle|Case Study|Comparison|Tutorial|Review"
  }
]`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    const responseText = result.text;
    
    if (!responseText) {
      throw new Error("No response from AI");
    }
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }

    const ideas: ContentIdea[] = JSON.parse(jsonMatch[0]);
    return ideas;
  } catch (error: any) {
    console.error("Content ideas generation error:", error);
    throw new Error(`Failed to generate content ideas: ${error.message}`);
  }
}

export async function generateContentBrief(
  topic: string,
  targetKeywords: string[],
  targetAudience: string,
  contentType: string,
  competitorUrls: string[]
): Promise<ContentBrief> {
  try {
    const prompt = `As a professional content strategist, create a comprehensive content brief for the following:

Topic: ${topic}
Target Keywords: ${targetKeywords.join(", ")}
Target Audience: ${targetAudience}
Content Type: ${contentType}
Competitor URLs: ${competitorUrls.join(", ")}

Create a detailed content brief that includes:
1. An optimized title
2. Recommended word count
3. A detailed outline with H2 and H3 headings
4. Tone and voice guidelines
5. Key points to cover
6. Insights from competitor analysis

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just the JSON):
{
  "title": "SEO-optimized article title",
  "targetKeywords": ["keyword1", "keyword2"],
  "wordCount": recommended_word_count_number,
  "outline": [
    "Introduction",
    "H2: Main Section 1",
    "  H3: Subsection 1.1",
    "  H3: Subsection 1.2",
    "H2: Main Section 2",
    "Conclusion"
  ],
  "tone": "Professional|Conversational|Academic|Friendly",
  "targetAudience": "Detailed audience description",
  "keyPoints": [
    "Key point 1 to emphasize",
    "Key point 2 to emphasize"
  ],
  "competitorInsights": "What competitors are doing well and gaps to fill"
}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    const responseText = result.text;
    
    if (!responseText) {
      throw new Error("No response from AI");
    }
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }

    const brief: ContentBrief = JSON.parse(jsonMatch[0]);
    return brief;
  } catch (error: any) {
    console.error("Content brief generation error:", error);
    throw new Error(`Failed to generate content brief: ${error.message}`);
  }
}

export async function optimizeContent(
  content: string,
  targetKeywords: string[],
  currentUrl?: string
): Promise<ContentOptimization> {
  try {

    const prompt = `As an SEO content expert, analyze the following content and provide optimization recommendations.

Content to analyze:
${content.substring(0, 10000)} ${content.length > 10000 ? '...(truncated)' : ''}

Target Keywords: ${targetKeywords.join(", ")}
${currentUrl ? `Current URL: ${currentUrl}` : ''}

Analyze the content for:
1. Overall SEO quality (score 0-100)
2. Strengths (what's working well)
3. Areas for improvement
4. Keyword optimization opportunities
5. Readability score (0-100)
6. Specific SEO recommendations

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks, just the JSON):
{
  "overallScore": score_0_to_100,
  "strengths": [
    "Strength 1",
    "Strength 2"
  ],
  "improvements": [
    "Specific improvement 1",
    "Specific improvement 2"
  ],
  "keywordOpportunities": [
    "Keyword opportunity 1",
    "Keyword opportunity 2"
  ],
  "readabilityScore": score_0_to_100,
  "seoRecommendations": [
    "SEO recommendation 1",
    "SEO recommendation 2"
  ]
}`;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt
    });
    const responseText = result.text;
    
    if (!responseText) {
      throw new Error("No response from AI");
    }
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from AI response");
    }

    const optimization: ContentOptimization = JSON.parse(jsonMatch[0]);
    return optimization;
  } catch (error: any) {
    console.error("Content optimization error:", error);
    throw new Error(`Failed to optimize content: ${error.message}`);
  }
}
