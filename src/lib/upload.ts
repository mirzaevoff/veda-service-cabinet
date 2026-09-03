import { ApiError, type ApiErrorBody, type FileAttachment } from "./api";
import { getAccessToken, refreshSession } from "./auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.vedavector.com";

/** Лимиты из md_docs/modules/files.md — валидируем до запроса */
const LIMITS: { kind: string; mimes: string[]; maxBytes: number }[] = [
  {
    kind: "image",
    mimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    maxBytes: 15 * 1024 * 1024,
  },
  {
    kind: "video",
    mimes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: 200 * 1024 * 1024,
  },
  {
    kind: "audio",
    mimes: [
      "audio/mpeg",
      "audio/mp4",
      "audio/aac",
      "audio/ogg",
      "audio/wav",
      "audio/x-m4a",
    ],
    maxBytes: 30 * 1024 * 1024,
  },
  { kind: "file", mimes: ["application/pdf"], maxBytes: 30 * 1024 * 1024 },
];

export const UPLOAD_ACCEPT = LIMITS.flatMap((l) => l.mimes).join(",");
export const MAX_ATTACHMENTS = 10;

/** null — тип не поддерживается */
export function uploadLimitFor(file: File) {
  return LIMITS.find((l) => l.mimes.includes(file.type)) ?? null;
}

function xhrUpload(
  file: File,
  token: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
  isPublic?: boolean
): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/files`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () =>
      reject(new ApiError(0, { code: "NETWORK", message: "Network error" }));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as FileAttachment);
      } else {
        const body = (xhr.response ?? {
          code: "ER100",
          message: "Upload failed",
        }) as ApiErrorBody;
        reject(new ApiError(xhr.status, body));
      }
    };

    signal?.addEventListener("abort", () => xhr.abort());

    const form = new FormData();
    form.append("file", file);
    if (isPublic) form.append("public", "true");
    xhr.send(form);
  });
}

export async function uploadFile(
  file: File,
  opts: {
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
    /** Публичный файл (нужно право notifications.send) — абсолютный url для рассылок */
    public?: boolean;
  } = {}
): Promise<FileAttachment> {
  const limit = uploadLimitFor(file);
  if (!limit) {
    throw new ApiError(400, { code: "ER501", message: "Type not allowed" });
  }
  if (file.size > limit.maxBytes) {
    throw new ApiError(400, {
      code: "ER502",
      message: "File too large",
      data: { maxBytes: limit.maxBytes },
    });
  }

  const token = getAccessToken();
  if (!token) throw new ApiError(401, { code: "ER208", message: "No token" });

  try {
    return await xhrUpload(file, token, opts.onProgress, opts.signal, opts.public);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const tokens = await refreshSession();
    return xhrUpload(
      file,
      tokens.accessToken,
      opts.onProgress,
      opts.signal,
      opts.public
    );
  }
}

/** Ответ загрузчика картинок Editor.js — POST /knowledge/uploads/image */
export interface EditorImageUpload {
  success: number;
  file: { url: string; id: string };
}

async function knowledgeImageAttempt(
  file: File,
  token: string
): Promise<EditorImageUpload> {
  const form = new FormData();
  form.append("image", file);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/knowledge/uploads/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new ApiError(0, { code: "NETWORK", message: "Network error" });
  }
  const body = (await res.json().catch(() => null)) as
    | EditorImageUpload
    | ApiErrorBody
    | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (body as ApiErrorBody) ?? { code: "ER100", message: "Upload failed" }
    );
  }
  return body as EditorImageUpload;
}

/** Загрузка inline-картинки статьи БЗ (приватно, через FilesModule) */
export async function uploadKnowledgeImage(
  file: File
): Promise<EditorImageUpload> {
  const limit = uploadLimitFor(file);
  if (!limit || limit.kind !== "image") {
    throw new ApiError(400, { code: "ER501", message: "Type not allowed" });
  }
  if (file.size > limit.maxBytes) {
    throw new ApiError(400, {
      code: "ER502",
      message: "File too large",
      data: { maxBytes: limit.maxBytes },
    });
  }
  const token = getAccessToken();
  if (!token) throw new ApiError(401, { code: "ER208", message: "No token" });
  try {
    return await knowledgeImageAttempt(file, token);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const tokens = await refreshSession();
    return knowledgeImageAttempt(file, tokens.accessToken);
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
