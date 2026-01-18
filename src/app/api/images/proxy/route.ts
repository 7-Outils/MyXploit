import { NextRequest, NextResponse } from "next/server";

// GET /api/images/proxy?url=... - Proxy images to avoid CORS issues
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
    }

    // Validate that the URL is from our R2 bucket
    const allowedDomains = [
      "pub-59d71cfad76a4d5e974b039970b32547.r2.dev",
      "r2.dev",
    ];

    const urlObj = new URL(url);
    const isAllowed = allowedDomains.some((domain) => urlObj.hostname.includes(domain));

    if (!isAllowed) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }

    // Fetch the image
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    // Return the image with proper headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error proxying image:", error);
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 500 });
  }
}
