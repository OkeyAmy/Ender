'use client';

import React from 'react';
import { useScraperPreference } from '@/hooks/useScraperPreference';
import { cn } from '@/utils/cn';

interface ScraperSelectorProps {
  variant?: 'compact' | 'full';
  className?: string;
  onScraperChange?: (scraper: 'firecrawl' | 'scrapegraph') => void;
}

/**
 * Scraper selection component that allows users to choose between
 * Firecrawl and ScrapeGraph AI scrapers
 */
export default function ScraperSelector({ 
  variant = 'full', 
  className,
  onScraperChange 
}: ScraperSelectorProps) {
  const { 
    scraper, 
    setScraper, 
    scraperDisplayNames, 
    scraperDescriptions,
    availableScrapers 
  } = useScraperPreference();

  const handleChange = (newScraper: 'firecrawl' | 'scrapegraph') => {
    setScraper(newScraper);
    onScraperChange?.(newScraper);
  };

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <span className="text-sm text-gray-600 whitespace-nowrap">Scraper:</span>
        <div className="flex gap-2">
          {availableScrapers.map((scraperOption) => (
            <button
              key={scraperOption}
              onClick={() => handleChange(scraperOption)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                scraper === scraperOption
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              title={scraperDescriptions[scraperOption]}
            >
              {scraperDisplayNames[scraperOption]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-gray-700">
        Web Scraper
      </label>
      <div className="space-y-2">
        {availableScrapers.map((scraperOption) => (
          <label
            key={scraperOption}
            className={cn(
              'flex items-start p-3 rounded-lg border-2 cursor-pointer transition-all',
              scraper === scraperOption
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            )}
          >
            <input
              type="radio"
              name="scraper"
              value={scraperOption}
              checked={scraper === scraperOption}
              onChange={() => handleChange(scraperOption)}
              className="mt-0.5 h-4 w-4 text-orange-500 focus:ring-orange-500"
            />
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-gray-900">
                {scraperDisplayNames[scraperOption]}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {scraperDescriptions[scraperOption]}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}




















