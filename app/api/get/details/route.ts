import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Define the event details interface based on your table schema
interface EventDetails {
  event_id: number
  location: string | null
  details: string | null
  accused: string | null
  victims: string | null
  timeline: string | null
  sources: string[] | null
  images: string[] | null
  created_at: string | null
  updated_at: string | null
}

export async function GET(request: NextRequest) {
  try {
    // Get the event_id from query parameters
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('event_id')

    // Validate event_id parameter
    if (!eventId) {
      return NextResponse.json(
        { error: 'event_id parameter is required' },
        { status: 400 }
      )
    }

    // Validate that event_id is a number
    const eventIdNumber = parseInt(eventId, 10)
    if (isNaN(eventIdNumber)) {
      return NextResponse.json(
        { error: 'event_id must be a valid number' },
        { status: 400 }
      )
    }

    // Fetch data from Supabase
    const { data, error } = await supabase
      .from('event_details')
      .select('*')
      .eq('event_id', eventIdNumber)
      .single()

    // Handle Supabase errors
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle specific error cases
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch event details' },
        { status: 500 }
      )
    }

    // Return the event details
    return NextResponse.json({
      success: true,
      data: data as EventDetails
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: Add other HTTP methods if needed
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}