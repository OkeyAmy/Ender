import { NextRequest, NextResponse } from "next/server";
import { Client } from 'scrapegraph-js';

export async function POST(request: NextRequest) {
  let client: Client | null = null;
  
  try {
    const { url, formats = ['markdown', 'html'], options = {} } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }
    
    // Initialize ScrapeGraph client with API key from environment
    const apiKey = process.env.SCRAPEGRAPH_API_KEY;
    
    if (!apiKey) {
      console.error("SCRAPEGRAPH_API_KEY not configured");
      // For demo purposes, return mock data if API key is not set
      return NextResponse.json({
        success: true,
        data: {
          title: "Example Website",
          content: `This is a mock response for ${url}. Configure SCRAPEGRAPH_API_KEY to enable real scraping.`,
          description: "A sample website",
          markdown: `# Example Website\n\nThis is mock content for demonstration purposes.`,
          html: `<h1>Example Website</h1><p>This is mock content for demonstration purposes.</p>`,
          metadata: {
            title: "Example Website",
            description: "A sample website",
            sourceURL: url,
            statusCode: 200
          }
        }
      });
    }
    
    client = new Client({ apiKey });
    
    // Build user prompt based on requested formats
    let userPrompt = 'Extract all content from this webpage including title, description, headings, paragraphs, links, and text.';
    if (formats.includes('html')) {
      userPrompt += ' Preserve HTML structure where possible.';
    }
    if (options.onlyMainContent !== false) {
      userPrompt += ' Focus on main content, excluding navigation, ads, and sidebars.';
    }
    
    // Scrape the website using smartscraper
    const scrapeResult = await client.smartscraper({
      websiteUrl: url,
      userPrompt: userPrompt
    });
    
    // Handle the response
    if (!scrapeResult || !scrapeResult.result) {
      throw new Error("Failed to scrape website - no result returned");
    }
    
    const resultData = scrapeResult.result;
    
    // Process the result into structured data
    let title = "Untitled";
    let description = "";
    let markdownContent = "";
    let htmlContent = "";
    
    if (typeof resultData === 'object') {
      title = resultData.title || resultData.heading || title;
      description = resultData.description || resultData.summary || "";
      
      // Generate markdown content
      if (resultData.title) markdownContent += `# ${resultData.title}\n\n`;
      if (resultData.description) markdownContent += `${resultData.description}\n\n`;
      if (resultData.content) markdownContent += resultData.content;
      if (resultData.text) markdownContent += resultData.text;
      
      // Generate HTML content if requested
      if (formats.includes('html')) {
        htmlContent = `<h1>${title}</h1>`;
        if (description) htmlContent += `<p>${description}</p>`;
        if (resultData.html) {
          htmlContent += resultData.html;
        } else if (resultData.content || resultData.text) {
          htmlContent += `<div>${(resultData.content || resultData.text).replace(/\n/g, '<br>')}</div>`;
        }
      }
      
      // If no structured content, stringify the object
      if (!markdownContent.trim()) {
        markdownContent = JSON.stringify(resultData, null, 2);
      }
    } else if (typeof resultData === 'string') {
      markdownContent = resultData;
      htmlContent = `<div>${resultData.replace(/\n/g, '<br>')}</div>`;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        title: title,
        content: markdownContent || htmlContent || "",
        description: description,
        markdown: markdownContent,
        html: htmlContent,
        metadata: {
          title: title,
          description: description,
          sourceURL: url,
          statusCode: 200,
          scraper: 'scrapegraph-ai',
          requestId: scrapeResult.request_id
        },
        screenshot: null, // ScrapeGraph AI smartscraper doesn't provide screenshots
        links: [], // Could be extracted from result if available
        raw: resultData
      }
    });
    
  } catch (error) {
    console.error("Error scraping website with ScrapeGraph AI:", error);
    
    // Return a more detailed error response
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape website",
      // Provide mock data as fallback for development
      data: {
        title: "Example Website",
        content: "This is fallback content due to an error. Please check your configuration.",
        description: "Error occurred while scraping",
        markdown: `# Error\n\n${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        html: `<h1>Error</h1><p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>`,
        metadata: {
          title: "Error",
          description: "Failed to scrape website",
          statusCode: 500
        }
      }
    }, { status: 500 });
  } finally {
    // Always close the client connection
    if (client) {
      try {
        client.close();
      } catch (closeError) {
        console.error('[scrape-website-scrapegraph] Error closing client:', closeError);
      }
    }
  }
}

// Optional: Add OPTIONS handler for CORS if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}


