"use client";

/**
 * Ошибка на уровне корневого layout — i18n может быть недоступен,
 * поэтому текст статичный (ru + en), стили инлайном.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#ffffff",
          color: "#111111",
          textAlign: "center",
          padding: 24,
        }}
      >
        <span style={{ color: "#a21500", fontWeight: 700, fontSize: 20 }}>
          Veda Service
        </span>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Что-то пошло не так
        </h1>
        <p style={{ margin: 0, color: "#747474", fontSize: 14, maxWidth: 360 }}>
          Попробуйте обновить страницу. Something went wrong — please retry.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            height: 48,
            padding: "0 32px",
            borderRadius: 9999,
            border: "none",
            background: "#a21500",
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Обновить
        </button>
      </body>
    </html>
  );
}
