// app/components/event/event-details.tsx

type Props = {
  title: string
  description: string
  status?: string
  category?: string
}

export default function EventDetails({ title, description, status, category }: Props) {
  const statusStyle =
    status === 'Justice Served'
      ? 'bg-green-100 text-green-700'
      : status === 'Not Served'
      ? 'bg-red-100 text-red-700'
      : 'bg-yellow-100 text-yellow-700'

  return (
    <section className="mb-6">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>

      <div className="flex items-center gap-2 mb-4">
        {status && (
          <span className={`text-xs px-3 py-1 rounded-full ${statusStyle}`}>
            {status}
          </span>
        )}
        {category && (
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
            {category}
          </span>
        )}
      </div>

      <p className="text-base text-gray-700">{description}</p>
    </section>
  )
}
