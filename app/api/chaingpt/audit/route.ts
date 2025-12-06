import { NextRequest, NextResponse } from 'next/server';
import { chainGPTClient } from '@/lib/chaingpt/client';

export async function POST(req: NextRequest) {
  try {
    const { contractCode, userId } = await req.json();
    
    if (!contractCode) {
      return NextResponse.json(
        { error: 'Contract code is required' },
        { status: 400 }
      );
    }
    
    const response = await chainGPTClient.auditContract(contractCode, userId);
    
    return NextResponse.json({
      success: true,
      audit: response.data.bot,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Contract Audit Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to audit contract' },
      { status: 500 }
    );
  }
}