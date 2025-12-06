import { NextRequest, NextResponse } from 'next/server';
import { chainGPTClient } from '@/lib/chaingpt/client';

export async function POST(req: NextRequest) {
  try {
    const { question, userId } = await req.json();
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }
    
    const response = await chainGPTClient.chat(question, userId);
    
    return NextResponse.json({
      success: true,
      data: response.data
    });
    
  } catch (error: any) {
    console.error('ChainGPT Chat Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

// For streaming responses
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const question = searchParams.get('question');
  const userId = searchParams.get('userId');
  
  if (!question) {
    return NextResponse.json(
      { error: 'Question is required' },
      { status: 400 }
    );
  }
  
  const stream = await chainGPTClient.chat(question, userId!);
  
  // Create a ReadableStream for SSE
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      }
      controller.close();
    }
  });
  
  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}