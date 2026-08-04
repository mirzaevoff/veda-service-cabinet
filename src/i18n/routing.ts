import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "en", "uz"],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];
