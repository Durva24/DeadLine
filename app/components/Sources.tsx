"use client";

import { useState, useEffect } from 'react';

interface SourcesProps {
  sources: string[];
}

interface SourceData {
  title?: string;
  favicon?: string;
  domain?: string;
  loading: boolean;
  error?: boolean;
}

function SourcePreview({ url, index }: { url: string; index: number }) {
  const [sourceData, setSourceData] = useState<SourceData>({ loading: true });

  useEffect(() => {
    const fetchSourceData = async () => {
      try {
        setSourceData({ loading: true });
        
        const proxyUrls = [
          `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
          `https://corsproxy.io/?${encodeURIComponent(url)}`
        ];
        
        let htmlContent = '';
        let success = false;
        
        for (const proxyUrl of proxyUrls) {
          try {
            const response = await fetch(proxyUrl);
            if (response.ok) {
              const data = await response.json();
              htmlContent = data.contents || data;
              success = true;
              break;
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!success) {
          throw new Error('Failed to fetch');
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        const title = 
          doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
          doc.querySelector('title')?.textContent?.split(' - ').pop()?.split(' | ').pop() ||
          new URL(url).hostname.replace('www.', '');
        
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        setSourceData({
          loading: false,
          title: title.trim(),
          favicon,
          domain
        });
        
      } catch (error) {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname;
          setSourceData({
            loading: false,
            error: true,
            domain,
            title: domain.replace('www.', ''),
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
          });
        } catch {
          setSourceData({
            loading: false,
            error: true,
            title: 'Invalid URL'
          });
        }
      }
    };

    if (url) {
      fetchSourceData();
    }
  }, [url]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">{index + 1}</span>
        </div>
        
        {sourceData.loading ? (
          <div className="animate-pulse flex items-center space-x-3 flex-1">
            <div className="w-6 h-6 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-32"></div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {sourceData.favicon && (
              <img 
                src={sourceData.favicon} 
                alt="" 
                className="w-6 h-6 rounded flex-shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-gray-900 text-sm truncate">
                {sourceData.title}
              </h4>
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs hover:underline truncate block"
              >
                {sourceData.domain}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcesComponent({ sources }: SourcesProps) {
  if (!sources || sources.length === 0) return null;

  const validSources = sources.filter(source => {
    try {
      new URL(source);
      return true;
    } catch {
      return false;
    }
  });

  if (validSources.length === 0) return null;

  return (
    <section className="mb-8">
      <h3 className="text-xl font-bold mb-4">
        Sources
      </h3>
      <div className="grid gap-3">
        {validSources.map((source, index) => (
          <SourcePreview key={`${source}-${index}`} url={source} index={index} />
        ))}
      </div>
    </section>
  );
}