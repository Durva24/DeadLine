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

interface EventUpdate {
  update_id: number;
  event_id: number;
  title: string;
  description: string;
  update_date: string;
}

interface UpdateRecord {
  event_id: number;
  title: string;
  description: string;
  update_date: string;
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

interface DebugInfo {
  event_fetch_time: number;
  google_search_time: number;
  groq_analysis_time: number;
  database_insert_time: number;
  total_processing_time: number;
  search_results_count: number;
  last_updated_date: string | null;
  days_since_last_update: number;
  insert_payload?: any;
  table_schema_check?: any;
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

// Helper function to check table schema
async function checkTableSchema(tableName: string) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    return {
      exists: !error,
      error: error?.message || null,
      sampleData: data
    };
  } catch (err) {
    return {
      exists: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      sampleData: null
    };
  }
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
    last_updated_date: null,
    days_since_last_update: 0
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

    // Step 2: Use last_updated from events table
    const lastUpdated = event.last_updated ? new Date(event.last_updated) : new Date(0);
    
    debugInfo.last_updated_date = lastUpdated.toISOString();
    debugInfo.days_since_last_update = Math.ceil((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));

    // Step 3: Search Google for recent information
    const googleSearchStart = Date.now();
    const searchResults = await searchGoogleForUpdates(event.query, lastUpdated);
    debugInfo.google_search_time = Date.now() - googleSearchStart;
    debugInfo.search_results_count = searchResults.length;
    
    if (searchResults.length === 0) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        message: 'No new updates found since last update',
        last_updated: lastUpdated.toISOString(),
        debug: debugInfo
      });
    }

    // Step 4: Analyze results with Groq
    const groqAnalysisStart = Date.now();
    const analysis = await analyzeWithGroq(searchResults, event.query);
    debugInfo.groq_analysis_time = Date.now() - groqAnalysisStart;
    
    if (!analysis) {
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'Failed to analyze search results',
        debug: debugInfo
      }, { status: 500 });
    }

    // Step 5: Check table schema before inserting
    debugInfo.table_schema_check = await checkTableSchema('event_updates');
    
    // Step 6: Insert new update into Supabase event_update table
    const dbInsertStart = Date.now();
    
    // Truncate strings to ensure they fit in database constraints
    const updateRecord: UpdateRecord = {
      event_id: event.event_id,
      title: analysis.title.substring(0, 100), // Ensure max 100 chars
      description: analysis.description.substring(0, 1000), // Ensure max 1000 chars
      update_date: new Date().toISOString()
    };

    debugInfo.insert_payload = updateRecord;

    console.log('Attempting to insert update record:', updateRecord);

    const { data: insertData, error: insertError } = await supabase
      .from('event_updates')
      .insert([updateRecord])
      .select();

    debugInfo.database_insert_time = Date.now() - dbInsertStart;

    if (insertError) {
      console.error('Insert error details:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      
      debugInfo.total_processing_time = Date.now() - startTime;
      return NextResponse.json({ 
        error: 'Failed to insert update',
        debug: debugInfo,
        supabase_error: {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        }
      }, { status: 500 });
    }

    console.log('Insert successful, data:', insertData);

    // Step 7: Update the last_updated field in events table
    const { error: updateError } = await supabase
      .from('events')
      .update({ last_updated: new Date().toISOString() })
      .eq('event_id', event.event_id);

    if (updateError) {
      console.error('Update events table error:', updateError);
      // Note: We don't return error here as the update was already inserted
      // but we log it for debugging
    }

    debugInfo.total_processing_time = Date.now() - startTime;

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Update created successfully',
      update: updateRecord,
      inserted_data: insertData,
      analysis: analysis,
      debug: debugInfo
    });

  } catch (error) {
    console.error('API Error:', error);
    debugInfo.total_processing_time = Date.now() - startTime;
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      debug: debugInfo
    }, { status: 500 });
  }
}

// GET endpoint - now supports query parameters
export async function GET(req: NextRequest) {
  try {
    const { event_id, api_key } = getRequestParams(req);
    
    if (!event_id || !api_key) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        message: 'event_id and api_key are required as query parameters',
        example: '/api/search/updates?event_id=1&api_key=your_api_key',
        received: { event_id, api_key: api_key ? '[REDACTED]' : null }
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

// POST endpoint - supports body parameters
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, api_key } = getRequestParams(req, body);
    
    if (!event_id || !api_key) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        message: 'event_id and api_key are required in request body or headers',
        received: { event_id, api_key: api_key ? '[REDACTED]' : null }
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
      dateRestrict: `d${daysSinceUpdate}`
    };

    console.log('Google Search Parameters:', {
      query,
      daysSinceUpdate,
      lastUpdated: lastUpdated.toISOString()
    });

    const response = await customSearch.cse.list(searchParams);
    
    if (!response.data.items) {
      console.log('No search results found');
      return [];
    }

    // Filter and format results
    const results: GoogleSearchResult[] = response.data.items
      .filter(item => item.title && item.snippet)
      .map(item => ({
        title: item.title!,
        snippet: item.snippet!,
        link: item.link!,
        publishedDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || 
                      item.pagemap?.metatags?.[0]?.['og:updated_time']
      }));

    console.log(`Found ${results.length} search results`);
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
Published: ${result.publishedDate || 'Unknown'}
---`
    ).join('\n\n');

    const analysisPrompt = `
Original Query: "${originalQuery}"

Search Results to Analyze:
${searchContent}

Please analyze these search results and provide insights about recent developments related to the original query.
`;

    console.log('Starting Groq analysis...');

    // Create analysis request with proper typing
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
      throw new Error('No response from Groq');
    }

    console.log('Groq analysis completed');
    const analysisResult = JSON.parse(completion.choices[0].message.content);
    
    // Validate the response structure
    if (!analysisResult.title || !analysisResult.description) {
      console.error('Invalid analysis response format:', analysisResult);
      throw new Error('Invalid analysis response format');
    }

    return analysisResult as GroqAnalysisResponse;
  } catch (error) {
    console.error('Groq Analysis Error:', error);
    return null;
  }
}