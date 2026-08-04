# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

Правило: изменения копятся в `[Unreleased]`; при бампе версии (`pnpm version ...`, только по команде) секция переименовывается в номер версии с датой.

## [0.1.0] - 2026-08-04

### Added

- Скелет проекта: Next.js 16 + TypeScript, Tailwind v4, shadcn/ui (base-nova)
- Мультиязычность next-intl: ru (дефолт) / en / uz, роутинг `/[locale]`
- Тёмная/светлая тема (next-themes, по системной)
- Фирменный стиль Veda Service (STYLEGUIDE.md, единый с мобильным приложением): белый фон, красный `#A21500` как единственный акцент, Inter + Unbounded (только бренд), pill-кнопки
- Стартовая страница — вордмарк «Veda Service»
- Прод-инфраструктура: Docker (standalone-сборка, порт 4900), GitHub Actions деплой по пушу в `production` (lint → SSH → `docker compose up -d --build`)
