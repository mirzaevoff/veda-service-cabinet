const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.vedavector.com";

/**
 * URL картинки для показа:
 * - публичные (`/files/public/:id`, напр. скриншоты «Обновлений») раздаются
 *   без авторизации → берём абсолютным адресом API;
 * - приватные (`/files/:id`, напр. картинки БЗ) идут через серверный прокси
 *   кабинета `/api/files/:id`, который подставляет Bearer из cookie.
 * В `content` при этом всегда хранится канонический путь (для мобилки/API).
 */
export function fileProxyUrl(url: string): string {
  if (!url) return url;
  // публичный файл — абсолютный адрес API, без прокси
  if (url.startsWith("/files/public/")) return `${API_URL}${url}`;
  if (/^https?:\/\/.+\/files\/public\//i.test(url)) return url;
  // приватный — через прокси кабинета
  if (url.startsWith("/api/files/")) return url;
  if (url.startsWith("/files/")) return `/api${url}`;
  const m = url.match(/\/files\/([a-f0-9]{24})(?:$|[/?#])/i);
  if (m) return `/api/files/${m[1]}`;
  return url;
}

/** id файла из приватного url `/files/:id` */
export function fileIdFromUrl(url: string): string | null {
  const m = url.match(/\/files\/([a-f0-9]{24})/i);
  return m ? m[1] : null;
}
