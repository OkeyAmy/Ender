import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'scrapegraph-js';

export async function POST(req: NextRequest) {
  let client: Client | null = null;
  
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Initialize ScrapeGraph client with API key from environment
    const apiKey = process.env.SCRAPEGRAPH_API_KEY;
    
    if (!apiKey) {
      console.error("SCRAPEGRAPH_API_KEY not configured");
      return NextResponse.json({ 
        error: 'ScrapeGraph API key not configured' 
      }, { status: 500 });
    }
    
    client = new Client({ apiKey });

    console.log('[scrape-screenshot-scrapegraph] Attempting to capture screenshot for:', url);

    // Note: ScrapeGraph AI's smartscraper doesn't directly provide screenshot functionality
    // like Firecrawl does. We'll use it to scrape content and note this limitation.
    // For actual screenshot capability, you may need to use a different ScrapeGraph API endpoint
    // or combine with another service.
    
    const scrapeResult = await client.smartscraper({
      websiteUrl: url,
      userPrompt: 'Extract the page title, description, and main visual elements description.'
    });

    console.log('[scrape-screenshot-scrapegraph] Scrape result:', scrapeResult);
    
    if (!scrapeResult || !scrapeResult.result) {
      throw new Error('Failed to scrape content - no result returned');
    }

    // ScrapeGraph AI smartscraper doesn't provide screenshots directly
    // Return the scraped data with a note about screenshot unavailability
    return NextResponse.json({
      success: true,
      screenshot: null, // Screenshot not available through ScrapeGraph smartscraper
      metadata: {
        scraper: 'scrapegraph-ai',
        requestId: scrapeResult.request_id,
        note: 'Screenshots are not available through ScrapeGraph AI smartscraper. Use Firecrawl for screenshot functionality.',
        result: scrapeResult.result
      },
      message: 'Content scraped successfully, but screenshots are not available with ScrapeGraph AI'
    });

  } catch (error: any) {
    console.error('[scrape-screenshot-scrapegraph] Screenshot capture error:', error);
    console.error('[scrape-screenshot-scrapegraph] Error stack:', error.stack);
    
    return NextResponse.json({ 
      error: error.message || 'Failed to capture screenshot',
      note: 'ScrapeGraph AI does not provide screenshot functionality. Please use Firecrawl for screenshots.'
    }, { status: 500 });
  } finally {
    // Always close the client connection
    if (client) {
      try {
        client.close();
      } catch (closeError) {
        console.error('[scrape-screenshot-scrapegraph] Error closing client:', closeError);
      }
    }
  }
}


