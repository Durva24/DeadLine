// app/components/event/event-images.tsx

type Props = {
  thumbnail_url?: string
  alt?: string
}

export default function EventImages({ thumbnail_url, alt = 'Event image' }: Props) {
  if (!thumbnail_url) return null

  return (
    <div className="w-full mb-6">
      <img
        src={thumbnail_url}
        alt={alt}
        className="rounded-xl w-full h-64 object-cover shadow-md"
      />
    </div>
  )
}
