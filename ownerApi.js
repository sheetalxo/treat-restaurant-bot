// ======================================================
// OWNER API  (mounted at /api/owner)
// For the private owner Android app only.
//
// Env (Render -> Environment):
//   OWNER_PHONE, OWNER_PIN            login credentials (PIN: use 6+ digits)
//   JWT_SECRET                        random, 32+ chars
//   JWT_ISSUER / JWT_AUDIENCE         optional (defaults below, not secrets)
//   OWNER_TOKEN_VERSION               optional; change it to log the app out everywhere
//   CORS_ORIGINS                      optional, comma separated browser origins (native app does not need it)
//   SUPABASE_URL + SUPABASE_SERVICE_KEY (or SUPABASE_SECRET_KEY)   already on Render
//
// Order progress lives in its own column  orders.fulfillment  (see owner_fulfillment.sql).
// It deliberately does NOT touch orders.status (payment state used by Razorpay/print logic),
// and a separate column cannot be overwritten when the bot re-saves an order.
// ======================================================

const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_ISSUER = process.env.JWT_ISSUER || "treat-restaurant-bot";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "treat-owner-app";
const TOKEN_VERSION = String(process.env.OWNER_TOKEN_VERSION || "1");
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

const OWNER_PHONE = process.env.OWNER_PHONE || "";
const OWNER_PIN = process.env.OWNER_PIN || "";

const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || "";

const configured = JWT_SECRET.length >= 32 && !!OWNER_PHONE && !!OWNER_PIN;
if (!configured) {
  console.warn("Owner API DISABLED: set OWNER_PHONE, OWNER_PIN and JWT_SECRET (32+ chars) on Render");
}
if (OWNER_PIN && OWNER_PIN.length < 6) {
  console.warn("Owner API: OWNER_PIN is shorter than 6 characters - use a longer PIN");
}

// Only these values may ever be written to orders.fulfillment
const FULFILLMENT = ["NEW", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "REJECTED"];
// Payment-state values we allow filtering on (read only, never written here)
const PAY_STATUS = ["AWAITING_PAYMENT", "CONFIRMED_CASH", "PAID", "CANCELLED", "EXPIRED"];
// Only orders that are really confirmed can be progressed by the owner
const PROGRESSABLE = ["CONFIRMED_CASH", "PAID"];
const SORT_COLUMNS = { created_at: "created_at", updated_at: "updated_at", total: "total" };

// ---------- helpers ----------
const sha = (v) => crypto.createHash("sha256").update(String(v)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const digits = (v) => String(v || "").replace(/\D/g, "");
// 10-digit comparison so +91 / 91 / 0 prefixes do not matter
const samePhone = (a, b) => {
  const x = digits(a).slice(-10);
  const y = digits(b).slice(-10);
  return x.length === 10 && x === y;
};

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

async function sb(method, path, { body, prefer } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("supabase not configured");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      ...(SUPABASE_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`supabase ${method} ${path.split("?")[0]} ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// DB row -> safe response object (explicit whitelist, nothing else leaks)
function formatOrder(row) {
  const d = row.data || {};
  const bill = d.bill || {};
  const items = (Array.isArray(bill.items) ? bill.items : Array.isArray(d.items) ? d.items : []).map((i) => ({
    name: String(i.name ?? ""),
    quantity: Number(i.quantity) || 0,
    unitPrice: Number(i.unitPrice ?? i.price) || 0,
    lineTotal: Number(i.lineTotal) || (Number(i.unitPrice ?? i.price) || 0) * (Number(i.quantity) || 0),
    variant: i.variant || null,
    boneless: !!i.boneless,
    extraCheese: !!i.cheese
  }));
  const isDelivery = d.orderType === "DELIVERY";
  return {
    id: row.id,
    customerPhone: row.phone,
    customerName: d.name || null,
    status: row.status,
    fulfillment: row.fulfillment || "NEW",
    orderType: d.orderType || null,
    paymentMethod: d.method || null,
    items,
    foodSubtotal: bill.foodSubtotal ?? null,
    packingCharges: bill.packingCharges ?? null,
    deliveryCharges: bill.deliveryCharges ?? null,
    discount: bill.discount ?? null,
    total: row.total ?? bill.total ?? null,
    delivery: isDelivery ? { address: d.address || null, lat: d.lat ?? null, lng: d.lng ?? null } : null,
    visitTime: d.visitTime || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---------- router ----------
const router = express.Router();

// CORS: only listed browser origins. Native Android needs none. CORS is NOT authentication.
const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
router.use(
  cors({
    origin: (origin, cb) => cb(null, !origin ? false : allowedOrigins.includes(origin)),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600
  })
);

router.use((req, res, next) => (configured ? next() : fail(res, 503, "owner_api_disabled", "Owner API is not configured")));

router.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many requests" } } }));

// Per-IP limiter + a global failure lock (IPs can rotate; a short PIN must not be brute-forceable)
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many login attempts. Try again later." } } });
let failCount = 0;
let failWindowStart = Date.now();
let lockedUntil = 0;
function noteFailure() {
  const now = Date.now();
  if (now - failWindowStart > 15 * 60 * 1000) { failWindowStart = now; failCount = 0; }
  if (++failCount >= 10) lockedUntil = now + 15 * 60 * 1000;
}

router.post("/login", loginLimiter, express.json({ limit: "2kb" }), (req, res) => {
  if (Date.now() < lockedUntil) return fail(res, 429, "locked", "Login temporarily locked. Try again later.");
  const { phone, pin } = req.body || {};
  if (typeof phone !== "string" || typeof pin !== "string" || phone.length > 20 || pin.length > 32 || !phone || !pin) {
    return fail(res, 400, "invalid_request", "phone and pin are required");
  }
  // evaluate both so timing does not reveal which one was wrong
  const phoneOk = samePhone(phone, OWNER_PHONE);
  const pinOk = safeEqual(pin, OWNER_PIN);
  if (!(phoneOk && pinOk)) {
    noteFailure();
    return fail(res, 401, "invalid_credentials", "Invalid phone or PIN");
  }
  const token = jwt.sign({ sub: "owner", tv: TOKEN_VERSION }, JWT_SECRET, {
    algorithm: "HS256", issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: TOKEN_TTL_SEC
  });
  res.json({ token, tokenType: "Bearer", expiresIn: TOKEN_TTL_SEC });
});

// ---------- everything below needs a valid Bearer token ----------
function requireOwner(req, res, next) {
  const m = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(req.get("authorization") || "");
  if (!m) return fail(res, 401, "unauthorized", "Missing bearer token");
  try {
    const p = jwt.verify(m[1], JWT_SECRET, { algorithms: ["HS256"], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    if (p.sub !== "owner" || p.tv !== TOKEN_VERSION) return fail(res, 401, "unauthorized", "Token revoked");
    req.owner = true;
    next();
  } catch (err) {
    return fail(res, 401, err.name === "TokenExpiredError" ? "token_expired" : "unauthorized",
      err.name === "TokenExpiredError" ? "Token expired, please log in again" : "Invalid token");
  }
}

// cheap "is my token still valid" check for the app
router.get("/me", requireOwner, (req, res) => res.json({ ok: true }));

router.get("/orders", requireOwner, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const sortCol = SORT_COLUMNS[req.query.sort] || "created_at";
    const dir = String(req.query.dir || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    let filter = "";
    if (req.query.status !== undefined) {
      if (!PAY_STATUS.includes(req.query.status)) return fail(res, 400, "invalid_request", "Unknown status filter");
      filter += `&status=eq.${req.query.status}`;
    }
    if (req.query.fulfillment !== undefined) {
      if (!FULFILLMENT.includes(req.query.fulfillment)) return fail(res, 400, "invalid_request", "Unknown fulfillment filter");
      filter += `&fulfillment=eq.${req.query.fulfillment}`;
    }

    // fetch one extra row to know if another page exists (no count query needed)
    const rows = await sb(
      "GET",
      `orders?select=id,phone,status,total,fulfillment,data,created_at,updated_at` +
        `&order=${sortCol}.${dir}&limit=${limit + 1}&offset=${(page - 1) * limit}${filter}`
    );
    const list = Array.isArray(rows) ? rows : [];
    res.json({ page, limit, hasMore: list.length > limit, orders: list.slice(0, limit).map(formatOrder) });
  } catch (err) {
    console.error("ownerApi /orders:", err.message);
    fail(res, 502, "upstream_error", "Could not load orders");
  }
});

router.post("/update-order", requireOwner, express.json({ limit: "2kb" }), async (req, res) => {
  const { orderId, fulfillment } = req.body || {};
  if (typeof orderId !== "string" || !/^[A-Za-z0-9#/_-]{3,40}$/.test(orderId)) {
    return fail(res, 400, "invalid_request", "Invalid orderId");
  }
  if (typeof fulfillment !== "string" || !FULFILLMENT.includes(fulfillment)) {
    return fail(res, 400, "invalid_request", `fulfillment must be one of: ${FULFILLMENT.join(", ")}`);
  }
  try {
    const id = encodeURIComponent(orderId);
    // Column names are fixed here; client input only supplies the (validated) VALUE.
    const updated = await sb(
      "PATCH",
      `orders?id=eq.${id}&status=in.(${PROGRESSABLE.join(",")})` +
        `&select=id,phone,status,total,fulfillment,data,created_at,updated_at`,
      { body: { fulfillment, updated_at: new Date().toISOString() }, prefer: "return=representation" }
    );
    if (Array.isArray(updated) && updated.length === 1) return res.json({ order: formatOrder(updated[0]) });

    const exists = await sb("GET", `orders?id=eq.${id}&select=id,status`);
    if (!Array.isArray(exists) || exists.length === 0) return fail(res, 404, "not_found", "Order not found");
    return fail(res, 409, "not_updatable", `Order is ${exists[0].status}; only confirmed/paid orders can be progressed`);
  } catch (err) {
    console.error("ownerApi /update-order:", err.message);
    fail(res, 502, "upstream_error", "Could not update order");
  }
});

router.use((req, res) => fail(res, 404, "not_found", "Unknown endpoint"));

module.exports = router;
