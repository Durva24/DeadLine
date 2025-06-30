// app/components/event/event-data.tsx
'use client'

import { format } from 'date-fns'

type Update = {
  id: string
  update_date: string
  content: string
  source_link: string
}

export default function EventData({ updates }: { updates: Update[] }) {
  if (!updates || updates.length === 0)
    return (
      <p className="text-gray-500 italic mt-6">
        No updates have been added for this event yet.
      </p>
    )

  return (
    <section className="border-l-2 border-indigo-500 pl-4 mt-6">
      {updates.map(update => (
        <div key={update.id} className="mb-6 relative">
          <div className="absolute -left-[10px] top-1 w-4 h-4 bg-indigo-500 rounded-full"></div>
          <p className="text-sm text-gray-500">{format(new Date(update.update_date), 'PPP')}</p>
          <p className="text-base mt-1">{update.content}</p>
          <a
            href={update.source_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Source
          </a>
        </div>
      ))}
    </section>
  )
}
