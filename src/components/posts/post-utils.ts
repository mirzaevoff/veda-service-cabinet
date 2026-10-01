import type { PostLocale } from "@/lib/api";

/** Базовый адрес публичного сайта (для ссылок на живые страницы постов) */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vedavector.com";

export const POST_LOCALES: PostLocale[] = ["ru", "uz", "en"];

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
  // узбекские кириллические
  ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Транслитерация в латиницу (для превью адреса до сохранения) */
export function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => (ch in CYR ? CYR[ch] : ch))
    .join("");
}

/**
 * Приблизительный slug из заголовка — как сгенерит бэкенд, но итоговый адрес
 * всё равно возвращает сервер. «Наш новый сервис» → `nash-novyy-servis`.
 */
export function slugify(text: string): string {
  return transliterate(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

/** Вариант занятого slug — предлагаем, но подставляем только по клику */
export function suggestSlug(slug: string): string {
  const m = slug.match(/^(.*?)-(\d+)$/);
  if (m) return `${m[1]}-${Number(m[2]) + 1}`;
  return `${slug}-2`;
}

/** Живой адрес страницы поста на сайте */
export function liveUrl(locale: PostLocale, slug: string): string {
  return `${SITE_URL}/${locale}/posts/${slug}`;
}
