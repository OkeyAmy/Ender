'use client';

import { useState, useEffect } from 'react';
import { appConfig } from '@/config/app.config';

interface ScraperSelectorProps {
  value?: string;
  onChange?: (scraper: string) => void;
  className?: string;
  compact?: boolean;
}

export default function ScraperSelector({ 
  value, 
  onChange, 
  className = '',
  compact = false 
}: ScraperSelectorProps) {
  const [selectedScraper, setSelectedScraper] = useState<string>(
    value || appConfig.scraper.defaultScraper
  );

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedScraper = localStorage.getItem('preferredScraper');
      if (savedScraper && appConfig.scraper.availableScrapers.includes(savedScraper as any)) {
        setSelectedScraper(savedScraper);
        // Notify parent if controlled
        if (onChange && !value) {
          onChange(savedScraper);
        }
      }
    }
  }, []);

  // Update when value prop changes (controlled component)
  useEffect(() => {
    if (value && value !== selectedScraper) {
      setSelectedScraper(value);
    }
  }, [value]);

  const handleChange = (scraper: string) => {
    setSelectedScraper(scraper);
    
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredScraper', scraper);
    }
    
    // Notify parent component
    if (onChange) {
      onChange(scraper);
    }
  };

  if (compact) {
    // Compact dropdown version for mobile or tight spaces
    return (
      <div className={`scraper-selector-compact ${className}`}>
        <select
          value={selectedScraper}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2.5 text-[10px] font-medium text-gray-700 bg-white rounded border border-gray-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          {appConfig.scraper.availableScrapers.map((scraper) => (
            <option key={scraper} value={scraper}>
              {appConfig.scraper.scraperDisplayNames[scraper]}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Full radio button version for desktop
  return (
    <div className={`scraper-selector ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2">
        {appConfig.scraper.availableScrapers.map((scraper) => (
          <button
            key={scraper}
            onClick={() => handleChange(scraper)}
            className={`
              flex-1 py-2.5 px-3 rounded text-[10px] font-medium border transition-all text-center
              ${selectedScraper === scraper 
                ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-sm' 
                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }
            `}
            title={appConfig.scraper.scraperDescriptions[scraper]}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="font-semibold">
                {appConfig.scraper.scraperDisplayNames[scraper]}
              </span>
              {!compact && (
                <span className="text-[8px] text-gray-500 hidden sm:block">
                  {appConfig.scraper.scraperDescriptions[scraper]}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


