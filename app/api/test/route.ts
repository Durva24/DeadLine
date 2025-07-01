import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use server-side only environment variables (no NEXT_PUBLIC_ prefix)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_SECRET_KEY = process.env.API_SECRET_KEY;

// Types
interface EventDetails {
  event_id: string;
  location: string;
  details: string;
  accused: string[];
  victims: string[];
  timeline: string[];
  sources: string[];
  images: string[];
  created_at?: string;
  updated_at?: string;
}

interface EventInfo {
  event_id: string;
  title: string;
  query: string;
  last_updated?: string;
}

interface CompleteEventData {
  event_info: EventInfo;
  event_details: EventDetails;
}

// GET endpoint to fetch event details
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters from URL
    const { searchParams } = new URL(request.url);
    const event_id = searchParams.get('event_id') || '1'; // Default to event_id = 1
    const api_key = searchParams.get('api_key');

    // Validate API key if provided (optional for this endpoint)
    if (api_key && api_key !== API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    console.log(`Fetching event details for event_id: ${event_id}`);

    // Fetch event info from events table
    const { data: eventInfo, error: eventError } = await supabase
      .from('events')
      .select('event_id, title, query, last_updated')
      .eq('event_id', event_id)
      .single();

    if (eventError) {
      console.error('Event fetch error:', eventError);
      return NextResponse.json(
        { 
          error: 'Event not found',
          details: eventError.message 
        },
        { status: 404 }
      );
    }

    // Fetch event details from event_details table
    const { data: eventDetails, error: detailsError } = await supabase
      .from('event_details')
      .select('*')
      .eq('event_id', event_id)
      .single();

    if (detailsError) {
      console.error('Event details fetch error:', detailsError);
      return NextResponse.json(
        { 
          error: 'Event details not found',
          details: detailsError.message,
          event_info: eventInfo // Still return basic event info
        },
        { status: 404 }
      );
    }

    // Combine the data
    const completeEventData: CompleteEventData = {
      event_info: eventInfo,
      event_details: eventDetails
    };

    console.log(`Successfully fetched event data for: ${eventInfo.title}`);

    // Return the complete event data
    return NextResponse.json({
      success: true,
      event_id: event_id,
      data: completeEventData,
      summary: {
        title: eventInfo.title,
        query: eventInfo.query,
        location: eventDetails.location,
        accused_count: eventDetails.accused?.length || 0,
        victims_count: eventDetails.victims?.length || 0,
        timeline_events: eventDetails.timeline?.length || 0,
        sources_count: eventDetails.sources?.length || 0,
        images_count: eventDetails.images?.length || 0,
        last_updated: eventInfo.last_updated,
        details_updated: eventDetails.updated_at
      }
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST endpoint for alternative access
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event_id = body.event_id || '1'; // Default to event_id = 1
    const api_key = body.api_key;

    // Validate API key if provided (optional for this endpoint)
    if (api_key && api_key !== API_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    console.log(`Fetching event details via POST for event_id: ${event_id}`);

    // Fetch event info from events table
    const { data: eventInfo, error: eventError } = await supabase
      .from('events')
      .select('event_id, title, query, last_updated')
      .eq('event_id', event_id)
      .single();

    if (eventError) {
      console.error('Event fetch error:', eventError);
      return NextResponse.json(
        { 
          error: 'Event not found',
          details: eventError.message 
        },
        { status: 404 }
      );
    }

    // Fetch event details from event_details table
    const { data: eventDetails, error: detailsError } = await supabase
      .from('event_details')
      .select('*')
      .eq('event_id', event_id)
      .single();

    if (detailsError) {
      console.error('Event details fetch error:', detailsError);
      return NextResponse.json(
        { 
          error: 'Event details not found',
          details: detailsError.message,
          event_info: eventInfo // Still return basic event info
        },
        { status: 404 }
      );
    }

    // Combine the data
    const completeEventData: CompleteEventData = {
      event_info: eventInfo,
      event_details: eventDetails
    };

    console.log(`Successfully fetched event data for: ${eventInfo.title}`);

    // Return the complete event data
    return NextResponse.json({
      success: true,
      event_id: event_id,
      data: completeEventData,
      summary: {
        title: eventInfo.title,
        query: eventInfo.query,
        location: eventDetails.location,
        accused_count: eventDetails.accused?.length || 0,
        victims_count: eventDetails.victims?.length || 0,
        timeline_events: eventDetails.timeline?.length || 0,
        sources_count: eventDetails.sources?.length || 0,
        images_count: eventDetails.images?.length || 0,
        last_updated: eventInfo.last_updated,
        details_updated: eventDetails.updated_at
      }
    });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}