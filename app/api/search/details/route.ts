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

// Reduced JSON template for more efficient processing
const EVENT_DETAILS_TEMPLATE: Record<string, any> = {
  location: "string - Location where event occurred",
  details: "string - Key details of what happened",
  accused: ["array of strings - Names of accused parties"],
  victims: ["array of strings - Names of victims"],
  timeline: ["array of strings - Key events with dates"]
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

// Optimized content extraction - reduced size
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
  const articleMatches = cleanHtml.match(/<(?:article|main|div[^>]*class=["'][^"']*(?:content|article|post)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:article|main|div)>/gi);
  let content = '';
  
  if (articleMatches && articleMatches.length > 0) {
    const longestMatch = articleMatches.reduce((a, b) => a.length > b.length ? a : b);
    content = longestMatch.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Fallback: extract paragraph content
  if (!content || content.length < 100) {
    const paragraphs = cleanHtml.match(/<p[^>]*>([^<]+)<\/p>/gi);
    if (paragraphs) {
      content = paragraphs.map(p => p.replace(/<[^>]*>/g, '')).join(' ').trim();
    }
  }
  
  // Final fallback: use meta description
  if (!content || content.length < 50) {
    content = metaContent;
  }
  
  const source = new URL(url).hostname.replace('www.', '');
  
  return {
    url,
    title,
    content: content.substring(0, 2000), // Reduced from 5000 to 2000 characters
    publishDate: '',
    author: '',
    source
  };
}

// Optimized scraping with shorter timeout
async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Reduced from 10 to 8 seconds
    
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

// Improved image search with better filtering
async function searchImages(query: string): Promise<string[]> {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    console.warn('Google API credentials not configured for image search');
    return [];
  }

  try {
    console.log('Searching for images...');
    
    // Removed dateRestrict completely - search all time periods
    const imageSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active&imgSize=medium`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced timeout
    
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

    // More lenient image filtering
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
      .slice(0, 8);

    console.log(`Found ${imageLinks.length} valid image links`);
    return imageLinks;

  } catch (error) {
    console.warn('Image search error:', error);
    return [];
  }
}

// Optimized Google Search - removed date restrictions and reduced batch size
async function searchGoogleAndScrape(query: string): Promise<ScrapedData> {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured');
  }

  try {
    const allResults: GoogleSearchResult[] = [];

    // Reduced from 3 to 2 batches to get 20 results instead of 30
    for (let page = 1; page <= 2; page++) {
      const startIndex = (page - 1) * 10 + 1;
      
      // REMOVED dateRestrict parameter completely - search all time periods
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

        // Reduced delay between requests
        if (page < 2) {
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

    // Reduced from 20 to 12 articles to scrape for better performance
    const articlesToScrape = filteredResults.slice(0, 12);
    console.log(`Scraping content from ${articlesToScrape.length} articles...`);
    
    const scrapePromises = articlesToScrape.map(result => scrapeArticle(result.link));
    const scrapedArticles = await Promise.allSettled(scrapePromises);
    
    const successfulArticles: ScrapedArticle[] = scrapedArticles
      .filter((result): result is PromiseFulfilledResult<ScrapedArticle> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter(article => article.content.length > 50); // Reduced minimum content length

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

// Optimized Groq processing with reduced data size
async function processArticlesWithGroq(scrapedData: ScrapedData, query: string): Promise<Omit<EventDetails, 'images' | 'sources'>> {
  // Limit and optimize content for analysis - reduced size significantly
  const topArticles = scrapedData.articles
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 8); // Reduced from unlimited to top 8 articles

  const articleContent = topArticles.map((article, index) => {
    // Reduced content per article
    const truncatedContent = article.content.substring(0, 1500); // Reduced from 2000 to 1500
    return `
=== ARTICLE ${index + 1}: ${article.source.toUpperCase()} ===
Title: ${article.title}
Content: ${truncatedContent}
---`;
  }).join('\n\n');

  // Include top snippets as supplementary info
  const topSnippets = scrapedData.results
    .slice(0, 5) // Only top 5 snippets
    .map((result, index) => `${index + 1}. ${result.snippet}`)
    .join('\n');

  const prompt = `
You are an expert analyst. Extract key information from the provided content about: "${query}"

MAIN ARTICLES:
${articleContent}

ADDITIONAL SNIPPETS:
${topSnippets}

Extract accurate information and return ONLY a valid JSON object following this template:

${JSON.stringify(EVENT_DETAILS_TEMPLATE, null, 2)}

INSTRUCTIONS:
1. Use only information explicitly stated in the content
2. Be concise but accurate
3. If information is not available, use empty strings or arrays
4. Ensure proper JSON formatting
5. Focus on the most important details

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
      temperature: 0.1,
      max_tokens: 3000, // Reduced from 6000 to 3000
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
      throw new Error('Invalid JSON format from Groq response');
    }

    const parsedData = JSON.parse(jsonString);
    
    // Validate and ensure required fields exist
    const requiredFields: (keyof typeof EVENT_DETAILS_TEMPLATE)[] = ['location', 'details', 'accused', 'victims', 'timeline'];
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

// Database Operations
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

// Main processing function
async function processEvent(event_id: string) {
  console.log(`Processing event: ${event_id}`);

  // Fetch event data
  const eventData = await fetchEventFromDatabase(event_id);
  console.log(`Event: ${eventData.title}`);
  console.log(`Query: ${eventData.query}`);

  // Search and scrape
  console.log('Searching and scraping...');
  const scrapedData = await searchGoogleAndScrape(eventData.query);

  if (!scrapedData.articles || scrapedData.articles.length === 0) {
    throw new Error('No articles found or scraped');
  }

  console.log(`Scraped ${scrapedData.articles.length} articles and found ${scrapedData.images.length} images`);

  // Process with Groq
  console.log('Processing with Groq...');
  const analyzedData = await processArticlesWithGroq(scrapedData, eventData.query);

  // Combine data
  const scrapedSourceUrls = scrapedData.articles
    .filter(article => article.url && article.content.length > 50)
    .map(article => article.url);

  const structuredData: EventDetails = {
    ...analyzedData,
    sources: scrapedSourceUrls,
    images: scrapedData.images
  };

  console.log(`Analysis complete: ${scrapedSourceUrls.length} sources, ${scrapedData.images.length} images`);

  // Save to database
  await saveEventDetails(event_id, structuredData);
  await updateEventTimestamp(event_id);

  console.log('Successfully completed processing');

  return {
    eventData,
    structuredData,
    scrapedData
  };
}

// GET endpoint
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
      message: "Event analyzed and saved successfully",
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
        total_content_analyzed: scrapedData.articles.reduce((sum, article) => sum + article.content.length, 0)
      }
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during event analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint
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
      sources_analyzed: [...new Set(scrapedData.articles.map(a => a.source))].join(', ')
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during event analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}