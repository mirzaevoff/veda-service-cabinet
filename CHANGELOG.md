# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

Правило: изменения копятся в `[Unreleased]`; при бампе версии (`pnpm version ...`, только по команде) секция переименовывается в номер версии с датой.

## [Unreleased]

### Added

- Переключатель языка (ru / uz / en) на страницах входа и главной

### Fixed

- Деплои в production больше не выполняются параллельно (concurrency group в GitHub Actions — гонка ломала пересоздание Docker-контейнера)

## [0.2.0] - 2026-08-04

### Added

- Авторизация по номеру телефона (passwordless, api.vedavector.com): вход, регистрация (имя), подтверждение 6-значным SMS-кодом — единый мастер на `/login` с шагами телефон → имя → код
- Компоненты: маска телефона `+998 XX XXX XX XX`, OTP-ячейки по гайду (активная с акцентной рамкой, ошибка с тряской), таймер повторной отправки
- Обработка ошибок API по кодам ER2xx (тексты на ru/uz/en), сетевых ошибок
- Сессия: access/refresh-токены в cookies, ротация refresh с мьютексом, выход с отзывом токена
- Защита маршрутов в `src/proxy.ts`: без токена — на `/login`, с токеном `/login` недоступен
- Шапка на главной: имя пользователя (`GET /users/me`) и кнопка «Выйти»

## [0.1.0] - 2026-08-04

### Added

- Скелет проекта: Next.js 16 + TypeScript, Tailwind v4, shadcn/ui (base-nova)
- Мультиязычность next-intl: ru (дефолт) / en / uz, роутинг `/[locale]`
- Тёмная/светлая тема (next-themes, по системной)
- Фирменный стиль Veda Service (STYLEGUIDE.md, единый с мобильным приложением): белый фон, красный `#A21500` как единственный акцент, Inter + Unbounded (только бренд), pill-кнопки
- Стартовая страница — вордмарк «Veda Service»
- Прод-инфраструктура: Docker (standalone-сборка, порт 4900), GitHub Actions деплой по пушу в `production` (lint → SSH → `docker compose up -d --build`)
