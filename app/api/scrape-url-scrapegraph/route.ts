import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'scrapegraph-js';

// Function to sanitize smart quotes and other problematic characters
function sanitizeQuotes(text: string): string {
  return text
    // Replace smart single quotes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Replace smart double quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Replace other quote-like characters
    .replace(/[\u00AB\u00BB]/g, '"') // Guillemets
    .replace(/[\u2039\u203A]/g, "'") // Single guillemets
    // Replace other problematic characters
    .replace(/[\u2013\u2014]/g, '-') // En dash and em dash
    .replace(/[\u2026]/g, '...') // Ellipsis
    .replace(/[\u00A0]/g, ' '); // Non-breaking space
}

export async function POST(request: NextRequest) {
  let client: Client | null = null;
  
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }
    
    console.log('[scrape-url-scrapegraph] Scraping with ScrapeGraph AI:', url);
    
    const SCRAPEGRAPH_API_KEY = process.env.SCRAPEGRAPH_API_KEY;
    if (!SCRAPEGRAPH_API_KEY) {
      throw new Error('SCRAPEGRAPH_API_KEY environment variable is not set');
    }
    
    // Initialize ScrapeGraph client
    client = new Client({ apiKey: SCRAPEGRAPH_API_KEY });
    
    // Use smartscraper to extract content from the URL
    const response = await client.smartscraper({
      websiteUrl: url,
      userPrompt: 'Extract the main content from this webpage including title, description, headings, paragraphs, links, and all text content. Preserve the structure and formatting.'
    });
    
    console.log('[scrape-url-scrapegraph] Response received:', response);
    
    if (!response || !response.result) {
      throw new Error('Failed to scrape content - no result returned');
    }
    
    // Convert the result to a markdown-like format
    const resultData = response.result;
    let markdownContent = '';
    
    // Try to extract structured content if available
    if (typeof resultData === 'object') {
      const title = resultData.title || resultData.heading || '';
      const description = resultData.description || resultData.summary || '';
      const content = resultData.content || resultData.text || resultData.body || '';
      
      if (title) markdownContent += `# ${title}\n\n`;
      if (description) markdownContent += `${description}\n\n`;
      if (content) markdownContent += content;
      
      // If no structured content, stringify the object
      if (!markdownContent.trim()) {
        markdownContent = JSON.stringify(resultData, null, 2);
      }
    } else if (typeof resultData === 'string') {
      markdownContent = resultData;
    } else {
      markdownContent = String(resultData);
    }
    
    // Sanitize the markdown content
    const sanitizedMarkdown = sanitizeQuotes(markdownContent || '');
    
    // Extract title and description from the content if available
    const title = typeof resultData === 'object' && resultData.title 
      ? String(resultData.title) 
      : url.split('/').filter(Boolean).pop() || 'Untitled';
    const description = typeof resultData === 'object' && resultData.description 
      ? String(resultData.description) 
      : '';
    
    // Format content for AI
    const formattedContent = `
Title: ${sanitizeQuotes(title)}
Description: ${sanitizeQuotes(description)}
URL: ${url}

Main Content:
${sanitizedMarkdown}
    `.trim();
    
    return NextResponse.json({
      success: true,
      url,
      content: formattedContent,
      screenshot: null, // ScrapeGraph AI doesn't provide screenshots in smartscraper
      structured: {
        title: sanitizeQuotes(title),
        description: sanitizeQuotes(description),
        content: sanitizedMarkdown,
        url,
        screenshot: null
      },
      metadata: {
        scraper: 'scrapegraph-ai',
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        requestId: response.request_id || null,
        cached: false
      },
      message: 'URL scraped successfully with ScrapeGraph AI'
    });
    
  } catch (error) {
    console.error('[scrape-url-scrapegraph] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  } finally {
    // Always close the client connection
    if (client) {
      try {
        client.close();
      } catch (closeError) {
        console.error('[scrape-url-scrapegraph] Error closing client:', closeError);
      }
    }
  }
}


