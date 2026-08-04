import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.vedavector.com";

/**
 * Прокси раздачи файлов: <img>/<video> не умеют слать Bearer, поэтому
 * добавляем его здесь из cookie и стримим ответ API как есть,
 * с пробросом Range (перемотка видео/аудио, 206).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return NextResponse.json(
      { code: "ER500", message: "Not found" },
      { status: 404 }
    );
  }

  const token = (await cookies()).get("auth-token")?.value;
  if (!token) {
    return NextResponse.json(
      { code: "ER208", message: "Unauthorized" },
      { status: 401 }
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const range = request.headers.get("range");
  if (range) headers.Range = range;

  const upstream = await fetch(`${API_URL}/files/${id}`, {
    headers,
    cache: "no-store",
  });

  const passthrough = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-disposition",
    "accept-ranges",
    "content-range",
    "cache-control",
  ]) {
    const value = upstream.headers.get(name);
    if (value) passthrough.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthrough,
  });
}
