import { NextRequest, NextResponse } from "next/server";
import { SmartScraperApi } from "scrapegraph-js";

export async function POST(request: NextRequest) {
  try {
    const { url, formats = ["markdown", "html"], options = {} } =
      await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SCRAPEGRAPH_API_KEY;

    // Handle missing API key (show mock response instead of failing)
    if (!apiKey) {
      console.error("SCRAPEGRAPH_API_KEY not configured");
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
            statusCode: 200,
          },
        },
      });
    }

    // Initialize real ScrapeGraph client
    const client = new SmartScraperApi(apiKey);

    // Construct user prompt
    let userPrompt =
      "Extract all readable content from this webpage including title, description, headings, paragraphs, and text.";

    if (formats.includes("html")) {
      userPrompt += " Preserve HTML structure for the content.";
    }

    if (options.onlyMainContent !== false) {
      userPrompt +=
        " Focus only on the main content of the page and exclude ads, navbars, or sidebars.";
    }

    // Call ScrapeGraph smart scraper
    const scrapeResult = await client.run({
      websiteUrl: url,
      userPrompt,
    });

    if (!scrapeResult || !scrapeResult.result) {
      throw new Error("Failed to scrape website – no result returned");
    }

    const resultData = scrapeResult.result;

    // ----------------------------------------------------
    // Process Result
    // ----------------------------------------------------
    let title = "Untitled";
    let description = "";
    let markdownContent = "";
    let htmlContent = "";

    if (typeof resultData === "object") {
      title = resultData.title || resultData.heading || "Untitled";
      description = resultData.description || resultData.summary || "";

      // Markdown assembly
      if (resultData.title)
        markdownContent += `# ${resultData.title}\n\n`;
      if (resultData.description)
        markdownContent += `${resultData.description}\n\n`;
      if (resultData.content) markdownContent += resultData.content;
      if (resultData.text) markdownContent += resultData.text;

      // HTML assembly
      if (formats.includes("html")) {
        htmlContent = `<h1>${title}</h1>`;
        if (description) htmlContent += `<p>${description}</p>`;
        if (resultData.html) {
          htmlContent += resultData.html;
        } else if (resultData.content || resultData.text) {
          htmlContent += `<div>${(resultData.content ||
          resultData.text).replace(/\n/g, "<br>")}</div>`;
        }
      }

      // Fallback for empty content
      if (!markdownContent.trim()) {
        markdownContent = JSON.stringify(resultData, null, 2);
      }
    } else if (typeof resultData === "string") {
      markdownContent = resultData;
      htmlContent = `<div>${resultData.replace(/\n/g, "<br>")}</div>`;
    }

    // ----------------------------------------------------
    // Successful response
    // ----------------------------------------------------
    return NextResponse.json({
      success: true,
      data: {
        title,
        content: markdownContent || htmlContent,
        description,
        markdown: markdownContent,
        html: htmlContent,
        metadata: {
          title,
          description,
          sourceURL: url,
          statusCode: 200,
          scraper: "scrapegraph-ai",
          requestId: scrapeResult.request_id,
        },
        screenshot: null, // ScrapeGraph smartscraper does NOT support screenshots
        links: [],
        raw: resultData,
      },
    });
  } catch (error) {
    console.error(
      "[scrape-website-scrapegraph] Error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to scrape website",
        data: {
          title: "Error",
          content:
            "This is fallback content due to an error. Please check your API key or request.",
          description: "Scraping failed",
          markdown: `# Error\n\n${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }`,
          html: `<h1>Error</h1><p>${
            error instanceof Error
              ? error.message
              : "Unknown error"
          }</p>`,
          metadata: {
            title: "Error",
            description: "Failed to scrape website",
            statusCode: 500,
          },
        },
      },
      { status: 500 }
    );
  }
}

// Allow OPTIONS (CORS support)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
