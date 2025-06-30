// app/components/home/event-grid.tsx
'use client'

import Link from 'next/link'

type Event = {
  id: string
  title: string
  category?: string
  status?: string
  thumbnail_url?: string
}

export default function EventGrid({ events }: { events: Event[] }) {
  if (!events || events.length === 0)
    return <p className="text-gray-500 italic">No events found.</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {events.map(event => (
        <Link
          key={event.id}
          href={`/event/${event.id}`}
          className="border rounded-xl p-4 hover:shadow-lg transition"
        >
          {event.thumbnail_url && (
            <img
              src={event.thumbnail_url}
              alt="event"
              className="rounded-lg mb-3 w-full h-40 object-cover"
            />
          )}
          <h3 className="text-lg font-semibold">{event.title}</h3>
          <p className="text-sm text-gray-500">{event.category || 'General'}</p>
          <span
            className={`text-xs mt-2 inline-block px-2 py-1 rounded-full ${
              event.status === 'Justice Served'
                ? 'bg-green-100 text-green-700'
                : event.status === 'Not Served'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {event.status || 'Unknown'}
          </span>
        </Link>
      ))}
    </div>
  )
}
