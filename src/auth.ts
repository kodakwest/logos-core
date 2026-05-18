import type { AuthUser, Env } from "./types";

const MAGIC_LINK_TTL_SECONDS = 15 * 60;
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const EMAIL_RATE_LIMIT = 3;
const IP_RATE_LIMIT = 10;
const SESSION_COOKIE_NAME = "__Host-session";
const DEFAULT_EMAIL_FROM = "no-reply@logos-core.com";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LoginResult =
  | { status: "success"; sessionToken: string; redirectUrl: string | null }
  | { status: "invalid" | "expired" | "consumed" };

interface AuthTokenRow {
  token_hash: string;
  email: string;
  purpose: "magic" | "session";
  issued_at: number;
  expires_at: number;
  consumed_at: number | null;
  redirect_url: string | null;
}

interface RateLimitRow {
  count: number;
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) return null;
  return normalized;
}

export async function requestMagicLink(env: Env, email: string, request: Request, redirectUrl?: string | null): Promise<"sent" | "rate_limited"> {
  await ensureAuthSchema(env.DB);

  const allowed = await checkRateLimits(env, email, clientIp(request));
  if (!allowed) return "rate_limited";

  const token = generateToken();
  const tokenHash = await sha256(token);
  const now = unixSeconds();
  const expiresAt = now + MAGIC_LINK_TTL_SECONDS;

  await env.DB.prepare(
    `INSERT INTO auth_tokens (token_hash, email, purpose, issued_at, expires_at, consumed_at, redirect_url)
     VALUES (?, ?, 'magic', ?, ?, NULL, ?)`
  ).bind(tokenHash, email, now, expiresAt, redirectUrl ?? null).run();

  const loginUrl = new URL("/api/auth/login", request.url);
  loginUrl.searchParams.set("token", token);

  await sendMagicLinkEmail(env, email, loginUrl.toString());
  return "sent";
}

export async function consumeMagicLink(env: Env, token: string): Promise<LoginResult> {
  if (!token) return { status: "invalid" };
  await ensureAuthSchema(env.DB);

  const tokenHash = await sha256(token);
  const now = unixSeconds();
  const row = await env.DB.prepare(
    `SELECT token_hash, email, purpose, issued_at, expires_at, consumed_at, redirect_url
     FROM auth_tokens
     WHERE token_hash = ? AND purpose = 'magic'`
  ).bind(tokenHash).first<AuthTokenRow>();

  if (!row) return { status: "invalid" };
  if (row.consumed_at !== null) return { status: "consumed" };
  if (row.expires_at <= now) return { status: "expired" };

  const consumeResult = await env.DB.prepare(
    `UPDATE auth_tokens
     SET consumed_at = ?
     WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?`
  ).bind(now, tokenHash, now).run();

  if (consumeResult.meta.changes === 0) return { status: "consumed" };

  const sessionToken = generateToken();
  const sessionHash = await sha256(sessionToken);
  await env.DB.prepare(
    `INSERT INTO auth_tokens (token_hash, email, purpose, issued_at, expires_at, consumed_at, redirect_url)
     VALUES (?, ?, 'session', ?, ?, NULL, NULL)`
  ).bind(sessionHash, row.email, now, now + SESSION_TTL_SECONDS).run();

  await cleanupExpiredTokens(env.DB, now);
  return { status: "success", sessionToken, redirectUrl: row.redirect_url };
}

export async function authenticateRequest(request: Request, env: Env): Promise<AuthUser | null> {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return null;
  return getSessionAndUser(env, sessionToken);
}

export async function getSessionAndUser(env: Env, sessionToken: string): Promise<AuthUser | null> {
  await ensureAuthSchema(env.DB);

  const sessionHash = await sha256(sessionToken);
  const row = await env.DB.prepare(
    `SELECT email
     FROM auth_tokens
     WHERE token_hash = ? AND purpose = 'session' AND consumed_at IS NULL AND expires_at > ?`
  ).bind(sessionHash, unixSeconds()).first<{ email: string }>();

  const email = normalizeEmail(row?.email);
  return email ? { email } : null;
}

export async function logoutSession(env: Env, request: Request): Promise<void> {
  const sessionToken = getSessionToken(request);
  if (!sessionToken) return;
  await ensureAuthSchema(env.DB);

  const now = unixSeconds();
  const sessionHash = await sha256(sessionToken);
  await env.DB.prepare(
    `UPDATE auth_tokens
     SET consumed_at = ?
     WHERE token_hash = ? AND purpose = 'session' AND consumed_at IS NULL`
  ).bind(now, sessionHash).run();
}

export function sessionCookie(sessionToken: string): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`
  ].join("; ");
}

export function clearSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Secure",
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0"
  ].join("; ");
}

async function ensureAuthSchema(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_tokens (
        token_hash TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        purpose TEXT NOT NULL DEFAULT 'magic',
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER
      )`
    ),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_purpose ON auth_tokens(purpose, expires_at)"),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        bucket_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL
      )`
    )
  ]);
  await ensureRedirectUrlColumn(db);
}

async function ensureRedirectUrlColumn(db: D1Database): Promise<void> {
  const columns = await db.prepare("PRAGMA table_info(auth_tokens)").all<{ name: string }>();
  const hasRedirectUrl = columns.results?.some((column) => column.name === "redirect_url");
  if (!hasRedirectUrl) {
    await db.prepare("ALTER TABLE auth_tokens ADD COLUMN redirect_url TEXT").run();
  }
}

async function checkRateLimits(env: Env, email: string, ip: string): Promise<boolean> {
  const emailKey = `email:${await sha256(email)}`;
  const ipKey = `ip:${await sha256(ip)}`;
  const [emailAllowed, ipAllowed] = await Promise.all([
    incrementRateLimit(env.DB, emailKey, EMAIL_RATE_LIMIT),
    incrementRateLimit(env.DB, ipKey, IP_RATE_LIMIT)
  ]);

  return emailAllowed && ipAllowed;
}

async function incrementRateLimit(db: D1Database, bucketKey: string, maxAttempts: number): Promise<boolean> {
  const now = unixSeconds();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS) * RATE_LIMIT_WINDOW_SECONDS;
  const row = await db.prepare(
    `INSERT INTO rate_limits (bucket_key, count, window_start)
     VALUES (?, 1, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       count = CASE
         WHEN rate_limits.window_start < excluded.window_start THEN 1
         ELSE rate_limits.count + 1
       END,
       window_start = CASE
         WHEN rate_limits.window_start < excluded.window_start THEN excluded.window_start
         ELSE rate_limits.window_start
       END
     RETURNING count`
  ).bind(bucketKey, windowStart).first<RateLimitRow>();

  return (row?.count ?? maxAttempts + 1) <= maxAttempts;
}

async function cleanupExpiredTokens(db: D1Database, now: number): Promise<void> {
  await db.prepare("DELETE FROM auth_tokens WHERE expires_at <= ?").bind(now).run();
}

async function sendMagicLinkEmail(env: Env, to: string, loginUrl: string): Promise<void> {
  const from = env.AUTH_EMAIL_FROM || DEFAULT_EMAIL_FROM;
  const text = [
    "Click here to sign in to LogOS Core:",
    loginUrl,
    "",
    "This link expires in 15 minutes. If you didn't request this, ignore this email."
  ].join("\n");

  if (!env.EMAIL || typeof env.EMAIL.send !== "function") {
    console.error("Magic link email binding is not configured.");
    return;
  }

  try {
    await env.EMAIL.send({
      from,
      to,
      subject: "Your LogOS Core login link",
      text
    });
  } catch (err) {
    // Email send is best-effort; log and continue.
    // Setup: verify sender domain in Cloudflare Email dashboard.
    console.error("Failed to send magic link email:", err);
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function clientIp(request: Request): string {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
}

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

function getSessionToken(request: Request): string | null {
  return getCookie(request.headers.get("Cookie"), SESSION_COOKIE_NAME);
}

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
