import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminUserId = String(
  process.env.ADMIN_USER_ID ?? process.env.INBOX_ALLOWED_USER_ID ?? ""
).trim();

/**
 * Protegge le pagine dell'area gestionale (redirect a /login); il matcher sotto
 * elenca le sezioni. Le route /api fanno il proprio controllo (`lib/api-auth.ts`).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!supabaseUrl || !supabaseAnonKey) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          }
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    if (
      adminUserId &&
      (pathname === "/inbox" || pathname.startsWith("/inbox/")) &&
      user.id !== adminUserId
    ) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/collaborazioni/:path*",
    "/inbox/:path*",
    "/collaborations/:path*",
    "/finanze/:path*",
    "/calendario/:path*",
    "/aziende/:path*",
    "/ricevute/:path*",
  ],
};
