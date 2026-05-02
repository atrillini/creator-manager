import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["yt3.ggpht.com", "lh3.googleusercontent.com"]);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Missing url param" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid avatar url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ ok: false, error: "Host not allowed" }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: {
      // Alcuni CDN immagini Google sono più permissivi con referer vuoto.
      Referer: "",
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: `Avatar fetch failed: ${upstream.status}` },
      { status: 502 }
    );
  }

  const bytes = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
}
