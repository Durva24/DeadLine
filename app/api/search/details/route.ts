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

// JSON template for Groq to follow (removed sources from template)
const EVENT_DETAILS_TEMPLATE: Record<string, any> = {
  location: "string - Specific location where the event occurred (city, state, country)",
  details: "string - Comprehensive description of what happened, including context and circumstances",
  accused: ["array of strings - Names and descriptions of accused parties or perpetrators"],
  victims: ["array of strings - Names and descriptions of victims or affected parties"],
  timeline: ["array of strings - Chronological sequence of events with dates/times when available"]
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

// Simple HTML content extraction without external dependencies
function extractArticleContent(html: string, url: string): ScrapedArticle {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Extract title
  const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Extract meta description as fallback content
  const metaDescMatch = cleanHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  const metaContent = metaDescMatch ? metaDescMatch[1] : '';
  
  // Extract text content from common article tags
  const articleMatches = cleanHtml.match(/<(?:article|main|div[^>]*class=["'][^"']*(?:content|article|post)[^"']*["'])[^>]*>([\s\S]*?)<\/(?:article|main|div)>/gi);
  let content = '';
  
  if (articleMatches && articleMatches.length > 0) {
    // Get the longest match (likely main content)
    const longestMatch = articleMatches.reduce((a, b) => a.length > b.length ? a : b);
    content = longestMatch.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  // Fallback: extract all paragraph content
  if (!content || content.length < 200) {
    const paragraphs = cleanHtml.match(/<p[^>]*>([^<]+)<\/p>/gi);
    if (paragraphs) {
      content = paragraphs.map(p => p.replace(/<[^>]*>/g, '')).join(' ').trim();
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
    content: content.substring(0, 5000), // Limit content length
    publishDate: '',
    author: '',
    source
  };
}

// Scrape article content from URL
async function scrapeArticle(url: string): Promise<ScrapedArticle | null> {
  try {
    console.log(`Scraping article: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
// Enhanced image search function - FIXED VERSION
async function searchImages(query: string): Promise<string[]> {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    console.warn('Google API credentials not configured for image search');
    return [];
  }
  try {
    console.log('Searching for images...');
    // REMOVED dateRestrict parameter to get all images, not just recent ones
    const imageSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=active&imgType=news&imgSize=medium`; 
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    const imageResponse = await fetch(imageSearchUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
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

    // IMPROVED filtering - less restrictive
    const imageLinks = imageData.items
      .map((item: any) => item.link)
      .filter(Boolean)
      .filter((link: string) => {
        const url = link.toLowerCase();
        // More lenient filtering - only exclude obvious non-content images
        return !url.includes('favicon.ico') && 
               !url.includes('/logo.') && 
               !url.includes('/icon.') &&
               // Accept more image formats and don't require specific extensions
               (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || 
                url.includes('.webp') || url.includes('.gif') || url.includes('.bmp') ||
                url.includes('image') || url.includes('photo') || url.includes('pic'));
      })
      .slice(0, 10); // Get up to 10 images instead of 8

    console.log(`Found ${imageLinks.length} valid image links`);
    
    // Log the actual image URLs for debugging
    console.log('Image URLs found:', imageLinks);
    
    return imageLinks;

  } catch (error) {
    console.warn('Image search error:', error);
    return [];
  }
}

// Enhanced Google Custom Search API function
async function searchGoogleAndScrape(query: string): Promise<ScrapedData> {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;
  
  if (!API_KEY || !SEARCH_ENGINE_ID) {
    throw new Error('Google API credentials not configured');
  }

  try {
    const allResults: GoogleSearchResult[] = [];

    // Get 30 search results in 3 batches of 10 (Google API limit per request is 10)
    for (let page = 1; page <= 3; page++) {
      const startIndex = (page - 1) * 10 + 1;
      
      const webSearchUrl = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10&start=${startIndex}&dateRestrict=m6`; // Last 6 months for recent news
      console.log(`Making web search request for page ${page}...`);
      
      try {
        const webResponse = await fetch(webSearchUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
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

        // Small delay between requests to avoid rate limits
        if (page < 3) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.warn(`Error on page ${page}:`, error);
        continue;
      }
    }

    console.log(`Total search results: ${allResults.length}`);

    // Filter results to focus on news sources and remove duplicates
    const newsResults = allResults.filter((result, index, self) => {
      // Remove duplicates based on URL
      const isDuplicate = index !== self.findIndex(r => r.link === result.link);
      if (isDuplicate) return false;
      
      // Filter for news-like URLs and exclude social media, forums
      const url = result.link.toLowerCase();
      const domain = result.displayLink?.toLowerCase() || '';
      
      const excludeDomains = ['reddit.com', 'twitter.com', 'facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com'];
      const isExcluded = excludeDomains.some(excluded => domain.includes(excluded) || url.includes(excluded));
      
      return !isExcluded && result.title && result.snippet;
    });

    console.log(`Filtered to ${newsResults.length} news results`);

    // Scrape article content from filtered results (limit to 20 for performance)
    const articlesToScrape = newsResults.slice(0, 20);
    console.log(`Scraping content from ${articlesToScrape.length} articles...`);
    
    const scrapePromises = articlesToScrape.map(result => scrapeArticle(result.link));
    const scrapedArticles = await Promise.allSettled(scrapePromises);
    
    const successfulArticles: ScrapedArticle[] = scrapedArticles
      .filter((result): result is PromiseFulfilledResult<ScrapedArticle> => 
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
      .filter(article => article.content.length > 100); // Only keep articles with substantial content

    console.log(`Successfully scraped ${successfulArticles.length} articles`);

    // Search for images separately - this will now return more results
    const imageLinks = await searchImages(query);
    console.log(`Image search completed. Found ${imageLinks.length} image URLs`);

    return { 
      results: newsResults, 
      articles: successfulArticles,
      images: imageLinks // This should now contain actual image URLs
    };

  } catch (error) {
    console.error('Google Search API error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch data from Google Search API: ${error.message}`);
    } else {
      throw new Error('Failed to fetch data from Google Search API: Unknown error');
    }
  }
}

// Function to process scraped article data with Groq Llama 70B
async function processArticlesWithGroq(scrapedData: ScrapedData, query: string): Promise<Omit<EventDetails, 'images' | 'sources'>> {
  // Prepare article content for analysis
  const articleContent = scrapedData.articles.map((article, index) => {
    return `
=== ARTICLE ${index + 1}: ${article.source.toUpperCase()} ===
URL: ${article.url}
Title: ${article.title}
${article.publishDate ? `Published: ${article.publishDate}` : ''}
${article.author ? `Author: ${article.author}` : ''}

Content:
${article.content}

---`;
  }).join('\n\n');

  // Also include search snippets as supplementary information
  const snippetContent = scrapedData.results.map((result, index) => {
    return `Snippet ${index + 1} (${result.displayLink}): ${result.snippet}`;
  }).join('\n');

  const prompt = `
You are an expert investigative journalist and data analyst. You have been provided with comprehensive article content and search results about a specific legal case or news event. Your task is to extract accurate, detailed information and create a structured analysis.

EVENT QUERY: "${query}"

FULL ARTICLE CONTENT FROM NEWS SOURCES:
${articleContent}

ADDITIONAL SEARCH SNIPPETS:
${snippetContent}

Based on the comprehensive article content and search results provided above, extract detailed and accurate information about this event/case.

Return ONLY a valid JSON object that follows this exact template:

${JSON.stringify(EVENT_DETAILS_TEMPLATE, null, 2)}

CRITICAL ANALYSIS INSTRUCTIONS:
1. PRIORITIZE ARTICLE CONTENT: Use the full article content as your primary source of information
2. CROSS-VERIFICATION: Compare information across multiple articles to ensure accuracy
3. DETAILED EXTRACTION:
   - "location": Extract the most specific location mentioned (street address, building, city, state, country)
   - "details": Write a comprehensive narrative incorporating key facts from all articles
   - "accused": Extract ALL names, ages, titles, and detailed descriptions of accused individuals
   - "victims": Extract ALL names, ages, and detailed descriptions of victims
   - "timeline": Create a detailed chronological sequence with specific dates and times from articles
4. ACCURACY FIRST: Only include information explicitly stated in the provided content
5. RESOLVE CONFLICTS: When articles provide conflicting information, note the discrepancy
6. NO SPECULATION: If specific information isn't available, use empty strings or arrays
7. PROPER JSON: Ensure all text is properly escaped for JSON format
8. DO NOT generate or include source URLs - they will be handled separately

Focus on creating the most accurate and comprehensive analysis possible using the full article content provided.

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
      max_tokens: 6000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from Groq API');
    }

    // Clean and parse the JSON response
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
    
    // Validate the structure
    const requiredFields: (keyof typeof EVENT_DETAILS_TEMPLATE)[] = ['location', 'details', 'accused', 'victims', 'timeline'];
    for (const field of requiredFields) {
      if (!(field in parsedData)) {
        parsedData[field] = Array.isArray(EVENT_DETAILS_TEMPLATE[field]) ? [] : '';
      }
    }
    return parsedData;
  } catch (error) {
    console.error('Groq processing error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to process data with Groq API: ${error.message}`);
    } else {
      throw new Error('Failed to process data with Groq API: Unknown error');
    }
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
    throw new Error(`Event not found in events table: ${fetchError.message}`);
  }
  if (!eventData) {
    throw new Error('Event not found in events table');
  }
  if (!eventData.query) {
    throw new Error('No query attribute found for this event');
  }
  return eventData;
}

async function saveEventDetails(event_id: string, structuredData: EventDetails) {
  // Log the data being saved for debugging
  console.log(`Saving event details for ${event_id}:`);
  console.log(`- Sources: ${structuredData.sources.length} URLs`);
  console.log(`- Images: ${structuredData.images.length} URLs`);
  console.log('Image URLs:', structuredData.images);

  // Check if record exists
  const { data: existingDetails, error: checkError } = await supabase
    .from('event_details')
    .select('event_id')
    .eq('event_id', event_id)
    .single();

  let dbOperation;
  if (existingDetails && !checkError) {
    // Update existing record
    console.log('Updating existing record in event_details table...');
    dbOperation = supabase
      .from('event_details')
      .update({
        location: structuredData.location,
        details: structuredData.details,
        accused: structuredData.accused,
        victims: structuredData.victims,
        timeline: structuredData.timeline,
        sources: structuredData.sources,
        images: structuredData.images, // This should now contain actual URLs
        updated_at: new Date().toISOString()
      })
      .eq('event_id', event_id);
  } else {
    // Insert new record
    console.log('Inserting new record into event_details table...');
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
        images: structuredData.images, // This should now contain actual URLs
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }
  const { error: saveError } = await dbOperation;

  if (saveError) {
    console.error('Database save error:', saveError);
    throw new Error(`Failed to save event details: ${saveError.message}`);
  }
  
  console.log('Successfully saved event details to database');
}

async function updateEventTimestamp(event_id: string) {
  const { error: updateError } = await supabase
    .from('events')
    .update({ last_updated: new Date().toISOString() })
    .eq('event_id', event_id);

  if (updateError) {
    console.warn('Failed to update last_updated in events table:', updateError);
  }
}

// Core processing function
async function processEvent(event_id: string) {
  console.log(`Processing event: ${event_id}`);

  // Step 1: Fetch event and query from Supabase events table
  const eventData = await fetchEventFromDatabase(event_id);
  console.log(`Found event: ${eventData.title}`);
  console.log(`Using query: ${eventData.query}`);

  // Step 2: Search Google and scrape articles
  console.log(`Searching and scraping articles for query: ${eventData.query}`);
  const scrapedData = await searchGoogleAndScrape(eventData.query);

  if (!scrapedData.articles || scrapedData.articles.length === 0) {
    throw new Error('No article content could be scraped from search results');
  }

  console.log(`Successfully scraped ${scrapedData.articles.length} articles and found ${scrapedData.images.length} images`);

  // Step 3: Process scraped article data with Groq
  console.log(`Processing ${scrapedData.articles.length} articles with Groq...`);
  const analyzedData = await processArticlesWithGroq(scrapedData, eventData.query);

  // Step 4: Combine analyzed data with images and scraped sources
  const scrapedSourceUrls = scrapedData.articles
    .filter(article => article.url && article.content.length > 100)
    .map(article => article.url);

  const structuredData: EventDetails = {
    ...analyzedData,
    sources: scrapedSourceUrls, // Use actual scraped URLs as sources
    images: scrapedData.images // This should now contain actual image URLs
  };

  console.log('Article analysis completed successfully');
  console.log(`Collected ${scrapedSourceUrls.length} source URLs and ${scrapedData.images.length} image URLs`);

  // Step 5: Save to event_details table
  await saveEventDetails(event_id, structuredData);

  // Step 6: Update last_updated timestamp in events table
  await updateEventTimestamp(event_id);

  console.log('Successfully analyzed event articles and saved all details to database');

  return {
    eventData,
    structuredData,
    scrapedData
  };
}

// Main GET endpoint
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters from URL
    const { searchParams } = new URL(request.url);
    const event_id = searchParams.get('event_id');
    const api_key = searchParams.get('api_key');

    // Validate API key
    if (!api_key || api_key !== API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
    // Validate event_id
    if (!event_id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }
    const { eventData, structuredData, scrapedData } = await processEvent(event_id);
    // Return success response with comprehensive data
    return NextResponse.json({
      success: true,
      message: "Event analyzed and saved successfully",
      event_id: event_id,
      event_title: eventData.title,
      query_used: eventData.query,
      articles_scraped: structuredData.sources.length,
      images_saved: structuredData.images.length,
      sources_analyzed: [...new Set(scrapedData.articles.map(a => a.source))].join(', '),
      analysis_summary: {
        location: structuredData.location,
        accused_count: structuredData.accused.length,
        victims_count: structuredData.victims.length,
        timeline_events: structuredData.timeline.length,
        total_article_content_length: scrapedData.articles.reduce((sum, article) => sum + article.content.length, 0)
      },
      debug_info: {
        image_urls_found: structuredData.images,
        total_images: structuredData.images.length
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

// POST endpoint for backward compatibility
export async function POST(request: NextRequest) {
  try {
    const { event_id } = await request.json();

    if (!event_id) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    console.log(`Processing event via POST: ${event_id}`);

    const { eventData, structuredData, scrapedData } = await processEvent(event_id);

    return NextResponse.json({
      success: true,
      event_id: event_id,
      event_title: eventData.title,
      query_used: eventData.query,
      data: structuredData,
      articles_scraped: structuredData.sources.length,
      images_saved: structuredData.images.length,
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