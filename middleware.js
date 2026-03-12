import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protect /app/* routes
  if (pathname.startsWith('/app') && !user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Redirect logged-in users away from auth pages
  if ((pathname.startsWith('/auth')) && user) {
    return NextResponse.redirect(new URL('/app/send', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/app/:path*', '/auth/:path*'],
};
