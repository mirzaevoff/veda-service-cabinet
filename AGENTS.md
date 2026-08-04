<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# cabinet.vedavector.com

Кабинет (панель) проекта Veda Service. Пользователи — админы и клиенты. Преемник `../dashboard-web-old`.

## Стек

- Next.js 16 (App Router, RSC) + TypeScript + React 19
- Tailwind CSS v4, shadcn/ui (style `base-nova`, @base-ui/react, lucide-react)
- next-intl 4 — локали `ru` (дефолт), `en`, `uz`; тексты в `messages/*.json`
- next-themes — тёмная/светлая тема (class на `<html>`)
- Шрифты: Inter (`font-sans`, весь текст) + Unbounded (`font-brand`, ТОЛЬКО бренд/вордмарки)
- Дизайн: см. **STYLEGUIDE.md** — белый фон, красный `#A21500` как единственный акцент, pill-кнопки, без эмодзи в UI (иконки lucide)
- Пакетный менеджер: **pnpm**

## Структура

- `src/app/[locale]/` — все страницы (layout с провайдерами тем/i18n)
- `src/app/layout.tsx` — passthrough
- `src/proxy.ts` — next-intl middleware (в Next 16 это замена `middleware.ts`)
- `src/i18n/` — routing + request config
- `src/components/ui/` — shadcn-компоненты, `src/components/common/` — общие, `src/components/auth/` — авторизация
- `src/lib/api.ts` — клиент API (база: `NEXT_PUBLIC_API_URL`, дефолт https://api.vedavector.com; ошибки `{code, message, data?}`), `src/lib/auth.ts` — сессия (cookies `auth-token`/`auth-refresh`/`auth-role`, refresh с мьютексом)
- Документация API: `../api.vedavector.com/md_docs/` (обновляется там же); локальный API для разработки: `PORT=4901 node dist/main` в проекте api (SMS_MODE=mock — код печатается в лог)

## Релизный флоу (заливка)

Строго в таком порядке, по команде:

1. **Ченжлог**: в `CHANGELOG.md` секцию `[Unreleased]` переименовать в `[X.Y.Z] - дата`
2. **Бамп**: поднять `version` в `package.json` (SemVer)
3. **Коммит + тег**: `git commit -m "chore(release): X.Y.Z"` (ченжлог + package.json) и `git tag vX.Y.Z`
   (`pnpm version` не подходит — падает из-за изменённого ченжлога в дереве)
4. **Пуш**: `git push origin main vX.Y.Z`
5. **Продакшн**: `git push origin main:production` — это триггерит деплой

## Деплой

Как у veda-service-api: пуш в ветку `production` → GitHub Actions (`.github/workflows/deploy.yml`) прогоняет lint и по SSH делает на сервере `git reset --hard origin/production` + `docker compose up -d --build`. Секреты: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`, `DEPLOY_PATH`.

Прод-порт — **4900** (задан в Dockerfile/docker-compose, Next standalone-сборка, `output: "standalone"`).

## Команды

```bash
pnpm dev    # dev-сервер
pnpm build  # прод-сборка
pnpm lint   # eslint
```
