import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Types
interface Event {
  event_id: number;
  query: string;
  last_updated: string;
}

interface GoogleSearchResult {
  title: string;
  snippet: string;
  link: string;
  publishedDate?: string;
}

interface GroqAnalysisResponse {
  title: string;
  description: string;
  relevance_score: number;
  key_insights: string[];
  summary: string;
}

interface UpdateRecord {
  event_id: number;
  title: string;
  description: string;
  update_date: string;
}

interface DebugInfo {
  event_fetch_time: number;
  google_search_time: number;
  groq_analysis_time: number;
  database_insert_time: number;
  total_processing_time: number;
  search_results_count: number;
  filtered_results_count: number;
  last_updated_date: string | null;
  days_since_last_update: number;
  has_new_content: boolean;
}

// Initialize Google Custom Search API
const customSearch = google.customsearch('v1');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// System prompt for Groq analysis
const SYSTEM_PROMPT = `You are an expert content analyzer. Analyze the provided search results and create a structured update. 

Return your response in the following JSON format:
{
  "title": "Clear, concise title for the update (max 100 characters)",
  "description": "Detailed description of the key findings and insights (max 1000 characters)",
  "relevance_score": "Number between 0-10 indicating how relevant this information is",
  "key_insights": ["Array of 3-5 key insights or bullet points"],
  "summary": "Brief executive summary (max 200 characters)"
}

Focus on:
- Recent developments and changes
- Important trends or patterns
- Actionable insights
- Credible sources and data points`;

// Helper function to extract parameters from request
function getRequestParams(req: NextRequest, body?: any) {
  const url = new URL(req.url);
  
  // For GET requests, use query parameters
  if (req.method === 'GET') {
    return {
      event_id: url.searchParams.get('event_id'),
      api_key: url.searchParams.get('api_key') || req.headers.get('x-api-key')
    };
  }
  
  // For POST requests, use body parameters
  return {
    event_id: body?.event_id,
    api_key: req.headers.get('x-api-key') || body?.api_key
  };
}

// Helper function to parse and validate date
function parseArticleDate(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  
  try {
    // Try parsing various date formats
    const parsedDate = new Date(dateString);
    
    // Check if date is valid and not in the future
    if (isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
      return null;
    }
    
    return parsedDate;
  } catch (error) {
    return null;
  }
}

// Helper function to check if article is newer than last update
function isArticleNewer(articleDate: Date | null, lastUpdated: Date): boolean {
  if (!articleDate) return false;
  return articleDate > lastUpdated;
}

// Main processing function
async function processEventUpdate(event_id: string, apiKey: string) {
  const startTime = Date.now();
  const debugInfo: DebugInfo = {
    event_fetch_time: 0,
    google_search_time: 0,
    groq_analysis_time: 0,
    database_insert_time: 0,
    total_processing_time: 0,
    search_results_count: 0,
    filtered_results_count: 0,
    last_updated_date: null,
    days_since_last_update: 0,
    has_new_content: false
  };

  try {
    // Validate API key
    if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'Unauthorized: Invalid API key',
        debug: debugInfo
      }, { status: 401 });
    }

    // Validate required parameters
    if (!event_id) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'event_id is required',
        debug: debugInfo
      }, { status: 400 });
    }

    // Convert event_id to number for database operations
    const eventIdNumber = parseInt(event_id);
    if (isNaN(eventIdNumber)) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'event_id must be a valid number',
        debug: debugInfo
      }, { status: 400 });
    }

    // Step 1: Fetch event details from Supabase (including last_updated)
    const eventFetchStart = Date.now();
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('event_id, query, last_updated')
      .eq('event_id', eventIdNumber)
      .single();
    
    debugInfo.event_fetch_time = Date.now() - eventFetchStart;
    
    if (eventError || !eventData) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'Event not found',
        debug: debugInfo,
        supabase_error: eventError
      }, { status: 404 });
    }

    const event: Event = eventData;

    // Step 2: Get last_updated from events table
    const lastUpdated = event.last_updated ? new Date(event.last_updated) : new Date(0);
    
    debugInfo.last_updated_date = lastUpdated.toISOString();
    debugInfo.days_since_last_update = Math.ceil((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`Processing event ${event.event_id}: "${event.query}"`);
    console.log(`Last updated: ${lastUpdated.toISOString()}`);
    console.log(`Days since last update: ${debugInfo.days_since_last_update}`);

    // Step 3: Search Google for recent information
    const googleSearchStart = Date.now();
    const searchResults = await searchGoogleForUpdates(event.query, lastUpdated);
    debugInfo.google_search_time = Date.now() - googleSearchStart;
    debugInfo.search_results_count = searchResults.length;
    
    console.log(`Found ${searchResults.length} total search results`);

    // Step 4: Filter results to only include articles newer than last_updated
    const filteredResults = searchResults.filter(result => {
      const articleDate = parseArticleDate(result.publishedDate);
      return isArticleNewer(articleDate, lastUpdated);
    });

    debugInfo.filtered_results_count = filteredResults.length;
    debugInfo.has_new_content = filteredResults.length > 0;

    console.log(`Filtered to ${filteredResults.length} new articles after ${lastUpdated.toISOString()}`);

    // Step 5: Check if we have new content
    if (filteredResults.length === 0) {
      console.log('No new articles found - skipping analysis and database operations');
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        message: 'No new updates found since last update',
        last_updated: lastUpdated.toISOString(),
        total_search_results: searchResults.length,
        new_articles_found: 0,
        debug: debugInfo
      });
    }

    // Step 6: Analyze new results with Groq (only if we have new content)
    console.log(`Analyzing ${filteredResults.length} new articles with Groq`);
    const groqAnalysisStart = Date.now();
    const analysis = await analyzeWithGroq(filteredResults, event.query);
    debugInfo.groq_analysis_time = Date.now() - groqAnalysisStart;
    
    if (!analysis) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'Failed to analyze search results',
        debug: debugInfo
      }, { status: 500 });
    }

    // Step 7: Insert new update into Supabase event_updates table
    const dbInsertStart = Date.now();
    
    const updateRecord: UpdateRecord = {
      event_id: event.event_id,
      title: analysis.title.substring(0, 100), // Ensure max 100 chars
      description: analysis.description.substring(0, 1000), // Ensure max 1000 chars
      update_date: new Date().toISOString()
    };

    console.log('Inserting update record:', updateRecord);

    const { data: insertData, error: insertError } = await supabase
      .from('event_updates')
      .insert([updateRecord])
      .select();

    debugInfo.database_insert_time = Date.now() - dbInsertStart;

    if (insertError) {
      console.error('Insert error:', insertError);
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'Failed to insert update',
        debug: debugInfo,
        supabase_error: insertError
      }, { status: 500 });
    }

    // Step 8: Update the last_updated field in events table
    const { error: updateError } = await supabase
      .from('events')
      .update({ last_updated: new Date().toISOString() })
      .eq('event_id', event.event_id);

    if (updateError) {
      console.error('Error updating events table:', updateError);
      // Continue execution as the main update was successful
    }

    debugInfo.total_processing_time = Date.now() - startTime;

    console.log('Update process completed successfully');

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Update created successfully',
      update: updateRecord,
      analysis: analysis,
      new_articles_processed: filteredResults.length,
      total_search_results: searchResults.length,
      debug: debugInfo
    });

  } catch (error) {
    console.error('API Error:', error);
    debugInfo.total_processing_time = Date.now() - startTime;
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      debug: debugInfo
    }, { status: 500 });
  }
}

// GET endpoint
export async function GET(req: NextRequest) {
  try {
    const { event_id, api_key } = getRequestParams(req);
    
    if (!event_id || !api_key) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        message: 'event_id and api_key are required as query parameters',
        example: '/api/search/updates?event_id=1&api_key=your_api_key'
      }, { status: 400 });
    }

    return await processEventUpdate(event_id, api_key);
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, api_key } = getRequestParams(req, body);
    
    if (!event_id || !api_key) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        message: 'event_id and api_key are required in request body or headers'
      }, { status: 400 });
    }

    return await processEventUpdate(event_id, api_key);
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function searchGoogleForUpdates(
  query: string, 
  lastUpdated: Date
): Promise<GoogleSearchResult[]> {
  try {
    // Configure search parameters
    const daysSinceUpdate = Math.ceil((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    const searchParams = {
      key: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
      q: query,
      num: 10,
      sort: 'date',
      dateRestrict: `d${Math.max(daysSinceUpdate, 1)}` // Ensure at least 1 day
    };

    console.log('Google Search Parameters:', {
      query,
      daysSinceUpdate,
      lastUpdated: lastUpdated.toISOString(),
      dateRestrict: searchParams.dateRestrict
    });

    const response = await customSearch.cse.list(searchParams);
    
    if (!response.data.items) {
      console.log('No search results found from Google');
      return [];
    }

    // Format results with better date extraction
    const results: GoogleSearchResult[] = response.data.items
      .filter(item => item.title && item.snippet)
      .map(item => {
        // Try to extract published date from various metadata sources
        const publishedDate = 
          item.pagemap?.metatags?.[0]?.['article:published_time'] ||
          item.pagemap?.metatags?.[0]?.['og:updated_time'] ||
          item.pagemap?.metatags?.[0]?.['article:modified_time'] ||
          item.pagemap?.metatags?.[0]?.['pubdate'] ||
          item.pagemap?.metatags?.[0]?.['date'] ||
          item.pagemap?.newsarticle?.[0]?.datepublished ||
          item.pagemap?.article?.[0]?.datepublished;

        return {
          title: item.title!,
          snippet: item.snippet!,
          link: item.link!,
          publishedDate: publishedDate
        };
      });

    console.log(`Retrieved ${results.length} search results from Google`);
    return results;
  } catch (error) {
    console.error('Google Search Error:', error);
    return [];
  }
}

async function analyzeWithGroq(
  searchResults: GoogleSearchResult[],
  originalQuery: string
): Promise<GroqAnalysisResponse | null> {
  try {
    // Prepare content for analysis
    const searchContent = searchResults.map((result, index) => 
      `Result ${index + 1}:
Title: ${result.title}
Content: ${result.snippet}
Source: ${result.link}
Published: ${result.publishedDate || 'Date not available'}
---`
    ).join('\n\n');

    const analysisPrompt = `
Original Query: "${originalQuery}"

Recent Search Results to Analyze:
${searchContent}

Please analyze these recent search results and provide insights about new developments related to the original query.
`;

    console.log('Starting Groq analysis for new content...');

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system" as const,
          content: SYSTEM_PROMPT
        },
        {
          role: "user" as const,
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    if (!completion.choices?.[0]?.message?.content) {
      console.error('No response from Groq');
      return null;
    }

    const analysisResult = JSON.parse(completion.choices[0].message.content);
    
    // Validate the response structure
    if (!analysisResult.title || !analysisResult.description) {
      console.error('Invalid analysis response format:', analysisResult);
      return null;
    }

    console.log('Groq analysis completed successfully');
    return analysisResult as GroqAnalysisResponse;
  } catch (error) {
    console.error('Groq Analysis Error:', error);
    return null;
  }
}