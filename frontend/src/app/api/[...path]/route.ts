import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const host = request.headers.get("host");
  const permitted = new Set(["127.0.0.1:3000", "localhost:3000"]);
  const origin = request.headers.get("origin");
  if (!host || !permitted.has(host) || (origin && !["http://127.0.0.1:3000", "http://localhost:3000"].includes(origin))) {
    return NextResponse.json({ detail: "Solo se permiten peticiones locales." }, { status: 403 });
  }
  const path = (await context.params).path.join("/");
  const valid = request.method === "GET" ? /^(health|projects|projects\/[a-f0-9-]{36})$/.test(path) : path === "projects/scan";
  if (!valid) return NextResponse.json({ detail: "Endpoint no disponible." }, { status: 404 });
  let body: string | undefined;
  if (request.method === "POST") {
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return NextResponse.json({ detail: "Se requiere application/json." }, { status: 415 });
    }
    const reader = request.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          await reader.cancel();
          return NextResponse.json({ detail: "Petición demasiado grande." }, { status: 413 });
        }
        chunks.push(value);
      }
    }
    body = Buffer.concat(chunks).toString("utf8");
  }
  try {
    const backend = new URL(process.env.DEVMAP_BACKEND_URL || "http://127.0.0.1:8080");
    if (backend.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(backend.hostname) || backend.username || backend.password) {
      throw new Error("Backend must use loopback");
    }
    const response = await fetch(new URL(`/api/${path}`, backend), {
      method: request.method, body, headers: { "Content-Type": "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    return new NextResponse(await response.text(), {
      status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ detail: "El motor local no responde. Arranca el backend y vuelve a intentarlo." }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST };
