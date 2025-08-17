// Cloudflare Workers (TypeScript, ESM)
//  - GET /ga/summary   -> { ok, rows: [{ sourceMedium, users, pageviews }] }
//  - GET /ga/daily?days=14 -> { ok, rows: [{ date, users, pageviews }] }
//  - GET /ga/pages?limit=20 -> { ok, rows: [{ path, views }] }
//  - GET /ga/realtime -> { ok, activeUsers }

export interface Env {
  GA_SA_EMAIL: string;
  GA_SA_PRIVATE_KEY: string;
  GA_PROPERTY_ID: string; // e.g. "499359404"
}

/** 허용 오리진(배포 + 로컬 개발) */
const ALLOW_ORIGINS = new Set<string>([
  "https://www.planearth.co.kr",
  "https://planearth.co.kr",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin");
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors(origin) });
    }

    try {
      // 1) 트래픽 요약 (소스/미디엄)
      if (url.pathname === "/ga/summary") {
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
          dimensions: [{ name: "sessionSourceMedium" }],
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          sourceMedium: row.dimensionValues?.[0]?.value ?? "(unknown)",
          users: Number(row.metricValues?.[0]?.value ?? 0),
          pageviews: Number(row.metricValues?.[1]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 2) 일별 추이
      if (url.pathname === "/ga/daily") {
        const days = clampInt(url.searchParams.get("days"), 1, 90, 14); // 기본 14일
        const data = await gaReport(env, {
          dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
          dimensions: [{ name: "date" }],
          orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          date: toDateStr(row.dimensionValues?.[0]?.value), // "20250817" -> "2025-08-17"
          users: Number(row.metricValues?.[0]?.value ?? 0),
          pageviews: Number(row.metricValues?.[1]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 3) 인기 페이지
      if (url.pathname === "/ga/pages") {
        const limit = clampInt(url.searchParams.get("limit"), 1, 100, 20);
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "screenPageViews" }],
          dimensions: [{ name: "pagePath" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit,
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          path: row.dimensionValues?.[0]?.value ?? "/",
          views: Number(row.metricValues?.[0]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 4) 실시간
      if (url.pathname === "/ga/realtime") {
        const data = await gaRealtime(env, {
          metrics: [{ name: "activeUsers" }],
        });
        const activeUsers = Number(data.totals?.[0]?.metricValues?.[0]?.value ?? 0);
        return json({ ok: true, activeUsers }, origin);
      }

      // 5) 디바이스별 분석
      if (url.pathname === "/ga/devices") {
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
          dimensions: [{ name: "deviceCategory" }],
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          device: row.dimensionValues?.[0]?.value ?? "unknown",
          users: Number(row.metricValues?.[0]?.value ?? 0),
          pageviews: Number(row.metricValues?.[1]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 6) 국가별 방문자
      if (url.pathname === "/ga/countries") {
        const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "country" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit,
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          country: row.dimensionValues?.[0]?.value ?? "unknown",
          users: Number(row.metricValues?.[0]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 7) 브라우저별 통계
      if (url.pathname === "/ga/browsers") {
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "browser" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 10,
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          browser: row.dimensionValues?.[0]?.value ?? "unknown",
          users: Number(row.metricValues?.[0]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 8) 신규 vs 재방문자
      if (url.pathname === "/ga/user-types") {
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }, { name: "newUsers" }],
        });

        const totalUsers = Number(data.totals?.[0]?.metricValues?.[0]?.value ?? 0);
        const newUsers = Number(data.totals?.[0]?.metricValues?.[1]?.value ?? 0);
        const returningUsers = totalUsers - newUsers;

        return json({ 
          ok: true, 
          newUsers, 
          returningUsers, 
          totalUsers,
          newUserPercent: totalUsers ? Math.round((newUsers / totalUsers) * 100) : 0
        }, origin);
      }

      // 9) 시간대별 트래픽
      if (url.pathname === "/ga/hourly") {
        const data = await gaReport(env, {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [{ name: "activeUsers" }],
          dimensions: [{ name: "hour" }],
          orderBys: [{ dimension: { dimensionName: "hour" }, desc: false }],
        });

        const rows = (data.rows ?? []).map((row: any) => ({
          hour: Number(row.dimensionValues?.[0]?.value ?? 0),
          users: Number(row.metricValues?.[0]?.value ?? 0),
        }));
        return json({ ok: true, rows }, origin);
      }

      // 핑
      return json({ ok: true, ping: "pong" }, origin);
    } catch (e: any) {
      return json({ ok: false, error: String(e?.message ?? e) }, origin, 500);
    }
  },
};

// ---------- helpers ----------
function json(obj: unknown, origin: string | null, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(origin) },
  });
}

function cors(origin: string | null) {
  const allow = origin && ALLOW_ORIGINS.has(origin);
  return {
    "access-control-allow-origin": allow ? origin! : "null",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,OPTIONS",
    "vary": "Origin",
  };
}

function clampInt(v: string | null, min: number, max: number, dft: number) {
  const n = Number(v ?? dft);
  if (!Number.isFinite(n)) return dft;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function toDateStr(yyyymmdd?: string) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}`;
}

/** 공통: GA Data API 보고서 */
async function gaReport(env: Env, body: any): Promise<any> {
  const token = await getAccessToken(env.GA_SA_EMAIL, env.GA_SA_PRIVATE_KEY);
  const property = `properties/${env.GA_PROPERTY_ID}`;
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) throw new Error(`GA API ${r.status}: ${await r.text()}`);
  return r.json();
}

/** 공통: GA Realtime Report */
async function gaRealtime(env: Env, body: any): Promise<any> {
  const token = await getAccessToken(env.GA_SA_EMAIL, env.GA_SA_PRIVATE_KEY);
  const property = `properties/${env.GA_PROPERTY_ID}`;
  const r = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${property}:runRealtimeReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) throw new Error(`GA RT API ${r.status}: ${await r.text()}`);
  return r.json();
}

// === Google Service Account: JWT -> Access Token ===
async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64u(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const input = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuf(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input)
  );

  const signature = toBase64Url(sig);
  const jwt = `${input}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(await res.text());
  const j = (await res.json()) as any;
  return j.access_token as string;
}

function pemToBuf(pem: string): ArrayBuffer {
  // 정규화: CR 제거 + literal "\n" → 실제 개행
  pem = pem.trim().replace(/\r/g, "").replace(/\\n/g, "\n");

  // 헤더/푸터 제거 + 공백/개행 제거
  let b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----\n?/, "")
    .replace(/\n?-----END PRIVATE KEY-----/, "")
    .replace(/[ \t\n]/g, "");

  // base64 패딩 보정
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);

  // base64 → ArrayBuffer
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

function toBase64Url(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64u(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
