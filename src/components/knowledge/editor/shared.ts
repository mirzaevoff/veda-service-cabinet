/**
 * Приватные картинки БЗ: в `content` хранится канонический приватный
 * путь `/files/:id` (для мобилки и API), а показываем через серверный
 * прокси кабинета `/api/files/:id`, который подставляет Bearer из cookie.
 * Так `<img>` работает без клиентского fetch+blob.
 */
export function fileProxyUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/api/files/")) return url;
  if (url.startsWith("/files/")) return `/api${url}`;
  // абсолютный /files/:id (на случай PUBLIC_BASE_URL)
  const m = url.match(/\/files\/([a-f0-9]{24})(?:$|[/?#])/i);
  if (m) return `/api/files/${m[1]}`;
  return url;
}

/** id файла из приватного url `/files/:id` */
export function fileIdFromUrl(url: string): string | null {
  const m = url.match(/\/files\/([a-f0-9]{24})/i);
  return m ? m[1] : null;
}
