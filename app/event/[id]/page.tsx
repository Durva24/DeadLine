import { notFound } from 'next/navigation';

interface EventDetails {
  event_id: number;
  location: string;
  details: string;
  accused: string;
  victims: string;
  timeline: string;
  sources: string[];
  images: string[];
  created_at: string;
  updated_at: string;
}

interface EventUpdate {
  update_id: number;
  event_id: number;
  title: string;
  description: string;
  update_date: string;
}

interface EventDetailsResponse {
  success: boolean;
  data: EventDetails;
}

interface EventUpdatesResponse {
  success: boolean;
  data: EventUpdate[];
  count: number;
}

async function getEventDetails(id: string): Promise<EventDetails | null> {
  const apiKey = process.env.API_SECRET_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  if (!apiKey) {
    throw new Error('API_SECRET_KEY not found in environment variables');
  }

  try {
    const response = await fetch(`${baseUrl}/api/get/details?event_id=${id}&api_key=${apiKey}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return null;
    }

    const result: EventDetailsResponse = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error fetching event details:', error);
    return null;
  }
}

async function getEventUpdates(id: string): Promise<EventUpdate[]> {
  const apiKey = process.env.API_SECRET_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  if (!apiKey) {
    throw new Error('API_SECRET_KEY not found in environment variables');
  }

  try {
    const response = await fetch(`${baseUrl}/api/get/updates?event_id=${id}&api_key=${apiKey}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return [];
    }

    const result: EventUpdatesResponse = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error fetching event updates:', error);
    return [];
  }
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  const [eventDetails, eventUpdates] = await Promise.all([
    getEventDetails(id),
    getEventUpdates(id)
  ]);

  if (!eventDetails) {
    notFound();
  }

  const parseJsonString = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };

  const accused = parseJsonString(eventDetails.accused);
  const victims = parseJsonString(eventDetails.victims);
  const timeline = parseJsonString(eventDetails.timeline);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Event Details</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Location</h2>
        <p className="text-gray-700">{eventDetails.location}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Details</h2>
        <p className="text-gray-700">{eventDetails.details}</p>
      </div>

      {accused.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Accused</h2>
          <ul className="list-disc list-inside text-gray-700">
            {accused.map((person: string, index: number) => (
              <li key={index}>{person}</li>
            ))}
          </ul>
        </div>
      )}

      {victims.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Victims</h2>
          <ul className="list-disc list-inside text-gray-700">
            {victims.map((victim: string, index: number) => (
              <li key={index}>{victim}</li>
            ))}
          </ul>
        </div>
      )}

      {timeline.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Timeline</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            {timeline.map((event: string, index: number) => (
              <li key={index}>{event}</li>
            ))}
          </ul>
        </div>
      )}

      {eventUpdates.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Updates</h2>
          <div className="space-y-4">
            {eventUpdates.map((update) => (
              <div key={update.update_id} className="border-l-4 border-blue-500 pl-4 py-2">
                <h3 className="font-semibold">{update.title}</h3>
                <p className="text-gray-700 mt-1">{update.description}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {new Date(update.update_date).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {eventDetails.sources.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Sources</h2>
          <ul className="space-y-2">
            {eventDetails.sources.map((source, index) => (
              <li key={index}>
                <a 
                  href={source} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {source}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eventDetails.images.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Images</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventDetails.images.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Event image ${index + 1}`}
                className="w-full h-48 object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}