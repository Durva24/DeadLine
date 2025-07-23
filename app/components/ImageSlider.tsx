"use client";

import React, { useState, useEffect, useRef } from 'react';

interface ImageSliderProps {
  images: string[];
}

export default function ImageSlider({ images }: ImageSliderProps) {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const sliderRef = useRef<HTMLDivElement>(null);

  // Initialize loading state for all images
  useEffect(() => {
    const initialLoading: Record<number, boolean> = {};
    images.forEach((_, index) => {
      initialLoading[index] = true;
    });
    setImageLoading(initialLoading);
    setImageErrors({});
  }, [images]);

  const handleImageError = (index: number) => {
    setImageErrors(prev => ({ ...prev, [index]: true }));
    setImageLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoad = (index: number) => {
    setImageLoading(prev => ({ ...prev, [index]: false }));
  };

  const scrollToNext = () => {
    if (sliderRef.current) {
      const slideWidth = 320;
      const gap = 16;
      const scrollAmount = slideWidth + gap;
      sliderRef.current.scrollBy({ 
        left: scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  const scrollToPrev = () => {
    if (sliderRef.current) {
      const slideWidth = 320;
      const gap = 16;
      const scrollAmount = slideWidth + gap;
      sliderRef.current.scrollBy({ 
        left: -scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  if (!images || images.length === 0) {
    return (
      <section className="mb-16">
        <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b-4 border-black pb-4">
          Image Gallery
        </h3>
        <div className="text-center py-12 text-gray-500">
          <p>No images to display</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-16">
      <h3 className="text-2xl font-black uppercase tracking-tight mb-8 border-b-4 border-black pb-4">
        Image Gallery
      </h3>
      <div className="relative">
        {/* Navigation buttons */}
        {images.length > 1 && (
          <>
            <button
              onClick={scrollToPrev}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-3 rounded-full transition-all duration-200 z-20 shadow-lg hover:scale-110"
              type="button"
              aria-label="Previous image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={scrollToNext}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-3 rounded-full transition-all duration-200 z-20 shadow-lg hover:scale-110"
              type="button"
              aria-label="Next image"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Scrollable container */}
        <div
          ref={sliderRef}
          className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {images.map((image, index) => (
            <div
              key={`image-${index}-${image}`}
              className="flex-shrink-0 w-80 h-64 bg-gray-100 rounded-lg overflow-hidden group relative shadow-lg hover:shadow-xl transition-shadow duration-300"
              style={{ scrollSnapAlign: 'start' }}
            >
              {imageErrors[index] ? (
                <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50">
                  <div className="text-center text-gray-500 p-4">
                    <svg className="w-16 h-16 mx-auto mb-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold mb-1">Image failed to load</p>
                    <p className="text-xs text-gray-400 break-all px-2">{image}</p>
                    <button 
                      onClick={() => {
                        setImageErrors(prev => ({ ...prev, [index]: false }));
                        setImageLoading(prev => ({ ...prev, [index]: true }));
                      }}
                      className="mt-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {imageLoading[index] && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-blue-500 mb-3"></div>
                        <p className="text-sm text-gray-600 font-medium">Loading image...</p>
                      </div>
                    </div>
                  )}
                  <img
                    src={image}
                    alt={`Gallery image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onLoad={() => handleImageLoad(index)}
                    onError={() => handleImageError(index)}
                    draggable={false}
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end">
                    <div className="p-4 text-white">
                      <p className="text-sm font-bold">Image {index + 1}</p>
                      <p className="text-xs opacity-90">Click to view full size</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center mt-6">
          <div className="text-sm text-gray-600 bg-gray-100 px-6 py-3 rounded-full border border-gray-200 shadow-sm">
            <span className="font-bold text-black">{images.length}</span> 
            <span className="mx-1">image{images.length !== 1 ? 's' : ''}</span>
            {images.length > 1 && (
              <>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-gray-500">Scroll to navigate</span>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}