"use client";

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ImageSlider from '@/app/components/ImageSlider';
import EventDetailsComponent from '@/app/components/EventDetails';
import SourcesComponent from '@/app/components/Sources';

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
    console.error('API_SECRET_KEY not found in environment variables');
    throw new Error('API_SECRET_KEY not found in environment variables');
  }

  try {
    const response = await fetch(`${baseUrl}/api/get/details?event_id=${id}&api_key=${apiKey}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch event details: ${response.status} ${response.statusText}`);
      return null;
    }

    const result: EventDetailsResponse = await response.json();
    
    if (!result.success) {
      console.error('API returned success: false');
      return null;
    }

    // Ensure images is always an array
    if (result.data && !Array.isArray(result.data.images)) {
      result.data.images = [];
    }

    return result.data;
  } catch (error) {
    console.error('Error fetching event details:', error);
    return null;
  }
}

async function getEventUpdates(id: string): Promise<EventUpdate[]> {
  const apiKey = process.env.API_SECRET_KEY;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  if (!apiKey) {
    console.error('API_SECRET_KEY not found in environment variables');
    return [];
  }

  try {
    const response = await fetch(`${baseUrl}/api/get/updates?event_id=${id}&api_key=${apiKey}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch event updates: ${response.status} ${response.statusText}`);
      return [];
    }

    const result: EventUpdatesResponse = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error fetching event updates:', error);
    return [];
  }
}

// Loading component for Suspense
function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mb-4"></div>
        <p className="text-gray-600 font-medium">Loading event details...</p>
      </div>
    </div>
  );
}

// Error boundary component
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const { id } = await params;
  
  // Validate ID
  if (!id || isNaN(Number(id))) {
    console.error('Invalid event ID:', id);
    notFound();
  }

  try {
    const [eventDetails, eventUpdates] = await Promise.all([
      getEventDetails(id),
      getEventUpdates(id)
    ]);

    if (!eventDetails) {
      console.error('Event details not found for ID:', id);
      notFound();
    }

    // Ensure we have valid data
    const safeEventDetails = {
      ...eventDetails,
      images: Array.isArray(eventDetails.images) ? eventDetails.images : [],
      sources: Array.isArray(eventDetails.sources) ? eventDetails.sources : [],
      location: eventDetails.location || 'Unknown Location',
      details: eventDetails.details || 'No details available',
    };

    const safeEventUpdates = Array.isArray(eventUpdates) ? eventUpdates : [];

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white sticky top-0 z-50 shadow-sm">
          <div className="max-w-full mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <h1 className="text-2xl font-black tracking-tight uppercase">DEADLINE</h1>
                <nav className="hidden md:flex space-x-6">
                  <a href="#" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Events</a>
                  <a href="#" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Reports</a>
                  <a href="#" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">Timeline</a>
                </nav>
              </div>
              <div className="flex items-center space-x-4">
                <button className="text-gray-400 hover:text-black transition-colors p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </button>
                <button className="text-gray-400 hover:text-black transition-colors p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-gradient-to-br from-black via-gray-900 to-black text-white py-16">
          <div className="max-w-full mx-auto px-8">
            <div className="max-w-5xl space-y-6">
              <div className="flex items-center space-x-4">
                <span className="px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider rounded-full">
                  Event Report
                </span>
                <span className="text-gray-300 text-sm">
                  {new Date(safeEventDetails.created_at || Date.now()).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                {safeEventDetails.details.split('.')[0] || `Event at ${safeEventDetails.location}`}
              </h1>
              <p className="text-xl text-gray-300 font-light max-w-4xl leading-relaxed">
                {safeEventDetails.location}
              </p>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <main className="max-w-full mx-auto px-8 py-16">
          <div className="max-w-none">
            {/* Image Slider Component */}
            <Suspense fallback={
              <div className="mb-16">
                <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b-4 border-black pb-4">
                  Image Gallery
                </h3>
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                </div>
              </div>
            }>
              <ImageSlider images={safeEventDetails.images} />
            </Suspense>

            {/* Event Details Component */}
            <Suspense fallback={
              <div className="mb-16">
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-300 rounded"></div>
                    <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                    <div className="h-4 bg-gray-300 rounded w-4/6"></div>
                  </div>
                </div>
              </div>
            }>
              <EventDetailsComponent 
                eventDetails={safeEventDetails} 
                eventUpdates={safeEventUpdates} 
              />
            </Suspense>

            {/* Sources Component */}
            <Suspense fallback={
              <div className="mb-16">
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            }>
              <SourcesComponent sources={safeEventDetails.sources} />
            </Suspense>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gradient-to-br from-black via-gray-900 to-black text-white py-12 mt-24">
          <div className="max-w-full mx-auto px-8 text-center">
            <h2 className="text-2xl font-black tracking-tight uppercase mb-4">DEADLINE</h2>
            <p className="text-gray-400 text-base font-light">
              Documenting events with precision and clarity
            </p>
          </div>
        </footer>
      </div>
    );

  } catch (error) {
    console.error('Error in EventPage:', error);
    return <ErrorFallback error={error as Error} />;
  }
}