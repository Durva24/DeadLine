import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Define the event update type based on your database schema
interface EventUpdate {
  update_id: number
  event_id: number | null
  title: string | null
  description: string | null
  update_date: string | null
}

export async function GET(request: NextRequest) {
  try {
    // Get the event_id from query parameters
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('event_id')

    // Validate event_id parameter
    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing event_id parameter' },
        { status: 400 }
      )
    }

    // Convert to number and validate
    const eventIdNumber = parseInt(eventId, 10)
    if (isNaN(eventIdNumber)) {
      return NextResponse.json(
        { error: 'Invalid event_id parameter. Must be a number.' },
        { status: 400 }
      )
    }

    // Fetch event updates from Supabase
    const { data, error } = await supabase
      .from('event_updates')
      .select('*')
      .eq('event_id', eventIdNumber)
      .order('update_date', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch event updates' },
        { status: 500 }
      )
    }

    // Return the data
    return NextResponse.json({
      success: true,
      data: data as EventUpdate[],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add POST method to create new event updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, title, description } = body

    // Validate required fields
    if (!event_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: event_id and title' },
        { status: 400 }
      )
    }

    // Insert new event update
    const { data, error } = await supabase
      .from('event_updates')
      .insert([
        {
          event_id: parseInt(event_id, 10),
          title,
          description: description || null
        }
      ])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to create event update' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data[0] as EventUpdate,
      message: 'Event update created successfully'
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}