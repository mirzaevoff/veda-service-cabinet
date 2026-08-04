/**
 * Крошечный in-memory кэш списков на время сессии вкладки: при возврате на
 * страницу показываем прошлые данные мгновенно, свежие подтягиваются фоном.
 */
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T) {
  cache.set(key, value);
}
