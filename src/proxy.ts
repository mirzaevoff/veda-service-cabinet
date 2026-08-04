import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ["/login"];

function getLocaleFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const locales = routing.locales as readonly string[];
  if (locales.includes(segments[0])) return segments[0];
  return routing.defaultLocale;
}

function getPathWithoutLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const locales = routing.locales as readonly string[];
  if (locales.includes(segments[0])) {
    return "/" + segments.slice(1).join("/") || "/";
  }
  return pathname;
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathWithoutLocale = getPathWithoutLocale(pathname);
  const locale = getLocaleFromPathname(pathname);

  const token = request.cookies.get("auth-token")?.value;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );

  // Авторизованных уводим со страниц входа
  if (token && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  // Неавторизованных — на вход
  if (!token && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
