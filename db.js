// ======================================================
// SUPABASE PERSISTENCE (plain REST, no extra npm package)
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY  (service_role key - SERVER ONLY)
//
// If the env vars are missing, every function becomes a safe no-op and the bot
// runs memory-only (old behaviour). If Supabase is down, the bot keeps working.
// ======================================================

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || "";
const enabled = !!(URL_BASE && KEY);

if (!enabled) {
  console.warn("Supabase NOT configured (SUPABASE_URL / SUPABASE_SERVICE_KEY) - memory-only mode");
}

async function rest(method, path, { body, prefer } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${path.split("?")[0]} ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const enc = encodeURIComponent;

// Atomic dedupe: returns true only for the FIRST time an id is seen (survives restarts).
// If Supabase fails we return true (do not drop a real customer message).
async function claimMessage(id) {
  if (!enabled) return true;
  try {
    const rows = await rest("POST", "processed_messages", {
      body: { id },
      prefer: "resolution=ignore-duplicates,return=representation"
    });
    return Array.isArray(rows) && rows.length === 1;
  } catch (err) {
    console.error("db.claimMessage:", err.message);
    return true;
  }
}

async function loadSession(phone) {
  if (!enabled) return null;
  try {
    const rows = await rest("GET", `sessions?phone=eq.${enc(phone)}&select=data`);
    return rows?.[0]?.data || null;
  } catch (err) {
    console.error("db.loadSession:", err.message);
    return null;
  }
}

async function saveSession(phone, data) {
  if (!enabled) return;
  try {
    await rest("POST", "sessions?on_conflict=phone", {
      body: { phone, data, updated_at: new Date().toISOString() },
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  } catch (err) {
    console.error("db.saveSession:", err.message);
  }
}

async function saveOrder(order) {
  if (!enabled) return;
  try {
    await rest("POST", "orders?on_conflict=id", {
      body: {
        id: order.id,
        phone: order.phone,
        status: order.status,
        total: order.bill?.total ?? null,
        data: order,
        created_at: order.createdAt,
        updated_at: new Date().toISOString()
      },
      prefer: "resolution=merge-duplicates,return=minimal"
    });
  } catch (err) {
    console.error("db.saveOrder:", err.message);
  }
}

async function loadOrder(id) {
  if (!enabled) return null;
  try {
    const rows = await rest("GET", `orders?id=eq.${enc(id)}&select=data`);
    return rows?.[0]?.data || null;
  } catch (err) {
    console.error("db.loadOrder:", err.message);
    return null;
  }
}

async function orderExists(id) {
  if (!enabled) return false;
  try {
    const rows = await rest("GET", `orders?id=eq.${enc(id)}&select=id`);
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.error("db.orderExists:", err.message);
    return false;
  }
}

async function deleteOrder(id) {
  if (!enabled) return;
  try {
    await rest("DELETE", `orders?id=eq.${enc(id)}`, { prefer: "return=minimal" });
  } catch (err) {
    console.error("db.deleteOrder:", err.message);
  }
}

async function countRecentOrders(phone, windowMs) {
  if (!enabled) return 0;
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const rows = await rest("GET", `orders?phone=eq.${enc(phone)}&created_at=gte.${enc(since)}&select=id`);
    return Array.isArray(rows) ? rows.length : 0;
  } catch (err) {
    console.error("db.countRecentOrders:", err.message);
    return 0;
  }
}

// Housekeeping (throttled to once an hour). Orders are NEVER deleted here.
let lastCleanup = 0;
async function cleanup() {
  if (!enabled || Date.now() - lastCleanup < 60 * 60 * 1000) return;
  lastCleanup = Date.now();
  try {
    const msgCut = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(); // Meta retries for up to 7 days
    const sesCut = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await rest("DELETE", `processed_messages?created_at=lt.${enc(msgCut)}`, { prefer: "return=minimal" });
    await rest("DELETE", `sessions?updated_at=lt.${enc(sesCut)}`, { prefer: "return=minimal" });
  } catch (err) {
    console.error("db.cleanup:", err.message);
  }
}

module.exports = {
  enabled, claimMessage, loadSession, saveSession,
  saveOrder, loadOrder, orderExists, deleteOrder, countRecentOrders, cleanup
};
