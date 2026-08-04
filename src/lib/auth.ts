import { api, type AuthTokens } from "./api";

/**
 * Токены в cookies (имена — как в dashboard-web-old), чтобы proxy.ts мог
 * закрывать приватные страницы. Refresh живёт 30 дней, access перевыпускается.
 */
const ACCESS_COOKIE = "auth-token";
const REFRESH_COOKIE = "auth-refresh";
const ROLE_COOKIE = "auth-role";
const SESSION_COOKIE = "auth-session-id";

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

function getCookie(name: string): string | undefined {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function saveSession(tokens: AuthTokens) {
  const refreshMaxAge = Math.max(
    0,
    Math.floor((Date.parse(tokens.refreshExpiresAt) - Date.now()) / 1000)
  );
  setCookie(ACCESS_COOKIE, tokens.accessToken, refreshMaxAge);
  setCookie(REFRESH_COOKIE, tokens.refreshToken, refreshMaxAge);
  setCookie(ROLE_COOKIE, tokens.user.role.name, refreshMaxAge);
  if (tokens.sessionId) {
    setCookie(SESSION_COOKIE, tokens.sessionId, refreshMaxAge);
  }
}

export function getSessionId() {
  return getCookie(SESSION_COOKIE);
}

export function clearSession() {
  deleteCookie(ACCESS_COOKIE);
  deleteCookie(REFRESH_COOKIE);
  deleteCookie(ROLE_COOKIE);
  deleteCookie(SESSION_COOKIE);
}

export function getAccessToken() {
  return getCookie(ACCESS_COOKIE);
}

export function getRefreshToken() {
  return getCookie(REFRESH_COOKIE);
}

let refreshInFlight: Promise<AuthTokens> | null = null;

/**
 * Ротация refresh-токена с мьютексом: параллельные вызовы получают один
 * и тот же промис (второй запрос с тем же токеном получил бы 401).
 */
export function refreshSession(): Promise<AuthTokens> {
  if (!refreshInFlight) {
    const token = getRefreshToken();
    refreshInFlight = (
      token
        ? api.refresh(token)
        : Promise.reject(new Error("No refresh token"))
    )
      .then((tokens) => {
        saveSession(tokens);
        return tokens;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function logout() {
  const token = getRefreshToken();
  clearSession();
  if (token) await api.logout(token).catch(() => {});
}
