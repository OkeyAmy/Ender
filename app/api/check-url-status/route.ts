import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Lovable-Status-Check/1.0',
            },
            // Set a short timeout to avoid hanging
            signal: AbortSignal.timeout(5000),
        });

        return NextResponse.json({
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
        });
    } catch (error: any) {
        console.error('[check-url-status] Error checking URL:', error);
        return NextResponse.json({
            status: 500,
            statusText: error.message || 'Internal Server Error',
            ok: false,
            error: error.message,
        });
    }
}
