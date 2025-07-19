'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Event {
  event_id: number;
  title: string;
  image_url: string | null;
  status: string;
  tags: string[] | null;
  query: string | null;
  summary: string | null;
  last_updated: string | null;
  incident_date: string | null;
}

interface EventsResponse {
  events: Event[];
}

export default function DeadlineEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showHeaderLogo, setShowHeaderLogo] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = 300; // Approximate height of hero section
      setShowHeaderLogo(window.scrollY > heroHeight);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/get/events');
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const data: EventsResponse = await response.json();
        setEvents(data.events);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'NO DATE';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).toUpperCase();
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'injustice':
        return 'INJUSTICE';
      case 'resolved':
        return 'JUSTICE';
      case 'pending':
        return 'DEVELOPING';
      default:
        return status.toUpperCase();
    }
  };

  const handleEventClick = (eventId: number) => {
    router.push(`/event/${eventId}`);
  };

  const categories = ['All', 'Justice', 'Politics', 'Society', 'Breaking'];
  
  const filteredEvents = events.filter(event => {
    const matchesFilter = activeFilter === 'All' || 
      event.tags?.some(tag => tag.toLowerCase().includes(activeFilter.toLowerCase())) ||
      event.status.toLowerCase().includes(activeFilter.toLowerCase());
    
    const matchesSearch = searchTerm === '' ||
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-black font-light tracking-wide">LOADING...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-black font-bold text-2xl mb-4 tracking-wide">ERROR</div>
          <p className="text-gray-600 font-light">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50 h-16">
        <div className="max-w-7xl mx-auto px-6 h-full">
          <div className="flex items-center justify-between h-full">
            <h1 className={`text-2xl font-black tracking-tight transition-opacity duration-300 ${showHeaderLogo ? 'opacity-100' : 'opacity-0'}`}>
              DEADLINE
            </h1>
            
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                {isSearchOpen ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Search stories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64 px-4 py-2 text-sm border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      autoFocus
                    />
                    <button 
                      onClick={() => {
                        setIsSearchOpen(false);
                        setSearchTerm('');
                      }}
                      className="text-sm font-light hover:text-gray-600 transition-colors"
                    >
                      CLOSE
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="text-sm font-light hover:text-gray-600 transition-colors"
                  >
                    SEARCH
                  </button>
                )}
              </div>
              
              <button className="w-5 h-5 flex items-center justify-center">
                <div className="w-4 h-4 border border-black"></div>
              </button>
              <button className="w-5 h-5 flex items-center justify-center">
                <div className="w-4 h-4 bg-black"></div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Title */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h2 className="text-6xl md:text-8xl font-black tracking-tight text-black mb-4">
            DEADLINE
          </h2>
          <p className="text-lg font-light text-gray-600 tracking-wide">
            CRITICAL EVENTS & ONGOING STORIES
          </p>
        </div>
      </section>

      {/* Filter Bar */}
      <section className="border-b border-gray-200 bg-white sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveFilter(category)}
                className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide transition-all duration-200 ${
                  activeFilter === category
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <article 
              key={event.event_id} 
              onClick={() => handleEventClick(event.event_id)}
              className="group cursor-pointer"
            >
              {/* Image */}
              <div className="relative h-64 mb-6 overflow-hidden bg-gray-100">
                <Image
                  src={event.image_url || '/api/placeholder/400/300'}
                  alt={event.title}
                  fill
                  className="object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/api/placeholder/400/300';
                  }}
                />
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Date and Status */}
                <div className="flex items-center justify-between text-xs font-light tracking-widest text-gray-500">
                  <time>{formatDate(event.incident_date)}</time>
                  <span className="bg-black text-white px-2 py-1 tracking-wide">
                    {getStatusLabel(event.status)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold tracking-tight text-black leading-tight group-hover:text-gray-600 transition-colors">
                  {event.title}
                </h3>

                {/* Summary */}
                <p className="text-gray-600 font-light leading-relaxed text-sm line-clamp-3">
                  {event.summary || 'Breaking story developing...'}
                </p>

                {/* Tags */}
                {event.tags && event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {event.tags.slice(0, 2).map((tag, index) => (
                      <span
                        key={index}
                        className="text-xs font-light text-gray-500 border border-gray-300 px-2 py-1 tracking-wide"
                      >
                        {tag.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta Info */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs font-light text-gray-500 tracking-wide">
                    DEADLINE STAFF
                  </span>
                  <span className="text-xs font-light text-gray-500 tracking-wide">
                    {formatDate(event.last_updated)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {filteredEvents.length === 0 && !loading && (
          <div className="text-center py-24">
            <div className="text-gray-500 font-light tracking-wide text-lg">
              {searchTerm ? `NO STORIES FOUND FOR "${searchTerm.toUpperCase()}"` : "NO STORIES MATCH YOUR FILTER"}
            </div>
            <button 
              onClick={() => {
                setActiveFilter('All');
                setSearchTerm('');
              }}
              className="mt-4 text-black font-medium hover:text-gray-600 transition-colors"
            >
              {searchTerm ? 'CLEAR SEARCH' : 'VIEW ALL STORIES'}
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-24">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="text-center">
            <h3 className="text-2xl font-black tracking-tight mb-4">DEADLINE</h3>
            <p className="text-sm font-light text-gray-600 tracking-wide">
              INDEPENDENT JOURNALISM FOR THE DIGITAL AGE
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}