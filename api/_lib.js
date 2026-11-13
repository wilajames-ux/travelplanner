// Shared helpers for the Tripboard API (Vercel serverless functions, no dependencies).
// Storage: Upstash Redis over its REST API. Vercel's Upstash integration sets
// KV_REST_API_URL / KV_REST_API_TOKEN; plain Upstash uses UPSTASH_REDIS_REST_*.
const crypto = require("crypto");

const RURL = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const RTOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...cmd) {
  if (!RURL() || !RTOK()) throw Object.assign(new Error("Storage is not connected. Add an Upstash Redis database to this Vercel project."), { status: 503 });
  const r = await fetch(RURL(), {
    method: "POST",
    headers: { Authorization: "Bearer " + RTOK(), "Content-Type": "application/json" },
    body: JSON.stringify(cmd.map(String)),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw Object.assign(new Error("Storage error: " + (j.error || r.status)), { status: 502 });
  return j.result;
}

// Group names are matched ignoring case and extra spaces: "china  family" == "China Family".
const gkey = name => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

function hash(code, salt) {
  return crypto.scryptSync(String(code), salt, 32).toString("hex");
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const secret = () => process.env.SESSION_SECRET || ("tb:" + (process.env.ADMIN_CODE || ""));
const b64 = s => Buffer.from(s).toString("base64url");
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  return body + "." + crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}
function verify(tok) {
  if (!tok || !process.env.ADMIN_CODE && !process.env.SESSION_SECRET) return null;
  const [body, sig] = String(tok).split(".");
  if (!body || !sig) return null;
  const good = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  if (!same(sig, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

const COOKIE = "tb_session";
const DAYS = 60;
function setSession(res, payload) {
  const tok = sign({ ...payload, exp: Date.now() + DAYS * 864e5 });
  res.setHeader("Set-Cookie", `${COOKIE}=${tok}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`);
}
function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}
function cookie(req, name) {
  const m = String(req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}
const session = req => verify(cookie(req, COOKIE));

async function getGroup(name) {
  const raw = await redis("GET", "g:" + gkey(name));
  return raw ? JSON.parse(raw) : null;
}

// Slow down passcode guessing: at most 10 wrong tries per IP per 15 minutes.
function ip(req) {
  return String(req.headers["x-forwarded-for"] || req.socket && req.socket.remoteAddress || "?").split(",")[0].trim();
}
async function tooMany(req, scope) {
  const n = await redis("GET", "rl:" + scope + ":" + ip(req));
  return +n >= 10;
}
async function failed(req, scope) {
  const k = "rl:" + scope + ":" + ip(req);
  const n = await redis("INCR", k);
  if (+n === 1) await redis("EXPIRE", k, 900);
}

function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
}

// Wraps a handler so errors come back as JSON with a readable message.
const api = fn => async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { await fn(req, res); }
  catch (e) { res.status(e.status || 500).json({ error: e.message || "Server error" }); }
};

module.exports = { redis, gkey, hash, same, setSession, clearSession, session, getGroup, tooMany, failed, body, api, crypto };
