"use client";

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

interface EventDetailsProps {
  eventDetails: EventDetails;
  eventUpdates: EventUpdate[];
}

export default function EventDetailsComponent({ eventDetails, eventUpdates }: EventDetailsProps) {
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
    <>
      {/* Overview */}
      <article className="mb-16">
        <div className="bg-white rounded-2xl p-10 shadow-lg border border-gray-200">
          <div className="border-l-8 border-black pl-10">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">Overview</h2>
            <p className="text-gray-700 leading-relaxed text-lg font-light">
              {eventDetails.details}
            </p>
          </div>
        </div>
      </article>

      {/* Key Information Grid */}
      <section className="grid lg:grid-cols-2 gap-12 mb-16">
        {accused.length > 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h3 className="text-xl font-black uppercase tracking-tight border-b-4 border-red-500 pb-3 mb-6">
              Accused Parties
            </h3>
            <div className="space-y-3">
              {accused.map((person: string, index: number) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-800 font-semibold text-sm">{person}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {victims.length > 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <h3 className="text-xl font-black uppercase tracking-tight border-b-4 border-blue-500 pb-3 mb-6">
              Affected Parties
            </h3>
            <div className="space-y-3">
              {victims.map((victim: string, index: number) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <span className="text-gray-800 font-semibold text-sm">{victim}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Timeline and Updates Side by Side */}
      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        {/* Timeline */}
        {timeline.length > 0 && (
          <section>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b-4 border-black pb-4">
              Timeline of Events
            </h3>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-black via-gray-600 to-gray-300"></div>
              <div className="space-y-6">
                {timeline.map((event: string, index: number) => (
                  <div key={index} className="relative pl-16">
                    <div className="absolute left-4 top-3 w-5 h-5 bg-black rounded-full border-3 border-white shadow-lg"></div>
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2 py-1 bg-gray-900 text-white text-xs font-bold uppercase tracking-wide rounded-full">
                          Step {index + 1}
                        </span>
                      </div>
                      <p className="text-gray-700 leading-relaxed text-sm font-light">{event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recent Updates */}
        {eventUpdates.length > 0 && (
          <section>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b-4 border-black pb-4">
              Recent Updates
            </h3>
            <div className="space-y-6">
              {eventUpdates.map((update) => (
                <article key={update.update_id} className="bg-white rounded-xl p-8 shadow-md border border-gray-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wide rounded-full">
                      Update
                    </span>
                    <time className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-full">
                      {new Date(update.update_date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </time>
                  </div>
                  <h4 className="text-lg font-bold mb-3 text-gray-900">{update.title}</h4>
                  <p className="text-gray-700 leading-relaxed text-sm font-light">{update.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}