import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';

// Use server-side only environment variables (no NEXT_PUBLIC_ prefix)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const API_SECRET_KEY = process.env.API_SECRET_KEY;

// Types
interface EventDetails {
  location: string;
  details: string;
  accused: string[];
  victims: string[];
  timeline: string[];
  sources: string[];
  images: string[];
}

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
}

interface ScrapedArticle {
  url: string;
  title: string;
  content: string;
  publishDate?: string;
  author?: string;
  source: string;
}

interface ScrapedData {
  results: GoogleSearchResult[];
  articles: ScrapedArticle[];
  images: string[];
}

// Enhanced JSON template for comprehensive detailed extraction
const EVENT_DETAILS_TEMPLATE = {
  location: "string - Detailed location information including city, state/province, country, specific venues, addresses, and geographical context",
  details: "string - Comprehensive detailed narrative of what happened, including background context, sequence of events, circumstances leading up to the incident, what specifically occurred, immediate aftermath, ongoing developments, legal proceedings, investigations, evidence found, witness testimonies, official statements, media coverage details, public reactions, and all significant aspects of the event",
  accused: ["array of strings - Full names of all accused parties, suspects, defendants, organizations, companies, or entities involved, including their roles, positions, backgrounds, and relationship to the incident"],
  victims: ["array of strings - Full names and detailed information about all victims, affected parties, casualties, injured persons, including their ages, backgrounds, conditions, and impact suffered"],
  timeline: ["array of strings - Comprehensive chronological sequence of events with specific dates, times, and detailed descriptions of what happened at each stage, including pre-incident events, the main incident phases, immediate response, investigation milestones, legal proceedings, and ongoing developments"]
};

// Utility Functions
function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

function isHTMLResponse(response: string): boolean {
  return response.trim().toLowerCase().startsWith('<!doctype') || 
         response.trim().toLowerCase().startsWith('<html');
}

// Enhanced content extraction - increased size for more details
function extractArticleContent(html: string, url: string): ScrapedArticle {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Extract title
  const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Extract meta description
  const metaDescMatch = cleanHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const metaContent = metaDescMatch ? metaDescMatch[1] : '';
  
  // Extract text content from common article tags
  const articleMatches = cleanHtml.match(/<(?:article|main|div[^>]*class=["'][^"']*(?:content|article|post|story|news)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:article|main|div)>/gi);
  let content = '';
  
  if (articleMatches && articleMatches.length > 0) {
    const longestMatch = articleMatches.reduce((a, b) => a.length > b.length ? a : b);
    content = longestMatch.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Fallback: extract paragraph content
  if (!content || content.length < 200) {
    const paragraphs = cleanHtml.match(/<p[^>]*>([^<]+)<\/p>/gi);
    if (paragraphs) {
      content = paragraphs.map(p => p.replace(/<[^>]*>/g, '')).join(' ').trim();
    }
  }
  
  // Enhanced: extract div content with text
  if (!content || content.length < 200) {
    const divMatches = cleanHtml.match(/<div[^>]*>([^<]*(?:<[^\/][^>]*>[^<]*<\/[^>]*>[^<]*)*)<\/div>/gi);
    if (divMatches) {
      const textContent = divMatches.map(div => div.replace(/<[^>]*>/g, ' ')).join(' ').trim();
      if (textContent.length > content.length) {
        content = textContent;
      }
    }
  }
  
  // Final fallback: use meta description
  if (!content || content.length < 100) {
    content = metaContent;
  }
  
  const source = new URL(url).hostname.replace('www.', '');
  
  return {
    url,
    title,
    content: content.substring(0, 4000), // Increased from 2000 to 4000 characters for more detail
    publishDate: '',
    author: '',
    source
  };
}

// Enhanced scraping with longer timeout for better content extraction
async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // Increased from 8 to 12 seconds
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    return extractArticleContent(html, url);
    
  } catch (error) {
    console.warn(`Error scraping ${url}:`, error);
    return null;
  }
}

// Enhanced image search with better filtering
async function searchImages(query: string): Promise<string[]> {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    console.warn('Google API credentials not configured for image search');
    return [];
  }

  try {
    console.log('Searching for images...');
    
    const imageSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active&imgSize=medium`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const imageResponse = await fetch(imageSearchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);

    if (!imageResponse.ok) {
      console.warn(`Image search failed with status: ${imageResponse.status}`);
      return [];
    }

    const imageResponseText = await imageResponse.text();
    
    if (!isValidJSON(imageResponseText) || isHTMLResponse(imageResponseText)) {
      console.warn('Invalid JSON response from image search');
      return [];
    }

    const imageData = JSON.parse(imageResponseText);
    
    if (imageData.error) {
      console.warn('Image search API error:', imageData.error);
      return [];
    }

    if (!imageData.items || !Array.isArray(imageData.items)) {
      console.warn('No image items found in response');
      return [];
    }

    const imageLinks = imageData.items
      .map((item: any) => item.link)
      .filter(Boolean)
      .filter((link: string) => {
        const url = link.toLowerCase();
        return !url.includes('favicon') && 
               !url.includes('/logo') && 
               !url.includes('/icon') &&
               (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || 
                url.includes('.webp') || url.includes('.gif') || url.includes('image'));
      })
      .slice(0, 10); // Increased from 8 to 10

    console.log(`Found ${imageLinks.length} valid image links`);
    return imageLinks;

  } catch (error) {
    console.warn('Image search error:', error);
    return [];
  }
}

// Enhanced Google Search - increased results for more comprehensive data
async function searchGoogleAndScrape(query: string): Promise<ScrapedData> {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured');
  }

  try {
    const allResults: GoogleSearchResult[] = [];

    // Increased from 2 to 3 batches to get 30 results for more comprehensive coverage
    for (let page = 1; page <= 3; page++) {
      const startIndex = (page - 1) * 10 + 1;
      
      const webSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10&start=${startIndex}`;
      
      console.log(`Making web search request for page ${page}...`);
      
      try {
        const webResponse = await fetch(webSearchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!webResponse.ok) {
          console.warn(`Web search page ${page} failed:`, webResponse.status);
          continue;
        }

        const webResponseText = await webResponse.text();
        
        if (isHTMLResponse(webResponseText) || !isValidJSON(webResponseText)) {
          console.warn(`Invalid response for page ${page}, skipping`);
          continue;
        }

        const webData = JSON.parse(webResponseText);

        if (webData.error) {
          console.warn(`API error on page ${page}:`, webData.error);
          continue;
        }

        const pageResults: GoogleSearchResult[] = webData.items?.map((item: any) => ({
          title: item.title || 'No title',
          link: item.link || '',
          snippet: item.snippet || 'No snippet available',
          displayLink: item.displayLink || '',
        })) || [];

        allResults.push(...pageResults);
        console.log(`Page ${page}: Found ${pageResults.length} results`);

        if (page < 3) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.warn(`Error on page ${page}:`, error);
        continue;
      }
    }

    console.log(`Total search results: ${allResults.length}`);

    // Filter results and remove duplicates
    const filteredResults = allResults.filter((result, index, self) => {
      const isDuplicate = index !== self.findIndex(r => r.link === result.link);
      if (isDuplicate) return false;
      
      const url = result.link.toLowerCase();
      const domain = result.displayLink?.toLowerCase() || '';
      
      const excludeDomains = ['reddit.com', 'twitter.com', 'facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'pinterest.com'];
      const isExcluded = excludeDomains.some(excluded => domain.includes(excluded) || url.includes(excluded));
      
      return !isExcluded && result.title && result.snippet;
    });

    console.log(`Filtered to ${filteredResults.length} valid results`);

    // Increased from 12 to 18 articles to scrape for more comprehensive analysis
    const articlesToScrape = filteredResults.slice(0, 18);
    console.log(`Scraping content from ${articlesToScrape.length} articles...`);
    
    const scrapePromises = articlesToScrape.map(result => scrapeArticle(result.link));
    const scrapedArticles = await Promise.allSettled(scrapePromises);
    
    const successfulArticles: ScrapedArticle[] = scrapedArticles
      .filter((result): result is PromiseFulfilledResult<ScrapedArticle> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter(article => article.content.length > 100); // Increased minimum content length

    console.log(`Successfully scraped ${successfulArticles.length} articles`);

    // Search for images
    const imageLinks = await searchImages(query);
    console.log(`Found ${imageLinks.length} image URLs`);

    return { 
      results: filteredResults, 
      articles: successfulArticles,
      images: imageLinks
    };

  } catch (error) {
    console.error('Google Search API error:', error);
    throw new Error(`Failed to fetch data from Google Search API: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Significantly enhanced Groq processing for detailed comprehensive analysis
async function processArticlesWithGroq(scrapedData: ScrapedData, query: string): Promise<Omit<EventDetails, 'images' | 'sources'>> {
  // Process more articles for comprehensive analysis
  const topArticles = scrapedData.articles
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 15); // Increased from 8 to 15 articles

  const articleContent = topArticles.map((article, index) => {
    // Increased content per article for more detailed analysis
    const contentToUse = article.content.substring(0, 3500); // Increased from 1500 to 3500
    return `
=== ARTICLE ${index + 1}: ${article.source.toUpperCase()} ===
Title: ${article.title}
URL: ${article.url}
Content: ${contentToUse}
---`;
  }).join('\n\n');

  // Include more snippets for additional context
  const topSnippets = scrapedData.results
    .slice(0, 10) // Increased from 5 to 10 snippets
    .map((result, index) => `${index + 1}. [${result.displayLink}] ${result.title}: ${result.snippet}`)
    .join('\n');

  // Enhanced prompt for comprehensive detailed extraction
  const prompt = `
You are an expert investigative analyst and researcher. Your task is to conduct a comprehensive, detailed analysis of the provided content about: "${query}"

MAIN ARTICLES FOR ANALYSIS:
${articleContent}

ADDITIONAL REFERENCE SNIPPETS:
${topSnippets}

INSTRUCTIONS FOR COMPREHENSIVE DETAILED EXTRACTION:
1. Extract ALL available information with maximum detail and depth
2. Provide comprehensive, thorough descriptions and explanations
3. Include background context, circumstances, and all relevant details
4. For each field, extract as much detailed information as possible
5. Be extremely thorough and comprehensive in your analysis
6. Include specific details like dates, times, locations, names, positions, relationships
7. Provide detailed descriptions of events, processes, and outcomes
8. Include quotes, statements, and specific facts when available
9. Ensure chronological accuracy and detailed timeline information
10. Extract comprehensive victim and accused information with full context

DETAILED FIELD REQUIREMENTS:

LOCATION: Extract detailed geographical information including specific addresses, venues, cities, states, countries, regional context, nearby landmarks, facility names, building details, and any location-specific circumstances or significance.

DETAILS: Provide a comprehensive, detailed narrative that includes:
- Complete background and context leading to the event
- Detailed sequence of what happened step by step
- Specific circumstances, conditions, and factors involved
- All parties involved and their roles/relationships
- Detailed description of actions taken and decisions made
- Investigation details, evidence found, and analysis
- Legal proceedings, charges, and court information
- Official statements, press releases, and public communications
- Media coverage details and public reactions
- Current status and ongoing developments
- Impact and consequences for all parties involved
- Any controversies, disputes, or conflicting information

ACCUSED: List all individuals, organizations, companies, or entities with comprehensive details including:
- Full names and any aliases or alternative spellings
- Positions, titles, roles, and professional background
- Relationship to the incident and specific involvement
- Charges or allegations against them
- Background information and relevant history
- Current status and any statements made

VICTIMS: Provide detailed information about all affected parties including:
- Full names and demographic information where available
- Ages, backgrounds, and personal circumstances
- Nature and extent of impact or harm suffered
- Current condition and status
- Relationship to the incident and how they were affected
- Any statements or reactions from victims or families

TIMELINE: Create a comprehensive chronological sequence with specific details:
- Exact dates and times when possible
- Detailed description of what happened at each stage
- Pre-incident events and background circumstances
- Step-by-step progression of the main incident
- Immediate response and aftermath
- Investigation milestones and discoveries
- Legal proceedings and court dates
- Media coverage and public reaction timeline
- Ongoing developments and current status

Return ONLY a valid JSON object following this exact template structure:

${JSON.stringify(EVENT_DETAILS_TEMPLATE, null, 2)}

CRITICAL REQUIREMENTS:
- Use ONLY information explicitly stated in the provided content
- Be maximally detailed and comprehensive within the available information
- Ensure proper JSON formatting with no syntax errors
- If specific information is not available, use empty strings or arrays
- Focus on accuracy while maximizing detail extraction
- Include specific quotes, names, dates, and facts when available

JSON Response:`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1, // Keep low for factual accuracy
      max_tokens: 8000, // Significantly increased from 3000 to 8000 for detailed responses
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from Groq API');
    }

    // Clean and parse JSON response
    const cleanedResponse = response.trim();
    const jsonStart = cleanedResponse.indexOf('{');
    const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('Invalid JSON response from Groq - no JSON object found');
    }
    
    const jsonString = cleanedResponse.substring(jsonStart, jsonEnd);
    
    if (!isValidJSON(jsonString)) {
      console.error('Invalid JSON from Groq:', jsonString.substring(0, 500));
      throw new Error('Invalid JSON format from Groq response');
    }

    const parsedData = JSON.parse(jsonString);
    
    // Validate and ensure required fields exist
    const requiredFields: (keyof Omit<EventDetails, 'images' | 'sources'>)[] = ['location', 'details', 'accused', 'victims', 'timeline'];
    for (const field of requiredFields) {
      if (!(field in parsedData)) {
        parsedData[field] = Array.isArray(EVENT_DETAILS_TEMPLATE[field]) ? [] : '';
      }
    }
    
    return parsedData;
    
  } catch (error) {
    console.error('Groq processing error:', error);
    throw new Error(`Failed to process data with Groq API: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Database Operations (unchanged for compatibility)
async function fetchEventFromDatabase(event_id: string) {
  const { data: eventData, error: fetchError } = await supabase
    .from('events')
    .select('query, title')
    .eq('event_id', event_id)
    .single();
    
  if (fetchError) {
    console.error('Event fetch error:', fetchError);
    throw new Error(`Event not found: ${fetchError.message}`);
  }
  
  if (!eventData || !eventData.query) {
    throw new Error('Event not found or missing query');
  }
  
  return eventData;
}

async function saveEventDetails(event_id: string, structuredData: EventDetails) {
  console.log(`Saving event details for ${event_id}:`);
  console.log(`- Sources: ${structuredData.sources.length}`);
  console.log(`- Images: ${structuredData.images.length}`);

  // Check if record exists
  const { data: existingDetails, error: checkError } = await supabase
    .from('event_details')
    .select('event_id')
    .eq('event_id', event_id)
    .single();

  const timestamp = new Date().toISOString();
  
  let dbOperation;
  if (existingDetails && !checkError) {
    console.log('Updating existing record...');
    dbOperation = supabase
      .from('event_details')
      .update({
        location: structuredData.location,
        details: structuredData.details,
        accused: structuredData.accused,
        victims: structuredData.victims,
        timeline: structuredData.timeline,
        sources: structuredData.sources,
        images: structuredData.images,
        updated_at: timestamp
      })
      .eq('event_id', event_id);
  } else {
    console.log('Inserting new record...');
    dbOperation = supabase
      .from('event_details')
      .insert({
        event_id: event_id,
        location: structuredData.location,
        details: structuredData.details,
        accused: structuredData.accused,
        victims: structuredData.victims,
        timeline: structuredData.timeline,
        sources: structuredData.sources,
        images: structuredData.images,
        created_at: timestamp,
        updated_at: timestamp
      });
  }

  const { error: saveError } = await dbOperation;
  if (saveError) {
    console.error('Database save error:', saveError);
    throw new Error(`Failed to save event details: ${saveError.message}`);
  }
  
  console.log('Successfully saved event details');
}

async function updateEventTimestamp(event_id: string) {
  const { error: updateError } = await supabase
    .from('events')
    .update({ last_updated: new Date().toISOString() })
    .eq('event_id', event_id);

  if (updateError) {
    console.warn('Failed to update timestamp:', updateError);
  }
}

// Main processing function (enhanced for detailed processing)
async function processEvent(event_id: string) {
  console.log(`Processing event for detailed analysis: ${event_id}`);

  // Fetch event data
  const eventData = await fetchEventFromDatabase(event_id);
  console.log(`Event: ${eventData.title}`);
  console.log(`Query: ${eventData.query}`);

  // Search and scrape with enhanced coverage
  console.log('Conducting comprehensive search and scraping...');
  const scrapedData = await searchGoogleAndScrape(eventData.query);

  if (!scrapedData.articles || scrapedData.articles.length === 0) {
    throw new Error('No articles found or scraped');
  }

  console.log(`Scraped ${scrapedData.articles.length} articles and found ${scrapedData.images.length} images for detailed analysis`);

  // Process with Groq for detailed analysis
  console.log('Processing with Groq for comprehensive detailed analysis...');
  const analyzedData = await processArticlesWithGroq(scrapedData, eventData.query);

  // Combine data with enhanced source tracking
  const scrapedSourceUrls = scrapedData.articles
    .filter(article => article.url && article.content.length > 100)
    .map(article => article.url);

  const structuredData: EventDetails = {
    ...analyzedData,
    sources: scrapedSourceUrls,
    images: scrapedData.images
  };

  console.log(`Detailed analysis complete: ${scrapedSourceUrls.length} sources analyzed, ${scrapedData.images.length} images found`);
  console.log(`Details length: ${structuredData.details.length} characters`);
  console.log(`Timeline events: ${structuredData.timeline.length}`);
  console.log(`Accused parties: ${structuredData.accused.length}`);
  console.log(`Victims: ${structuredData.victims.length}`);

  // Save to database
  await saveEventDetails(event_id, structuredData);
  await updateEventTimestamp(event_id);

  console.log('Successfully completed detailed processing');

  return {
    eventData,
    structuredData,
    scrapedData
  };
}

// GET endpoint (unchanged for compatibility)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const event_id = searchParams.get('event_id');
    const api_key = searchParams.get('api_key');

    if (!api_key || api_key !== API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    if (!event_id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const { eventData, structuredData, scrapedData } = await processEvent(event_id);

    return NextResponse.json({
      success: true,
      message: "Event analyzed and saved successfully with detailed information",
      event_id: event_id,
      event_title: eventData.title,
      query_used: eventData.query,
      articles_scraped: structuredData.sources.length,
      images_found: structuredData.images.length,
      sources_analyzed: [...new Set(scrapedData.articles.map(a => a.source))].join(', '),
      analysis_summary: {
        location: structuredData.location,
        accused_count: structuredData.accused.length,
        victims_count: structuredData.victims.length,
        timeline_events: structuredData.timeline.length,
        details_length: structuredData.details.length,
        total_content_analyzed: scrapedData.articles.reduce((sum, article) => sum + article.content.length, 0)
      }
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during detailed event analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint (unchanged for compatibility)
export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json();

    if (!event_id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const { eventData, structuredData, scrapedData } = await processEvent(event_id);

    return NextResponse.json({
      success: true,
      event_id: event_id,
      event_title: eventData.title,
      query_used: eventData.query,
      data: structuredData,
      articles_scraped: structuredData.sources.length,
      images_found: structuredData.images.length,
      sources_analyzed: [...new Set(scrapedData.articles.map(a => a.source))].join(', '),
      details_length: structuredData.details.length,
      comprehensive_analysis: true
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during detailed event analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}