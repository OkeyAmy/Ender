import { useState, useEffect } from 'react';
import { appConfig } from '@/config/app.config';

type ScraperType = 'firecrawl' | 'scrapegraph';

const STORAGE_KEY = 'preferredScraper';

/**
 * Custom hook for managing scraper preference with localStorage persistence
 */
export function useScraperPreference() {
  const [scraper, setScraper] = useState<ScraperType>(appConfig.scraper.defaultScraper);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (stored === 'firecrawl' || stored === 'scrapegraph')) {
        setScraper(stored as ScraperType);
      }
    } catch (error) {
      console.error('Error reading scraper preference from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save preference to localStorage when it changes
  const setScraperPreference = (newScraper: ScraperType) => {
    setScraper(newScraper);
    try {
      localStorage.setItem(STORAGE_KEY, newScraper);
    } catch (error) {
      console.error('Error saving scraper preference to localStorage:', error);
    }
  };

  return {
    scraper,
    setScraper: setScraperPreference,
    isLoaded,
    availableScrapers: appConfig.scraper.availableScrapers,
    scraperDisplayNames: appConfig.scraper.scraperDisplayNames,
    scraperDescriptions: appConfig.scraper.scraperDescriptions,
  };
}







