// pages/api/events.ts (for Pages Router)
// OR
// app/api/events/route.ts (for App Router)

import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

// Define the Event type based on your database schema
interface Event {
  event_id: number
  title: string
  image_url: string | null
  status: string
  tags: string[] | null
  query: string | null
  summary: string | null
  last_updated: string | null
  incident_date: string | null
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// For Pages Router (pages/api/events.ts)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('last_updated', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ error: 'Failed to fetch events' })
    }

    return res.status(200).json({ events })
  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// For App Router (app/api/events/route.ts)
export async function GET() {
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('last_updated', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return Response.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    return Response.json({ events })
  } catch (error) {
    console.error('API error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}