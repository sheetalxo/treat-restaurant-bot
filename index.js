const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  typeLabel,
  getCategories,
  getItems,
  isHalfFull,
  isBonelessEligible,
  isPizza,
  chargeCategory,
  marker
} = require("./menu");
const { t } = require("./i18n");
const { parseTypedOrder } = require("./matcher");
const { buildInvoicePdf } = require("./invoice");
const { notifyTelegram, notifyTelegramText, orderSummaryText } = require("./telegram");
const { calculateOrderTotal, deliveryChargeFor } = require("./billing");
const db = require("./db");
const createWebMenu = require("./webmenu");
const createFlowMenu = require("./flowmenu");
const { LiveKitAPI, DisconnectWhatsAppCallRequest_DisconnectReason } = require("livekit-server-sdk");

const app = express();
app.disable("x-powered-by");

// Keep raw body: needed to verify the Meta (WhatsApp) AND Razorpay webhook signatures
app.use(
  express.json({
    limit: "200kb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

const PORT = process.env.PORT || 3000;

// ---------------- WhatsApp ----------------
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Owner alerts go to Telegram only (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID). No WhatsApp copy.

// Meta App Secret (Meta App Dashboard -> Settings -> Basic -> App secret).
// REQUIRED: used to verify the X-Hub-Signature-256 header on every webhook POST.
const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// ---------------- Razorpay (add keys at the end) ----------------
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// ---------------- Voice calling (WhatsApp Calling API -> LiveKit -> Gemini Live) ----------------
// All of this is optional: if LIVEKIT_* is not set, incoming calls are simply rejected.
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const CALL_MAX_CONCURRENT = Number(process.env.CALL_MAX_CONCURRENT || 1);
const VOICE_AGENT_NAME = process.env.VOICE_AGENT_NAME || "treat-voice-agent";
// Shared secret the voice agent must send as `x-voice-secret` to use /voice/* routes
const VOICE_INTERNAL_SECRET = process.env.VOICE_INTERNAL_SECRET;
const WHATSAPP_CLOUD_API_VERSION = "23.0"; // keep in sync with the graph.facebook.com version used elsewhere in this file

const lkApi =
  LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET
    ? new LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    : null;

// callId -> { from } for calls currently bridged through LiveKit
const activeCalls = new Map();

// ---------------- Business rules ----------------
const MIN_FOOD_ORDER = 300;      // delivery only; excludes packing/delivery charge
const BONELESS_CHARGE = 50;      // per plate, non-veg main course (as printed on menu)
const EXTRA_CHEESE_CHARGE = 30;  // per pizza
const MAX_QTY = 500;

// Treat Restaurant pin from Google Maps (can be overridden with env vars)
const RESTAURANT_LAT = Number(process.env.RESTAURANT_LAT || 32.5192169);
const RESTAURANT_LNG = Number(process.env.RESTAURANT_LNG || 74.9215249);

// Optional: Google Maps API key (Routes API enabled) -> ROAD distance.
// Without it the bot uses straight-line distance.
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Packing %, shake/mocktail extra and delivery slabs live in billing.js
// (central billing - see calculateOrderTotal).

// Telegram admin alerts (set both on Render)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Opening hours (Indian time): 10:30 AM - 10:30 PM. Closed otherwise.
// Set BYPASS_HOURS=true on Render to test outside timings.
const OPEN_MINUTES = 10 * 60 + 30;
const CLOSE_MINUTES = 22 * 60 + 30;

function isOpenNow(date = new Date()) {
  if (process.env.BYPASS_HOURS === "true") return true;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const h = Number(parts.find((p) => p.type === "hour").value) % 24;
  const m = Number(parts.find((p) => p.type === "minute").value);
  const mins = h * 60 + m;

  return mins >= OPEN_MINUTES && mins < CLOSE_MINUTES;
}

const MENU_PDF_PATH = fs.existsSync(path.join(__dirname, "menu.pdf"))
  ? path.join(__dirname, "menu.pdf")
  : path.join(__dirname, "assets", "menu.pdf");

// ======================================================
// SESSIONS / ORDERS  (in memory: lost on restart/sleep)
// ======================================================

const sessions = {};
const orders = {};

// message-id dedupe with expiry (Meta retries; also blocks replays)
const processedMessages = new Map(); // id -> timestamp
const DEDUPE_TTL_MS = 60 * 60 * 1000;

// per-phone rate limit: max 40 messages per minute
const rateBuckets = new Map(); // phone -> { start, count }
function rateLimited(phone) {
  const now = Date.now();
  const b = rateBuckets.get(phone);
  if (!b || now - b.start > 60 * 1000) {
    rateBuckets.set(phone, { start: now, count: 1 });
    return false;
  }
  b.count += 1;
  return b.count > 40;
}

const MAX_TEXT_LEN = 500;     // any typed message
const MAX_ADDRESS_LEN = 250;
const MAX_CART_LINES = 40;

// remove control / zero-width / bidi characters and trim
function cleanText(s, max) {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// memory cleanup: idle sessions after 6h, old orders after 48h, stale dedupe/rate entries
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of processedMessages) if (now - ts > DEDUPE_TTL_MS) processedMessages.delete(id);
  for (const [ph, b] of rateBuckets) if (now - b.start > 120 * 1000) rateBuckets.delete(ph);
  for (const ph of Object.keys(sessions)) {
    if (now - (sessions[ph].lastSeen || 0) > 6 * 60 * 60 * 1000) delete sessions[ph];
  }
  for (const id of Object.keys(orders)) {
    if (now - new Date(orders[id].createdAt).getTime() > 48 * 60 * 60 * 1000) delete orders[id];
  }
  db.cleanup().catch(() => {});
}, 10 * 60 * 1000).unref();

// One customer = one queue. Messages from the SAME phone are processed strictly in order
// (no two handlers mutating one session at once); different customers run in parallel.
const phoneLocks = new Map();
function withPhoneLock(phone, fn) {
  const prev = phoneLocks.get(phone) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  phoneLocks.set(phone, next);
  next.finally(() => { if (phoneLocks.get(phone) === next) phoneLocks.delete(phone); }).catch(() => {});
  return next;
}

// Load the session from Supabase if this process doesn't have it (after restart / sleep)
async function hydrateSession(phone) {
  if (sessions[phone]) return;
  const saved = await db.loadSession(phone);
  const fresh = getSession(phone); // creates defaults
  if (saved && Date.now() - (saved.lastSeen || 0) < 6 * 60 * 60 * 1000) Object.assign(fresh, saved);
}

async function persistSession(phone) {
  if (sessions[phone]) await db.saveSession(phone, sessions[phone]);
}

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      lastSeen: Date.now(),
      lang: null, // "en" | "hi" | "hg"
      type: null, // "VEG" | "NON-VEG" | "BOTH"
      category: null,
      item: null,
      variant: null,
      boneless: null,
      cheese: null,
      quantity: 1,
      cart: [],
      awaiting: null, // "qty" | "address" | "visit" | "location"
      orderType: null,
      address: null,
      visitTime: null,
      distanceKm: null,
      lat: null,
      lng: null,
      name: null,
      // typed-order state
      queue: [],
      typedAdded: [],
      typedUnknown: [],
      pickCandidates: [],
      pickCtx: null,
      presetQty: null,
      autoAdd: false
    };
  }
  sessions[phone].lastSeen = Date.now();
  return sessions[phone];
}

// translate for a given customer
const T = (to, key, ...args) => t(getSession(to).lang || "en", key, ...args);

const cut = (s, n) => Array.from(String(s)).slice(0, n).join("");
const round2 = (n) => Math.round(n * 100) / 100;
// 58.1 -> "58.10", 830 -> "830"
const rs = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(2));

function resetSelection(session) {
  session.item = null;
  session.variant = null;
  session.boneless = null;
  session.cheese = null;
  session.quantity = 1;
  session.autoAdd = false;
  if (session.awaiting === "qty") session.awaiting = null;
}

function clearTyped(session) {
  session.queue = [];
  session.typedAdded = [];
  session.typedUnknown = [];
  session.pickCandidates = [];
  session.pickCtx = null;
  session.presetQty = null;
}

// Back to the very start (order type is chosen first). Cart is kept.
function resetOrderFlow(session) {
  session.awaiting = null;
  session.type = null;
  session.category = null;
  session.orderType = null;
  session.address = null;
  session.visitTime = null;
  session.distanceKm = null;
  session.lat = null;
  session.lng = null;
}

// What step is still pending for the currently selected item?
function pendingStep(session) {
  const item = session.item;
  if (!item) return null;
  if (isHalfFull(item) && !session.variant) return "variant";
  if (isBonelessEligible(item) && session.boneless === null) return "boneless";
  if (isPizza(item) && session.cheese === null) return "cheese";
  return null;
}

function unitPrice(item, variant, boneless, cheese) {
  let price = isHalfFull(item)
    ? variant === "HALF"
      ? item.price.half
      : item.price.full
    : item.price;
  if (boneless) price += BONELESS_CHARGE;
  if (cheese) price += EXTRA_CHEESE_CHARGE;
  return price;
}

function optionsText(line) {
  const opts = [];
  if (line.variant) opts.push(line.variant);
  if (line.boneless) opts.push("Boneless");
  if (line.cheese) opts.push("Extra Cheese");
  return opts.length ? ` (${opts.join(", ")})` : "";
}

function priceText(item) {
  return isHalfFull(item)
    ? `Half ₹${item.price.half} | Full ₹${item.price.full}`
    : `₹${item.price}`;
}

// ======================================================
// HEALTH CHECK + WEBHOOK VERIFICATION
// ======================================================

app.get("/", (req, res) => {
  res.status(200).send("TREAT RESTAURANT WhatsApp Bot is running");
});

// For the uptime monitor (UptimeRobot etc.): point it at /health, every 5 minutes
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, db: db.enabled, uptimeSec: Math.round(process.uptime()) });
});

// Log instead of crashing: a crash = Render restart = memory wiped + webhook replays
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

// ======================================================
// RECEIVE WHATSAPP MESSAGES
// ======================================================

// Verifies that the POST really comes from Meta (HMAC-SHA256 of the raw body).
// Without this ANYONE can POST fake "customer messages" to /webhook.
function verifyMetaSignature(req, res, next) {
  if (!WHATSAPP_APP_SECRET) {
    console.error("WHATSAPP_APP_SECRET is not set - rejecting webhook POST (fail closed)");
    return res.sendStatus(503);
  }

  const header = req.get("x-hub-signature-256") || "";
  if (!header.startsWith("sha256=") || !req.rawBody) return res.sendStatus(403);

  const expected = crypto
    .createHmac("sha256", WHATSAPP_APP_SECRET)
    .update(req.rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header.slice(7), "utf8");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.warn("WhatsApp webhook: invalid signature");
    return res.sendStatus(403);
  }
  next();
}

app.post("/webhook", verifyMetaSignature, async (req, res) => {
  // Reply to Meta immediately so it doesn't retry while we process
  res.sendStatus(200);

  try {
    // Meta can batch several entries / changes / messages in ONE request
    for (const entry of req.body?.entry || []) {
      for (const change of entry?.changes || []) {
        const value = change?.value;
        for (const message of value?.messages || []) {
          try {
            await withPhoneLock(String(message?.from || "unknown"), () => processIncoming(value, message));
          } catch (error) {
            console.error("Message processing error:", error);
          }
        }
        for (const call of value?.calls || []) {
          try {
            await handleCallWebhook(value, call);
          } catch (error) {
            console.error("Call webhook error:", error);
          }
        }
      }
    }
  } catch (error) {
    console.error("Webhook error:", error);
  }
});

async function processIncoming(value, message) {
  const from = String(message?.from || "");
  try {
    await processIncomingInner(value, message);
  } finally {
    if (/^\d{6,15}$/.test(from)) await persistSession(from);
  }
}

// ======================================================
// WHATSAPP CALLING  (customer calls -> LiveKit room -> voice agent)
// ======================================================

// Direct Meta Graph call to <phone_number_id>/calls (accept/reject/terminate).
// Only used for REJECT here - accept is done by LiveKit's AcceptWhatsAppCall,
// which calls Meta on our behalf using the whatsappApiKey we pass it.
async function callsGraphApi(body) {
  const url = `https://graph.facebook.com/v${WHATSAPP_CLOUD_API_VERSION}/${PHONE_NUMBER_ID}/calls`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) console.error("Calls API error:", JSON.stringify(data));
  return data;
}

async function handleCallWebhook(value, call) {
  const metaPhoneId = value?.metadata?.phone_number_id;
  if (metaPhoneId && PHONE_NUMBER_ID && String(metaPhoneId) !== String(PHONE_NUMBER_ID)) return;

  if (call.event === "connect" && call.session?.sdp_type === "offer") {
    await handleInboundCallOffer(call);
  } else if (call.event === "terminate") {
    activeCalls.delete(call.id);
    if (lkApi) {
      try {
        await lkApi.connector.disconnectWhatsAppCall(
          call.id,
          "",
          DisconnectWhatsAppCallRequest_DisconnectReason.USER_INITIATED
        );
      } catch (err) {
        // Normal if WE already disconnected it (e.g. rejected for being over capacity) - Meta
        // sends a terminate webhook either way, and LiveKit auto-cleans up after 30s regardless.
        console.log("WhatsApp call cleanup (probably already closed):", call.id, err.message);
      }
    }
  }
}

async function handleInboundCallOffer(call) {
  const from = String(call.from || "");

  if (!lkApi || !PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.error("Voice calling not configured (LIVEKIT_* env vars missing) - rejecting call", call.id);
    await callsGraphApi({ call_id: call.id, action: "reject" });
    return;
  }

  if (activeCalls.size >= CALL_MAX_CONCURRENT) {
    console.log("Call capacity reached, rejecting:", call.id, "from", from);
    await callsGraphApi({ call_id: call.id, action: "reject" });
    // Best-effort: let the customer know on WhatsApp chat, since they just hung up on a busy tone
    if (/^\d{6,15}$/.test(from)) {
      try {
        await hydrateSession(from);
        await sendText(from, t(getSession(from).lang || "hg", "callBusy"));
      } catch (err) {
        console.error("Call-busy text failed:", err.message);
      }
    }
    return;
  }

  activeCalls.set(call.id, { from });

  try {
    await lkApi.connector.acceptWhatsAppCall({
      whatsappPhoneNumberId: PHONE_NUMBER_ID,
      whatsappApiKey: ACCESS_TOKEN,
      whatsappCloudApiVersion: WHATSAPP_CLOUD_API_VERSION,
      whatsappCallId: call.id,
      sdp: call.session.sdp,
      roomName: `call-${call.id}`,
      participantIdentity: from,
      agents: [{ agentName: VOICE_AGENT_NAME, metadata: JSON.stringify({ phone: from }) }]
    });
  } catch (err) {
    activeCalls.delete(call.id);
    console.error("AcceptWhatsAppCall failed:", call.id, err.message);
    try {
      await lkApi.connector.disconnectWhatsAppCall(
        call.id,
        ACCESS_TOKEN,
        DisconnectWhatsAppCallRequest_DisconnectReason.BUSINESS_INITIATED
      );
    } catch (err2) {
      console.error("Cleanup after failed accept also failed:", err2.message);
    }
  }
}

async function processIncomingInner(value, message) {
  {
    if (!message?.id || !/^\d{6,15}$/.test(String(message.from || ""))) return;

    if (processedMessages.has(message.id)) return;
    processedMessages.set(message.id, Date.now());
    if (!(await db.claimMessage(message.id))) return; // already handled (survives restarts)

    // Ignore stale/replayed messages. Render restarts wipe the in-memory dedupe map,
    // and Meta re-delivers old webhooks -> bot would "reply on its own" to old messages.
    const ageSec = Date.now() / 1000 - Number(message.timestamp);
    if (Number.isFinite(ageSec) && ageSec > 5 * 60) {
      console.warn("Ignoring stale message", message.id, Math.round(ageSec), "s old");
      return;
    }

    // Only react to things a customer actually SENT for the bot to answer.
    // reaction / system / unsupported / unknown / button / order / request_welcome
    // are NOT messages to reply to.
    const REPLYABLE = ["text", "location", "interactive", "image", "audio", "video", "document", "sticker"];
    if (!REPLYABLE.includes(message.type)) {
      console.log("Ignoring non-reply message type:", message.type);
      return;
    }

    const from = message.from;

    // Webhook can carry events for OTHER numbers of the same app (test number + real number).
    // Replying to those from our number = customer gets a message they never asked for.
    const metaPhoneId = value?.metadata?.phone_number_id;
    if (metaPhoneId && PHONE_NUMBER_ID && String(metaPhoneId) !== String(PHONE_NUMBER_ID)) {
      console.warn("Ignoring message for another phone_number_id:", metaPhoneId);
      return;
    }
    // Never answer our own number (self-loop guard)
    const botNumber = String(value?.metadata?.display_phone_number || "").replace(/\D/g, "");
    if (botNumber && from === botNumber) return;

    if (rateLimited(from)) return;

    await hydrateSession(from);
    const session = getSession(from);
    const profileName = value.contacts?.[0]?.profile?.name;
    if (profileName) session.name = cleanText(profileName, 60);

    // Closed outside 10:30 AM - 10:30 PM
    if (!isOpenNow()) {
      await sendText(from, t(session.lang || "hg", "closed"));
      return;
    }

    if (message.type === "text") {
      await handleText(from, message.text?.body || "");
      return;
    }

    if (message.type === "location") {
      await handleLocation(from, message.location);
      return;
    }

    if (message.type === "interactive") {
      // customer finished the in-chat menu (WhatsApp Flow)
      if (message.interactive?.type === "nfm_reply") {
        const ok = await flowMenu.handleReply(from, message.interactive.nfm_reply?.response_json);
        if (!ok) await sendText(from, "Koi item select nahi hua. Dobara menu khol ke dish chuno.");
        return;
      }
      const id =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id;
      if (id) await handleAction(from, id);
      return;
    }

    // image / sticker / audio etc.
    if (!session.lang) await sendLanguagePrompt(from);
    else await sendWelcomeMessage(from);
  }
}

// ======================================================
// TEXT HANDLER
// ======================================================

// These restart everything (order type is asked again first)
const GREETINGS = [
  "hi", "hii", "hiii", "hello", "hlo", "helo", "hey", "hie", "start",
  "namaste", "namaskar", "नमस्ते", "हेलो", "हाय"
];

// These only go back to the menu; order type is kept
const MENU_WORDS = ["menu", "order"];
const CHANGE_TYPE_WORDS = ["change", "change type", "order type"];

async function handleText(from, raw) {
  const session = getSession(from);
  const text = cleanText(raw, MAX_TEXT_LEN);
  const lower = text.toLowerCase();

  // 1. language first
  if (!session.lang) {
    await sendLanguagePrompt(from);
    return;
  }

  if (["language", "lang", "bhasha", "भाषा"].includes(lower)) {
    await sendLanguagePrompt(from);
    return;
  }

  // 2. greetings always restart from the beginning (order type first)
  if (GREETINGS.includes(lower)) {
    resetSelection(session);
    clearTyped(session);
    resetOrderFlow(session);
    await sendWelcomeMessage(from);
    return;
  }

  if (MENU_WORDS.includes(lower)) {
    resetSelection(session);
    clearTyped(session);
    session.awaiting = null;
    session.type = null;
    session.category = null;
    await sendWelcomeMessage(from);
    return;
  }

  if (CHANGE_TYPE_WORDS.includes(lower)) {
    resetSelection(session);
    clearTyped(session);
    resetOrderFlow(session);
    await sendOrderTypeButtons(from);
    return;
  }

  // 3. order-type inputs (location -> address, or expected visit time)
  if (session.awaiting === "location") {
    await sendText(from, T(from, "needLocation"));
    await sendLocationRequest(from);
    return;
  }

  if (session.awaiting === "address") {
    if (text.length < 10) {
      await sendText(from, T(from, "addressShort"));
      return;
    }
    session.address = cleanText(text, MAX_ADDRESS_LEN);
    session.awaiting = null;
    await sendText(from, T(from, "addressSaved"));
    await sendMenuStart(from);
    return;
  }

  if (session.awaiting === "visit") {
    session.visitTime = cut(text, 30);
    session.awaiting = null;
    await sendText(from, T(from, "visitSaved", session.visitTime));
    await sendMenuStart(from);
    return;
  }

  // 4. typed quantity (only a plain number counts when no qty prompt is open)
  if (
    session.awaiting === "qty" ||
    (session.item && !pendingStep(session) && /^\d{1,3}$/.test(text))
  ) {
    const match = text.match(/\d+/);

    if (match) {
      const qty = parseInt(match[0], 10);

      if (!qty || qty < 1) {
        await sendText(from, T(from, "qtyInvalid"));
        return;
      }
      if (qty > MAX_QTY) {
        await sendText(from, T(from, "qtyMax", MAX_QTY));
        return;
      }

      session.quantity = qty;
      session.awaiting = null;
      await sendQuantityScreen(from);
      return;
    }

    if (session.awaiting === "qty") {
      await sendText(from, T(from, "qtyOnlyNumber"));
      return;
    }
  }

  // 5. shortcuts
  if (["cart", "kart", "my cart", "कार्ट"].includes(lower)) {
    await sendCart(from);
    return;
  }

  if (["pdf", "menu pdf", "menu card"].includes(lower)) {
    await sendMenuPdf(from);

    const lang = getSession(from).lang || "en";
    const afterPdfText = {
      en: "📄 Menu sent!\n\nWould you like to place your order by writing it?",
      hi: "📄 मेनू भेज दिया गया है!\n\nक्या आप लिखकर अपना ऑर्डर देना चाहेंगे?",
      hg: "📄 Menu bhej diya hai!\n\nKya aap likh kar apna order dena chahoge?"
    }[lang] || "📄 Menu sent!\n\nWould you like to place your order by writing it?";

    await sendButtons(from, afterPdfText, [
      ["write_order", T(from, "btnWrite")]
    ]);
    return;
  }

  // 6. typed order (order type must be chosen first)
  if (!session.orderType) {
    await sendText(from, T(from, "chooseTypeFirst"));
    await sendOrderTypeButtons(from);
    return;
  }

  await handleTypedOrder(from, text);
}

// ======================================================
// TYPED ORDER  ("2 veg momos, 1 dal makhani, pizza")
// ======================================================

async function handleTypedOrder(to, text) {
  const session = getSession(to);
  const entries = parseTypedOrder(text);
  const recognised = entries.filter((e) => e.kind !== "unknown");

  if (!recognised.length) {
    await sendText(to, T(to, "notUnderstood"));
    await sendWelcomeMessage(to);
    return;
  }

  // Typed orders search the WHOLE menu (veg + non-veg)
  session.type = "BOTH";
  resetSelection(session);
  clearTyped(session);
  session.queue = entries.map((e) => ({ ...e, qty: Math.min(e.qty || 1, MAX_QTY) }));

  await processQueue(to);
}

function startTypedItem(session, item, e) {
  resetSelection(session);
  session.item = item;
  session.quantity = e.qty || 1;
  session.variant = isHalfFull(item) && e.variant ? e.variant : null;
  session.boneless = isBonelessEligible(item) && e.boneless !== null && e.boneless !== undefined ? e.boneless : null;
  session.cheese = isPizza(item) && e.cheese !== null && e.cheese !== undefined ? e.cheese : null;
  session.autoAdd = true;
}

async function processQueue(to) {
  const session = getSession(to);

  while (session.queue.length) {
    const e = session.queue.shift();

    if (e.kind === "unknown") {
      session.typedUnknown.push(e.text);
      continue;
    }

    if (e.kind === "item") {
      startTypedItem(session, e.item, e);
      await nextItemStep(to);
      return; // waits for button OR continues via nextItemStep
    }

    if (e.kind === "pick") {
      session.pickCandidates = e.candidates.slice(0, 10);
      session.pickCtx = e;
      await sendPickList(to, e);
      return;
    }

    if (e.kind === "category") {
      resetSelection(session);
      session.category = e.category;
      session.presetQty = e.qty > 1 ? e.qty : null;
      await sendText(to, T(to, "catFromText", e.category));
      await sendItemList(to, 0);
      return;
    }

    if (e.kind === "catpick") {
      resetSelection(session);
      session.presetQty = e.qty > 1 ? e.qty : null;
      await sendCatPick(to, e);
      return;
    }
  }

  await finishTypedOrder(to);
}

async function finishTypedOrder(to) {
  const session = getSession(to);
  const added = session.typedAdded;
  const unknown = session.typedUnknown;
  session.typedAdded = [];
  session.typedUnknown = [];

  if (added.length) await sendText(to, T(to, "typedAdded", added));
  if (unknown.length) await sendText(to, T(to, "typedUnknown", unknown));

  if (session.cart.length) await sendCart(to);
  else await sendWelcomeMessage(to);
}

async function sendSimpleList(to, { body, button, sectionTitle, rows }) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: cut(body, 1000) },
      action: {
        button: cut(button, 20),
        sections: [{ title: cut(sectionTitle, 24), rows }]
      }
    }
  });
}

async function sendPickList(to, e) {
  const rows = session_pickRows(e.candidates.slice(0, 10));
  await sendSimpleList(to, {
    body: T(to, "pickBody", e.query),
    button: T(to, "btnChoose"),
    sectionTitle: e.query,
    rows
  });
}

function session_pickRows(items) {
  return items.map((it, i) => ({
    id: `tpick:${i}`,
    title: cut(marker(it, "BOTH") + it.name, 24),
    description: cut(`${it.name} — ${priceText(it)}`, 72)
  }));
}

async function sendCatPick(to, e) {
  const rows = e.categories.slice(0, 10).map((c) => ({
    id: `cat:${c}`,
    title: cut(c, 24),
    description: cut(T(to, "catDesc", c), 72)
  }));

  await sendSimpleList(to, {
    body: T(to, "catPickBody", e.query),
    button: T(to, "btnChooseCat"),
    sectionTitle: e.query,
    rows
  });
}

// ======================================================
// LOCATION HANDLER (delivery distance)
// ======================================================

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Road distance via Google Routes API (if key is set), else straight-line
async function getDistanceKm(lat, lng) {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "routes.distanceMeters"
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: RESTAURANT_LAT, longitude: RESTAURANT_LNG } } },
          destination: { location: { latLng: { latitude: lat, longitude: lng } } },
          travelMode: "DRIVE"
        }),
        signal: AbortSignal.timeout(8000)
      });

      const data = await response.json();
      const meters = data.routes?.[0]?.distanceMeters;

      if (response.ok && Number.isFinite(meters)) return round2(meters / 1000);
      console.error("Routes API error:", JSON.stringify(data));
    } catch (err) {
      console.error("Routes API failed, using straight-line distance:", err.message);
    }
  }

  return round2(haversineKm(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng));
}

// WhatsApp "Send location" button. Falls back to plain instructions.
async function sendLocationRequest(to) {
  try {
    await sendWhatsAppMessage(to, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "location_request_message",
        body: { text: cut(T(to, "askLocationBtn"), 1000) },
        action: { name: "send_location" }
      }
    });
  } catch (err) {
    console.error("Location request failed, sending plain text:", err.message);
    await sendText(to, T(to, "askLocation"));
  }
}

async function handleLocation(from, loc) {
  const session = getSession(from);

  if (!session.lang) {
    await sendLanguagePrompt(from);
    return;
  }

  // location is accepted while asking for it (or if the customer re-shares it)
  if (
    session.orderType !== "DELIVERY" ||
    (session.awaiting !== "location" && session.awaiting !== "address")
  ) {
    await sendWelcomeMessage(from);
    return;
  }

  const lat = Number(loc?.latitude);
  const lng = Number(loc?.longitude);
  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    Math.abs(lat) > 90 || Math.abs(lng) > 180
  ) {
    await sendText(from, T(from, "needLocation"));
    return;
  }

  const km = await getDistanceKm(lat, lng);
  const charge = deliveryChargeFor(km);

  if (charge === null) {
    resetOrderFlow(session);
    await sendText(from, T(from, "tooFar"));
    await sendOrderTypeButtons(from);
    return;
  }

  session.distanceKm = km;
  session.lat = lat;
  session.lng = lng;

  // Ask for the written address once (keep it if the pin was re-shared)
  if (!session.address) {
    session.awaiting = "address";
    await sendText(from, T(from, "deliveryInfo"));
    await sendText(from, T(from, "askAddress"));
  } else {
    session.awaiting = null;
    await sendText(from, T(from, "deliveryInfo"));
    await sendMenuStart(from);
  }
}

// ======================================================
// ACTION HANDLER (buttons + lists share one router)
// ======================================================

async function handleAction(to, id) {
  const session = getSession(to);

  // ---------- LANGUAGE ----------
  if (id.startsWith("lang_")) {
    session.lang = id.slice(5); // hi | en | hg
    if (!["hi", "en", "hg"].includes(session.lang)) session.lang = "hg";
    await sendWelcomeMessage(to);
    return;
  }

  if (!session.lang) {
    await sendLanguagePrompt(to);
    return;
  }

  if (id === "change_lang") {
    await sendLanguagePrompt(to);
    return;
  }

  // Order type (delivery / takeaway / dine-in) must be chosen first
  const NO_TYPE_NEEDED = ["menu_pdf", "ot_dinein", "ot_takeaway", "ot_delivery"];
  if (!session.orderType && !NO_TYPE_NEEDED.includes(id)) {
    // Old buttons stay tappable forever in the chat. After an order is done (cart empty,
    // order type cleared) tapping an old PAY / CART button must NOT restart the whole welcome flow.
    const STALE_IDS = ["pay_online", "pay_cash", "checkout", "view_cart", "empty_cart", "remove_mode",
      "add_cart", "qty_plus", "qty_minus", "qty_type"];
    const isStale = STALE_IDS.includes(id) || id.startsWith("remove:") || id.startsWith("rempage:");
    if (isStale && session.cart.length === 0) {
      const staleText = {
        en: "⏳ This button is from an old order. Type *Hi* to start a new order.",
        hi: "⏳ यह बटन पुराने ऑर्डर का है। नया ऑर्डर शुरू करने के लिए *Hi* लिखें।",
        hg: "⏳ Ye button purane order ka hai. Naya order shuru karne ke liye *Hi* likho."
      };
      await sendText(to, staleText[session.lang] || staleText.hg);
      return;
    }
    await sendWelcomeMessage(to);
    return;
  }

  // ---------- MENU PDF / WRITE ORDER ----------
  if (id === "menu_pdf") {
    await sendMenuPdf(to);

    const lang = getSession(to).lang || "en";
    const afterPdfText = {
      en: "📄 Menu sent!\n\nWould you like to place your order by writing it?",
      hi: "📄 मेनू भेज दिया गया है!\n\nक्या आप लिखकर अपना ऑर्डर देना चाहेंगे?",
      hg: "📄 Menu bhej diya hai!\n\nKya aap likh kar apna order dena chahoge?"
    }[lang] || "📄 Menu sent!\n\nWould you like to place your order by writing it?";

    await sendButtons(to, afterPdfText, [
      ["write_order", T(to, "btnWrite")]
    ]);
    return;
  }

  if (id === "write_order") {
    session.awaiting = null;
    await sendText(to, T(to, "writePrompt"));
    return;
  }

  // ---------- TYPE ----------
  if (id === "veg" || id === "non_veg" || id === "both") {
    session.type = id === "veg" ? "VEG" : id === "non_veg" ? "NON-VEG" : "BOTH";
    session.category = null;
    resetSelection(session);
    clearTyped(session);
    await sendCategoryList(to, 0);
    return;
  }

  // ---------- NAVIGATION ----------
  if (id === "nav:back_main" || id === "back_main") {
    session.type = null;
    session.category = null;
    resetSelection(session);
    clearTyped(session);
    await sendWelcomeMessage(to);
    return;
  }

  if (id === "add_more" && flowMenu.enabled) {
    resetSelection(session);
    await sendMenuEntry(to);
    return;
  }

  if (id === "add_more" && webMenu.enabled) {
    resetSelection(session);
    await webMenu.sendLink(to);
    return;
  }

  if (id === "nav:back_categories" || id === "back_categories" || id === "add_more") {
    resetSelection(session);
    if (!session.type) return sendWelcomeMessage(to);
    await sendCategoryList(to, 0);
    return;
  }

  if (id === "back_items") {
    resetSelection(session);
    if (!session.type || !session.category) return sendWelcomeMessage(to);
    await sendItemList(to, 0);
    return;
  }

  // ---------- CATEGORY / ITEM LISTS ----------
  if (id.startsWith("cat:")) {
    session.category = id.slice(4);
    if (!session.type) session.type = "BOTH";
    await sendItemList(to, 0);
    return;
  }

  if (id.startsWith("catpage:")) {
    await sendCategoryList(to, Number(id.split(":")[1]));
    return;
  }

  if (id.startsWith("itempage:")) {
    await sendItemList(to, Number(id.split(":")[1]));
    return;
  }

  if (id.startsWith("item:")) {
    const items = getItems(session.type, session.category);
    const item = items[Number(id.split(":")[1])];
    if (!item) return;

    const preset = session.presetQty;
    resetSelection(session);
    session.item = item;
    session.quantity = preset || 1;
    session.presetQty = null;
    await nextItemStep(to);
    return;
  }

  // item picked from a typed-order "which one?" list
  if (id.startsWith("tpick:")) {
    const item = session.pickCandidates[Number(id.split(":")[1])];
    if (!item) return sendWelcomeMessage(to);

    startTypedItem(session, item, session.pickCtx || {});
    await nextItemStep(to);
    return;
  }

  // ---------- ITEM OPTIONS ----------
  if (id === "variant_half" || id === "variant_full") {
    if (!session.item) return sendWelcomeMessage(to);
    session.variant = id === "variant_half" ? "HALF" : "FULL";
    await nextItemStep(to);
    return;
  }

  if (id === "bone_yes" || id === "bone_no") {
    if (!session.item) return sendWelcomeMessage(to);
    session.boneless = id === "bone_yes";
    await nextItemStep(to);
    return;
  }

  if (id === "cheese_yes" || id === "cheese_no") {
    if (!session.item) return sendWelcomeMessage(to);
    session.cheese = id === "cheese_yes";
    await nextItemStep(to);
    return;
  }

  // ---------- QUANTITY ----------
  if (id === "qty_plus") {
    if (!session.item) return sendCart(to);
    session.quantity = Math.min(session.quantity + 1, MAX_QTY);
    await sendQuantityScreen(to);
    return;
  }

  if (id === "qty_minus") {
    if (!session.item) return sendCart(to);
    if (session.quantity > 1) session.quantity -= 1;
    await sendQuantityScreen(to);
    return;
  }

  if (id === "qty_type") {
    if (!session.item) return sendCart(to);
    session.awaiting = "qty";
    await sendText(to, T(to, "typeQtyPrompt", MAX_QTY));
    return;
  }

  if (id === "add_cart") {
    if (!session.item || pendingStep(session)) return sendCart(to);
    addCurrentItemToCart(session);

    if (session.queue.length || session.typedAdded.length || session.typedUnknown.length) {
      await processQueue(to);
    } else {
      await sendCart(to);
    }
    return;
  }

  // ---------- CART ----------
  if (id === "view_cart") {
    await sendCart(to);
    return;
  }

  if (id === "remove_mode") {
    await sendRemoveList(to, 0);
    return;
  }

  if (id.startsWith("rempage:")) {
    await sendRemoveList(to, Number(id.split(":")[1]));
    return;
  }

  if (id.startsWith("remove:")) {
    const index = Number(id.slice(7));
    if (session.cart[index]) session.cart.splice(index, 1);
    await sendCart(to);
    return;
  }

  if (id === "empty_cart") {
    session.cart = [];
    await sendCart(to);
    return;
  }

  // ---------- CHECKOUT ----------
  if (id === "checkout") {
    await startCheckout(to);
    return;
  }

  if (id === "ot_dinein") {
    session.orderType = "DINE-IN";
    session.address = null;
    session.distanceKm = null;
    session.lat = null;
    session.lng = null;
    session.visitTime = null;
    session.awaiting = "visit";
    await sendText(to, T(to, "askVisit"));
    return;
  }

  if (id === "ot_takeaway") {
    session.orderType = "TAKEAWAY";
    session.address = null;
    session.visitTime = null;
    session.distanceKm = null;
    session.lat = null;
    session.lng = null;
    session.awaiting = null;
    await sendMenuStart(to);
    return;
  }

  if (id === "ot_delivery") {
    session.orderType = "DELIVERY";
    session.visitTime = null;
    session.address = null;
    session.distanceKm = null;
    session.lat = null;
    session.lng = null;
    session.awaiting = "location";
    await sendLocationRequest(to);
    return;
  }

  if (id === "pay_online") {
    await placeOrder(to, "ONLINE");
    return;
  }

  if (id === "pay_cash") {
    await placeOrder(to, "CASH");
    return;
  }
}

// ======================================================
// LANGUAGE + WELCOME
// ======================================================

async function sendLanguagePrompt(to) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: t("en", "langPrompt") },
      action: {
        buttons: [
          { type: "reply", reply: { id: "lang_hi", title: "हिंदी" } },
          { type: "reply", reply: { id: "lang_en", title: "English" } },
          { type: "reply", reply: { id: "lang_hg", title: "Hinglish" } }
        ]
      }
    }
  });
}

// Step 1: choose how to receive the order. Once chosen -> menu start.
async function sendWelcomeMessage(to) {
  if (!getSession(to).orderType) {
    await sendOrderTypeButtons(to, "welcome");
    return;
  }
  await sendMenuStart(to);
}

// Step 2: VEG / NON-VEG / BOTH
async function sendMenuStart(to) {
  // Web menu (opens inside WhatsApp). Falls back to the old chat menu if it is not configured.
  if (flowMenu.enabled || webMenu.enabled) {
    await sendMenuEntry(to);
    await sendButtons(to, webMenu.hintText(to), [
      ["menu_pdf", T(to, "btnMenuPdf")],
      ["write_order", T(to, "btnWrite")],
      ["change_lang", T(to, "btnLang")]
    ]);
    return;
  }

  await sendButtons(to, T(to, "menuStart"), [
    ["veg", "VEG"],
    ["non_veg", "NON-VEG"],
    ["both", "VEG + NON-VEG"]
  ]);

  await sendButtons(to, T(to, "welcome2"), [
    ["menu_pdf", T(to, "btnMenuPdf")],
    ["write_order", T(to, "btnWrite")],
    ["change_lang", T(to, "btnLang")]
  ]);
}

// ======================================================
// MENU PDF
// ======================================================

let menuMedia = { id: null, at: 0 };

async function getMenuMediaId(force = false) {
  const fresh = menuMedia.id && Date.now() - menuMedia.at < 20 * 24 * 60 * 60 * 1000;
  if (!force && fresh) return menuMedia.id;

  const buffer = fs.readFileSync(MENU_PDF_PATH);
  const id = await uploadMedia(buffer, "TREAT_RESTAURANT_MENU.pdf", "application/pdf");
  menuMedia = { id, at: Date.now() };
  return id;
}

async function sendMenuPdf(to) {
  if (!fs.existsSync(MENU_PDF_PATH)) {
    console.error("Menu PDF not found. Checked:", MENU_PDF_PATH);
    await sendText(to, T(to, "menuPdfError"));
    return;
  }

  const caption = T(to, "menuPdfCaption");

  try {
    await sendDocument(to, await getMenuMediaId(), "TREAT_RESTAURANT_MENU.pdf", caption);
  } catch (err) {
    console.error("Menu PDF send failed, retrying with fresh upload:", err.message);
    try {
      await sendDocument(to, await getMenuMediaId(true), "TREAT_RESTAURANT_MENU.pdf", caption);
    } catch (err2) {
      console.error("Menu PDF retry failed:", err2.message);
      await sendText(to, T(to, "menuPdfError"));
    }
  }
}

// ======================================================
// PAGED LIST HELPER
// WhatsApp list = max 10 rows total. Page size 7 + up to 3 nav rows = 10.
// ======================================================

const PAGE_SIZE = 7;

async function sendPagedList(to, { body, button, sectionTitle, entries, page, pagePrefix, extraNavRow }) {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  page = Math.min(Math.max(page, 0), totalPages - 1);

  const start = page * PAGE_SIZE;
  const rows = entries.slice(start, start + PAGE_SIZE);

  if (page > 0) {
    rows.push({
      id: `${pagePrefix}:${page - 1}`,
      title: cut(T(to, "navPrev"), 24),
      description: cut(T(to, "navPrevDesc", page, totalPages), 72)
    });
  }

  if (start + PAGE_SIZE < entries.length) {
    rows.push({
      id: `${pagePrefix}:${page + 1}`,
      title: cut(T(to, "navMore"), 24),
      description: cut(T(to, "navMoreDesc", page + 2, totalPages), 72)
    });
  }

  if (extraNavRow) rows.push(extraNavRow);

  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: totalPages > 1 ? `${body}\n\n${T(to, "pageOf", page + 1, totalPages)}` : body
      },
      action: {
        button: cut(button, 20),
        sections: [{ title: cut(sectionTitle, 24), rows }]
      }
    }
  });
}

// ======================================================
// CATEGORY LIST
// ======================================================

async function sendCategoryList(to, page = 0) {
  const session = getSession(to);
  const label = typeLabel(session.type);

  const entries = getCategories(session.type).map((category) => ({
    id: `cat:${category}`,
    title: cut(category, 24),
    description: cut(T(to, "catDesc", category), 72)
  }));

  await sendPagedList(to, {
    body: T(to, "catBody", label, session.type === "BOTH"),
    button: T(to, "btnViewCats"),
    sectionTitle: T(to, "sectionCats", label),
    entries,
    page,
    pagePrefix: "catpage",
    extraNavRow: {
      id: "nav:back_main",
      title: cut(T(to, "navBackMain"), 24),
      description: cut(T(to, "navBackMainDesc"), 72)
    }
  });
}

// ======================================================
// ITEM LIST
// ======================================================

async function sendItemList(to, page = 0) {
  const session = getSession(to);
  const items = getItems(session.type, session.category);

  const entries = items.map((item, index) => {
    const fullTitle = marker(item, session.type) + item.name;
    const price = priceText(item);
    let description = item.desc ? `${price} • ${item.desc}` : price;

    // Long names get cut in the title, so show the full name in the description
    if (Array.from(fullTitle).length > 24) {
      description = `${item.name} — ${price}`;
    }

    return {
      id: `item:${index}`,
      title: cut(fullTitle, 24),
      description: cut(description, 72)
    };
  });

  await sendPagedList(to, {
    body: T(to, "itemBody", session.category, session.type === "BOTH"),
    button: T(to, "btnViewFood"),
    sectionTitle: session.category,
    entries,
    page,
    pagePrefix: "itempage",
    extraNavRow: {
      id: "nav:back_categories",
      title: cut(T(to, "navBackCats"), 24),
      description: cut(T(to, "navBackCatsDesc"), 72)
    }
  });
}

// ======================================================
// ITEM OPTION STEPS
// ======================================================

async function nextItemStep(to) {
  const session = getSession(to);
  const step = pendingStep(session);

  if (step === "variant") return sendVariantButtons(to);
  if (step === "boneless") return sendBonelessButtons(to);
  if (step === "cheese") return sendCheeseButtons(to);

  // Typed orders are added straight to the cart once every option is known
  if (session.autoAdd) {
    const line = addCurrentItemToCart(session);
    session.typedAdded.push(`• ${line}`);
    await processQueue(to);
    return;
  }

  await sendQuantityScreen(to);
}

async function sendButtons(to, text, buttons) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: cut(text, 1000) },
      action: {
        buttons: buttons.map(([id, title]) => ({
          type: "reply",
          reply: { id, title: cut(title, 20) }
        }))
      }
    }
  });
}

// Opens in WhatsApp's own in-app browser (stays inside the app, no link text shown)
async function sendCtaUrlButton(to, text, buttonLabel, url) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: cut(text, 1000) },
      action: {
        name: "cta_url",
        parameters: { display_text: cut(buttonLabel, 20), url }
      }
    }
  });
}

async function sendVariantButtons(to) {
  const item = getSession(to).item;

  await sendButtons(to, T(to, "variantBody", item.name), [
    ["variant_half", T(to, "btnHalf", item.price.half)],
    ["variant_full", T(to, "btnFull", item.price.full)]
  ]);
}

async function sendBonelessButtons(to) {
  const item = getSession(to).item;

  await sendButtons(to, T(to, "boneBody", item.name, BONELESS_CHARGE), [
    ["bone_no", T(to, "btnWithBone")],
    ["bone_yes", T(to, "btnBoneless", BONELESS_CHARGE)]
  ]);
}

async function sendCheeseButtons(to) {
  const item = getSession(to).item;

  await sendButtons(to, T(to, "cheeseBody", item.name, EXTRA_CHEESE_CHARGE), [
    ["cheese_no", T(to, "btnNoCheese")],
    ["cheese_yes", T(to, "btnCheese", EXTRA_CHEESE_CHARGE)]
  ]);
}

// ======================================================
// QUANTITY  (WhatsApp allows max 3 buttons -> 2 messages)
// ======================================================

async function sendQuantityScreen(to) {
  const session = getSession(to);
  const item = session.item;

  if (!item) {
    await sendCart(to);
    return;
  }

  const menuPrice = unitPrice(item, session.variant, session.boneless, session.cheese);
  const price = chargedUnitPrice(session, item, menuPrice);
  const total = price * session.quantity;

  const opts = optionsText({
    variant: session.variant,
    boneless: session.boneless,
    cheese: session.cheese
  });

  await sendButtons(to, T(to, "qtyBody", item.name, opts, price, session.quantity, total), [
    ["qty_minus", "➖"],
    ["qty_plus", "➕"],
    ["qty_type", T(to, "btnTypeQty")]
  ]);

  await sendButtons(to, T(to, "qtyFinal"), [
    ["add_cart", T(to, "btnAddCart")],
    ["back_items", T(to, "btnBack")]
  ]);
}

// ======================================================
// CART
// ======================================================

// returns a short text like "2 × Masala Chicken (FULL, Boneless)"
function addCurrentItemToCart(session) {
  const item = session.item;

  const line = {
    name: item.name,
    variant: isHalfFull(item) ? session.variant : null,
    boneless: !!session.boneless && isBonelessEligible(item),
    cheese: !!session.cheese && isPizza(item),
    price: unitPrice(
      item,
      session.variant,
      session.boneless && isBonelessEligible(item),
      session.cheese && isPizza(item)
    ),
    quantity: session.quantity,
    chargeCat: chargeCategory(item) // NORMAL_FOOD | SHAKE | MOCKTAIL | COLD_DRINK | WATER
  };

  const summary = `${line.quantity} × ${line.name}${optionsText(line)}`;

  const existing = session.cart.find(
    (l) =>
      l.name === line.name &&
      l.variant === line.variant &&
      l.boneless === line.boneless &&
      l.cheese === line.cheese
  );

  if (existing) {
    existing.quantity = Math.min(existing.quantity + line.quantity, MAX_QTY);
  } else if (session.cart.length < MAX_CART_LINES) {
    session.cart.push(line);
  }

  resetSelection(session);
  return summary;
}

// Cart preview (before checkout): item prices exactly as they will be billed.
// Delivery has the same item prices as takeaway, and distance is not needed here.
function previewBill(session) {
  const type = session.orderType === "DINE-IN" ? "DINE-IN" : "TAKEAWAY";
  return calculateOrderTotal({ items: session.cart, orderType: type });
}

function cartSubtotal(session) {
  return previewBill(session).foodSubtotal;
}

// Unit price of one item as charged for the current order type
function chargedUnitPrice(session, item, menuPrice) {
  const type = session.orderType === "DINE-IN" ? "DINE-IN" : "TAKEAWAY";
  const bill = calculateOrderTotal({
    items: [{ name: item.name, price: menuPrice, quantity: 1, chargeCat: chargeCategory(item) }],
    orderType: type
  });
  return bill.items[0].unitPrice;
}

function buildCartLines(items) {
  let text = "";
  items.forEach((line, index) => {
    text +=
      `${index + 1}. ${line.name}${optionsText(line)}\n` +
      `   ₹${line.unitPrice} × ${line.quantity} = ₹${line.lineTotal}\n\n`;
  });
  return text;
}

async function sendCart(to) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendButtons(to, T(to, "cartEmpty"), [
      ["add_more", T(to, "btnViewMenu")],
      ["back_main", T(to, "btnBackShort")]
    ]);
    return;
  }

  const subtotal = cartSubtotal(session);
  let body = `${T(to, "cartTitle")}\n\n${buildCartLines(previewBill(session).items)}${T(to, "subtotalLbl")}: ₹${subtotal}`;

  // Button body limit is 1024 chars -> long carts go as plain text first
  if (body.length > 900) {
    await sendText(to, body);
    body = T(to, "whatNext", subtotal);
  }

  await sendButtons(to, body, [
    ["add_more", T(to, "btnAddMore")],
    ["remove_mode", T(to, "btnRemove")],
    ["checkout", T(to, "btnCheckout")]
  ]);
}

async function sendRemoveList(to, page = 0) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendCart(to);
    return;
  }

  const previewItems = previewBill(session).items;
  const entries = previewItems.map((line, index) => ({
    id: `remove:${index}`,
    title: cut(`${index + 1}. ${line.name}`, 24),
    description: cut(
      `${optionsText(line).trim()} × ${line.quantity} — ₹${line.lineTotal}`.trim(),
      72
    )
  }));

  await sendPagedList(to, {
    body: T(to, "removeBody"),
    button: T(to, "btnRemoveItem"),
    sectionTitle: T(to, "removeSection"),
    entries,
    page,
    pagePrefix: "rempage",
    extraNavRow: {
      id: "empty_cart",
      title: cut(T(to, "navClear"), 24),
      description: cut(T(to, "navClearDesc"), 72)
    }
  });
}

// ======================================================
// CHECKOUT
// ======================================================

async function startCheckout(to) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendCart(to);
    return;
  }

  if (!session.orderType) {
    await sendWelcomeMessage(to);
    return;
  }

  const subtotal = cartSubtotal(session);

  // Minimum food order applies to DELIVERY only
  if (session.orderType === "DELIVERY" && subtotal < MIN_FOOD_ORDER) {
    await sendButtons(to, T(to, "minOrder", MIN_FOOD_ORDER, subtotal), [
      ["add_more", T(to, "btnAddMore")],
      ["view_cart", T(to, "btnViewCart")]
    ]);
    return;
  }

  // Make sure the order-type details are complete before billing
  if (session.orderType === "DELIVERY" && session.distanceKm === null) {
    session.awaiting = "location";
    await sendLocationRequest(to);
    return;
  }
  if (session.orderType === "DELIVERY" && !session.address) {
    session.awaiting = "address";
    await sendText(to, T(to, "askAddress"));
    return;
  }
  if (session.orderType === "DINE-IN" && !session.visitTime) {
    session.awaiting = "visit";
    await sendText(to, T(to, "askVisit"));
    return;
  }

  await sendBill(to);
}

const ORDER_TYPE_LABEL = {
  "DINE-IN": "Dine-In",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery"
};

// Delivery first, then takeaway, then dine-in
async function sendOrderTypeButtons(to, textKey = "orderTypeBody") {
  await sendButtons(to, T(to, textKey), [
    ["ot_delivery", T(to, "btnDelivery")],
    ["ot_takeaway", T(to, "btnTakeaway")],
    ["ot_dinein", T(to, "btnDineIn")]
  ]);
}

// ONE place for totals: billing.js -> calculateOrderTotal().
// Everything (WhatsApp bill, PDF, Telegram, owner alert) uses this object.
function calcBill(session) {
  return calculateOrderTotal({
    items: session.cart,
    orderType: session.orderType,
    distanceKm: session.distanceKm, // used internally for the delivery slab only
    discount: 0 // no coupon system in this bot yet - plug it in here
  });
}

function billText(to, session, bill) {
  let text = `${T(to, "cartTitle")}\n\n${buildCartLines(bill.items)}`;

  text += "━━━━━━━━━━━━\n";
  text += `${T(to, "billSubtotal")}: ₹${rs(bill.foodSubtotal)}\n`;
  if (bill.packingCharges > 0) {
    text += `${T(to, "billPacking")}: ₹${rs(bill.packingCharges)}\n`;
  }
  if (session.orderType === "DELIVERY") {
    text += `${T(to, "billDelivery")}: ₹${rs(bill.deliveryCharges)}\n`;
  }
  if (bill.discount > 0) {
    text += `${T(to, "billDiscount")}: -₹${rs(bill.discount)}\n`;
  }
  text += `*${T(to, "billTotal")}: ₹${rs(bill.total)}*\n`;
  text += "━━━━━━━━━━━━\n\n";
  text += `${T(to, "billType")}: ${ORDER_TYPE_LABEL[session.orderType] || session.orderType}\n`;
  if (session.orderType === "DINE-IN" && session.visitTime) {
    text += `${T(to, "billVisit")}: ${session.visitTime}\n`;
  }
  if (session.address) text += `${T(to, "billAddress")}: ${session.address}\n`;

  return text;
}

async function sendBill(to) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendCart(to);
    return;
  }

  const bill = calcBill(session);
  await sendText(to, billText(to, session, bill));

  await sendButtons(to, T(to, "payBody"), [
    ["pay_online", T(to, "btnPayOnline")],
    ["pay_cash", T(to, session.orderType === "DELIVERY" ? "btnCod" : "btnCounter")],
    ["view_cart", T(to, "btnEdit")]
  ]);
}

// ======================================================
// PLACE ORDER
// ======================================================

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

async function makeOrderId() {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit"
  }).formatToParts(new Date());
  const dd = p.find((x) => x.type === "day").value;
  const mm = p.find((x) => x.type === "month").value;

  for (let tries = 0; tries < 20; tries++) {
    let suffix = "";
    const bytes = crypto.randomBytes(4);
    for (const byte of bytes) suffix += ID_ALPHABET[byte % ID_ALPHABET.length];
    const id = `TR-${dd}${mm}-${suffix}`;
    if (!orders[id] && !(await db.orderExists(id))) return id; // never overwrite an existing order
  }
  throw new Error("Could not generate a unique order id");
}

async function placeOrder(to, method) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendCart(to);
    return;
  }

  if (!session.orderType) {
    await startCheckout(to);
    return;
  }

  // spam guard: max 3 orders per phone per 10 minutes
  const recentMem = Object.values(orders).filter(
    (o) => o.phone === to && Date.now() - new Date(o.createdAt).getTime() < 10 * 60 * 1000
  ).length;
  const recent = Math.max(recentMem, await db.countRecentOrders(to, 10 * 60 * 1000));
  if (recent >= 3) {
    await sendText(to, "Too many orders in a short time. Please call the restaurant to place another order.");
    return;
  }

  // One checkout = one payment: kill any older unpaid link first (or refuse if it can still be paid)
  if (!(await supersedePendingOnline(to))) {
    await sendText(to, T(to, "payPending"));
    return;
  }

  let bill;
  try {
    bill = calcBill(session);
  } catch (err) {
    // e.g. delivery location missing / out of range: never place a broken order
    console.error("Billing error:", err.message);
    await startCheckout(to);
    return;
  }

  const order = {
    id: await makeOrderId(),
    phone: to,
    name: session.name,
    lang: session.lang,
    orderType: session.orderType,
    visitTime: session.visitTime,
    address: session.address,
    lat: session.lat,
    lng: session.lng,
    items: bill.items, // items exactly as billed
    bill,
    method,
    status: method === "ONLINE" ? "AWAITING_PAYMENT" : "CONFIRMED_CASH",
    createdAt: new Date().toISOString()
  };

  orders[order.id] = order;
  await db.saveOrder(order);

  // ---------------- CASH ----------------
  if (method === "CASH") {
    session.cart = [];
    resetOrderFlow(session);

    // Restaurant must ALWAYS get the order, even if the WhatsApp send to the customer fails
    // (expired token, customer blocked, 24h window...). Customer messages are best-effort.
    await notifyOwner(order);

    try {
      await sendText(
        to,
        T(to, "cashConfirmed", order.id, rs(bill.total), order.orderType === "DELIVERY")
      );
      await deliverInvoice(order, to, order.lang);
    } catch (err) {
      console.error("Customer confirmation failed (order already saved + owner notified):", order.id, err.message);
    }
    return;
  }

  // ---------------- ONLINE ----------------
  let link = null;
  try {
    link = await createRazorpayPaymentLink(order);
  } catch (err) {
    console.error("Razorpay link error:", err.message);
  }

  if (!link) {
    // Order was never payable online -> drop it so it can be re-placed
    delete orders[order.id];
    await db.deleteOrder(order.id);
    await sendButtons(to, T(to, "payUnavailable"), [
      ["pay_cash", T(to, "btnPayCash")],
      ["view_cart", T(to, "btnViewCart")]
    ]);
    return;
  }

  order.paymentLink = link;
  await db.saveOrder(order);
  session.cart = [];
  resetOrderFlow(session);

  await sendCtaUrlButton(
    to,
    T(to, "payLinkBody", order.id, rs(bill.total)),
    T(to, "btnPayNow", rs(bill.total)),
    link
  );
}

// ======================================================
// INVOICE PDF (thermal format) -> WhatsApp document
// ======================================================

async function deliverInvoice(order, to, lang) {
  try {
    const pdf = await buildInvoicePdf(order);
    const filename = `Invoice_${order.id}.pdf`;
    const mediaId = await uploadMedia(pdf, filename, "application/pdf");
    await sendDocument(to, mediaId, filename, t(lang || "en", "invoiceCaption", order.id));
  } catch (err) {
    console.error("Invoice error:", err.message);
  }
}

// ======================================================
// RAZORPAY  (works once env vars are set)
// ======================================================

async function createRazorpayPaymentLink(order) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.log("Razorpay keys not set - skipping payment link");
    return null;
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Math.round(order.bill.total * 100), // paise
      currency: "INR",
      accept_partial: false,
      reference_id: order.id,
      description: `TREAT RESTAURANT order ${order.id}`,
      customer: {
        name: order.name || "Customer",
        contact: `+${order.phone}`
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      expire_by: Math.floor(Date.now() / 1000) + 30 * 60,
      notes: { order_id: order.id, phone: order.phone }
    }),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Razorpay API error: ${JSON.stringify(data)}`);
  }

  order.paymentLinkId = data.id || null; // needed to cancel this link if the customer starts a new checkout
  return data.short_url;
}

// ---- one checkout = one payment ----------------------------------------
const LINK_TTL_MS = 30 * 60 * 1000; // must match expire_by above

async function razorpayLinkCall(method, linkId, action) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(
    `https://api.razorpay.com/v1/payment_links/${encodeURIComponent(linkId)}${action ? "/" + action : ""}`,
    { method, headers: { Authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(15000) }
  );
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}

// Before a NEW order is placed: every older unpaid online link of this customer must be dead.
// Returns false when an older link can still be paid (or its state is unknown) -> caller must NOT
// create another order, otherwise the customer could pay twice.
async function supersedePendingOnline(phone) {
  const pending = new Map();
  for (const o of Object.values(orders)) {
    if (o.phone === phone && o.status === "AWAITING_PAYMENT") pending.set(o.id, o);
  }
  for (const o of await db.findPendingOrders(phone)) {
    if (!pending.has(o.id)) pending.set(o.id, orders[o.id] || o);
  }

  for (const o of pending.values()) {
    let newStatus = null;

    if (Date.now() - new Date(o.createdAt).getTime() > LINK_TTL_MS + 2 * 60 * 1000) {
      newStatus = "EXPIRED"; // link already expired on Razorpay's side
    } else if (!o.paymentLinkId || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Cannot verify/cancel pending payment link for", o.id);
      return false;
    } else {
      try {
        const c = await razorpayLinkCall("POST", o.paymentLinkId, "cancel");
        if (c.ok) newStatus = "CANCELLED";
        else {
          const st = await razorpayLinkCall("GET", o.paymentLinkId);
          const status = st.data?.status;
          if (status === "cancelled" || status === "expired") newStatus = status.toUpperCase();
          else {
            console.error("Pending link not cancellable:", o.id, status);
            return false; // paid / partially paid / unknown -> block a second checkout
          }
        }
      } catch (err) {
        console.error("Cancel payment link failed:", o.id, err.message);
        return false;
      }
    }

    o.status = newStatus;
    orders[o.id] = o;
    await db.saveOrder(o);
  }
  return true;
}

// Razorpay Dashboard -> Webhooks: https://<render-url>/razorpay-webhook
// Event: payment_link.paid    Secret = RAZORPAY_WEBHOOK_SECRET
const paymentInFlight = new Set();
app.post("/razorpay-webhook", async (req, res) => {
  try {
    const signature = req.get("x-razorpay-signature");

    if (!RAZORPAY_WEBHOOK_SECRET || !signature || !req.rawBody) {
      return res.sendStatus(400);
    }

    const expected = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.log("Razorpay webhook: invalid signature");
      return res.sendStatus(400);
    }

    res.sendStatus(200); // verified, acknowledge first

    if (req.body.event !== "payment_link.paid") return;

    const entity = req.body.payload?.payment_link?.entity;
    if (!entity) return;

    // Razorpay retries / sends duplicates: process each order's payment exactly once at a time
    const payKey = String(entity.reference_id);
    if (paymentInFlight.has(payKey)) return;
    paymentInFlight.add(payKey);
    try {

    let order = orders[entity.reference_id];
    if (!order) {
      // process restarted: recover the real order from Supabase
      order = await db.loadOrder(entity.reference_id);
      if (order) orders[order.id] = order;
    }

    if (order) {
      if (order.status === "PAID") return; // duplicate event

      // Never trust "paid" blindly: amount, currency and status must match the order
      const paidPaise = Number(entity.amount_paid ?? entity.amount);
      const expectedPaise = Math.round(order.bill.total * 100);
      if (entity.status !== "paid" || entity.currency !== "INR" || paidPaise !== expectedPaise) {
        console.error("Razorpay mismatch:", order.id, entity.status, entity.currency, paidPaise, expectedPaise);
        await alertOwner(
          `⚠️ Payment mismatch for order ${order.id}. Expected ₹${order.bill.total}, got ₹${paidPaise / 100}. Order NOT marked paid - please verify in Razorpay.`
        );
        return;
      }

      if (order.status === "CANCELLED" || order.status === "EXPIRED") {
        await alertOwner(
          `⚠️ Payment received for order ${order.id} which was ${order.status}. Amount ₹${order.bill.total}. Order is being confirmed - please verify in Razorpay.`
        );
      }

      order.status = "PAID";
      order.paidAt = new Date().toISOString();
      order.paymentId = req.body.payload?.payment?.entity?.id || null;
      await db.saveOrder(order);

      await notifyOwner(order); // restaurant first, always

      try {
        await sendText(order.phone, t(order.lang || "hg", "payReceived", order.id, rs(order.bill.total)));
        await deliverInvoice(order, order.phone, order.lang);
      } catch (err) {
        console.error("Customer payment confirmation failed (owner already notified):", order.id, err.message);
      }
    } else {
      // Server restarted and lost in-memory orders: still tell the customer
      const phone = entity.notes?.phone;
      const paid = (entity.amount_paid ?? entity.amount ?? 0) / 100;
      console.error("Paid link for unknown order:", entity.reference_id);
      // Owner FIRST: if the customer message throws (token/24h window) the owner must still know
      await alertOwner(
        `⚠️ PAID ONLINE but order details were lost (server restarted).\nOrder: ${entity.reference_id}\nAmount: ₹${paid}\nCustomer: +${phone || "unknown"}\nPlease call the customer.`
      );
      if (phone) {
        try {
          await sendText(
            phone,
            `✅ Payment received for order ${entity.reference_id}. Restaurant will contact you shortly.`
          );
        } catch (err) {
          console.error("Customer payment confirmation failed:", entity.reference_id, err.message);
        }
      }
    }
    } finally {
      paymentInFlight.delete(payKey);
    }
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    if (!res.headersSent) res.sendStatus(500);
  }
});

// ======================================================
// OWNER NOTIFICATION (text + invoice)
// ======================================================

async function notifyOwner(order) {
  // Build the PDF once for Telegram (same bill data as the customer copy)
  let pdf = null;
  try {
    pdf = await buildInvoicePdf(order);
  } catch (err) {
    console.error("Invoice build failed (Telegram):", err.message);
  }

  let delivered = false;
  try {
    delivered = await notifyTelegram(order, pdf);
  } catch (err) {
    console.error("Telegram notification failed:", err.message);
  }

  // Nobody was told about this order -> make it impossible to miss in the Render logs
  if (!delivered) {
    console.error("CRITICAL: NO OWNER ALERT DELIVERED for order", order.id, "- check TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
  }
}

// Text alert to the owner on Telegram (payment problems etc.)
async function alertOwner(text) {
  let delivered = false;
  try {
    delivered = await notifyTelegramText(text);
  } catch (err) {
    console.error("Telegram text alert failed:", err.message);
  }
  if (!delivered) console.error("CRITICAL: owner alert NOT delivered:", text);
}

// ======================================================
// WHATSAPP API SENDERS
// ======================================================

async function sendText(to, body) {
  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body }
  });
}

// Loop safety-net: never send more than 30 WhatsApp messages/minute to one number,
// whatever the cause (bug, retry storm, ping-pong). Excess is dropped and logged.
const outBuckets = new Map();
function outboundAllowed(to) {
  const now = Date.now();
  const b = outBuckets.get(to);
  if (!b || now - b.start > 60 * 1000) {
    outBuckets.set(to, { start: now, count: 1 });
    return true;
  }
  b.count += 1;
  return b.count <= 30;
}

async function sendWhatsAppMessage(to, message) {
  if (!outboundAllowed(to)) {
    console.error("OUTBOUND LIMIT hit for", to, "- message dropped (possible loop)");
    return null;
  }
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15000)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("WhatsApp API error:", JSON.stringify(data));
    throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`);
  }

  return data;
}

// Upload a file (Buffer) to WhatsApp and get a media id back
async function uploadMedia(buffer, filename, mime) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([buffer], { type: mime }), filename);

  const response = await fetch(`https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }, // no Content-Type: fetch sets the boundary
    body: form,
    signal: AbortSignal.timeout(20000)
  });

  const data = await response.json();

  if (!response.ok || !data.id) {
    throw new Error(`Media upload error: ${JSON.stringify(data)}`);
  }

  return data.id;
}

async function sendDocument(to, mediaId, filename, caption) {
  return sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: { id: mediaId, filename, caption }
  });
}

// ======================================================
// VOICE AGENT INTERNAL API
// Called by the separate LiveKit voice agent process - never by a browser or Meta.
// Same session object + same order functions as the text bot, so a call and a
// chat message land in the exact same place (Telegram, invoice, payment button).
// ======================================================

function requireVoiceSecret(req, res, next) {
  if (!VOICE_INTERNAL_SECRET || req.get("x-voice-secret") !== VOICE_INTERNAL_SECRET) {
    return res.sendStatus(403);
  }
  next();
}

function voicePhone(req, res) {
  const phone = String(req.body?.phone || "");
  if (!/^\d{6,15}$/.test(phone)) {
    res.status(400).json({ error: "invalid phone" });
    return null;
  }
  return phone;
}

// Full menu as plain text, for the agent to read out on the call.
// type: VEG | NON-VEG | BOTH (defaults to BOTH)
app.get("/voice/menu-text", requireVoiceSecret, (req, res) => {
  const type = ["VEG", "NON-VEG", "BOTH"].includes(req.query.type) ? req.query.type : "BOTH";
  const lines = [];
  for (const category of getCategories(type)) {
    lines.push(category);
    for (const item of getItems(type, category)) {
      const price = isHalfFull(item) ? `Half ₹${item.price.half} / Full ₹${item.price.full}` : `₹${item.price}`;
      lines.push(`- ${item.name}${marker(item, type)}: ${price}`);
    }
  }
  res.json({ type: typeLabel(type), menuText: lines.join("\n") });
});

// Load (or create) the caller's session, same object the text bot uses
app.post("/voice/session", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  const lang = ["en", "hi", "hg"].includes(req.body?.lang) ? req.body.lang : "hg";

  await hydrateSession(phone);
  const session = getSession(phone);
  session.lang = lang;
  session.type = "BOTH";
  await persistSession(phone);

  res.json({ cart: previewBill(session).items, orderType: session.orderType || null });
});

// One spoken line -> same fuzzy matcher the typed-order flow uses.
// Returns what happened so the agent can read it back / ask to repeat.
app.post("/voice/add-item", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  const text = String(req.body?.text || "").slice(0, 200);

  await hydrateSession(phone);
  const session = getSession(phone);
  const entries = parseTypedOrder(text);
  const entry = entries.find((e) => e.kind !== "unknown") || entries[0];

  if (!entry || entry.kind === "unknown") {
    return res.json({ ok: false, reason: "not_understood" });
  }
  if (entry.kind === "item") {
    startTypedItem(session, entry.item, entry);
    const summary = addCurrentItemToCart(session);
    await persistSession(phone);
    return res.json({ ok: true, added: summary, cartSubtotal: cartSubtotal(session) });
  }
  // "pick" (several matches) / "category" / "catpick": too ambiguous for a one-shot voice
  // add - tell the agent so it can ask the customer a clarifying question in its own words.
  const options =
    entry.kind === "pick"
      ? entry.candidates.slice(0, 5).map((i) => i.name)
      : entry.kind === "category"
      ? [entry.category]
      : (entry.categories || []).slice(0, 5);
  res.json({ ok: false, reason: "ambiguous", options });
});

// orderType: TAKEAWAY | DINE-IN only - DELIVERY is handled on WhatsApp chat (needs a location pin)
app.post("/voice/set-order-type", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  const orderType = req.body?.orderType;
  if (!["TAKEAWAY", "DINE-IN"].includes(orderType)) {
    return res.status(400).json({ error: "orderType must be TAKEAWAY or DINE-IN" });
  }

  await hydrateSession(phone);
  const session = getSession(phone);
  session.orderType = orderType;
  session.address = null;
  session.distanceKm = null;
  session.lat = null;
  session.lng = null;
  await persistSession(phone);
  res.json({ ok: true });
});

app.post("/voice/set-visit-time", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  await hydrateSession(phone);
  const session = getSession(phone);
  session.visitTime = cut(String(req.body?.visitTime || ""), 30) || null;
  await persistSession(phone);
  res.json({ ok: true });
});

// Read back the current cart + total before asking for payment method
app.post("/voice/cart-summary", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  await hydrateSession(phone);
  const session = getSession(phone);

  if (!session.cart.length) return res.json({ empty: true });

  let bill;
  try {
    bill = calcBill(session);
  } catch (err) {
    return res.json({ empty: false, error: err.message });
  }
  res.json({
    empty: false,
    items: bill.items.map((l) => ({ name: l.name + optionsText(l), quantity: l.quantity, lineTotal: l.lineTotal })),
    subtotal: bill.foodSubtotal,
    packing: bill.packing,
    total: bill.total,
    minOrderMet: true // MIN_FOOD_ORDER only applies to delivery, which voice doesn't do
  });
});

// method: CASH | ONLINE - reuses the exact same placeOrder() the text bot uses, so
// Telegram, the invoice PDF, and (for ONLINE) the WhatsApp payment button all fire identically.
app.post("/voice/place-order", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  const method = req.body?.method === "ONLINE" ? "ONLINE" : "CASH";

  await hydrateSession(phone);
  const session = getSession(phone);
  if (!session.cart.length) return res.json({ ok: false, reason: "empty_cart" });
  if (!session.orderType) return res.json({ ok: false, reason: "no_order_type" });

  let bill;
  try {
    bill = calcBill(session);
  } catch (err) {
    return res.json({ ok: false, reason: "billing_error", message: err.message });
  }

  await placeOrder(phone, method);
  await persistSession(phone);

  // placeOrder() already sent the WhatsApp confirmation / payment button itself.
  res.json({
    ok: true,
    method,
    total: bill.total,
    note:
      method === "ONLINE"
        ? "Payment button sent on WhatsApp chat."
        : "Cash order confirmed, invoice sent on WhatsApp chat."
  });
});

// Sends the menu PDF to the caller's WhatsApp chat, exactly like the text bot's menu_pdf button
app.post("/voice/send-menu-pdf", requireVoiceSecret, async (req, res) => {
  const phone = voicePhone(req, res);
  if (!phone) return;
  try {
    await sendMenuPdf(phone);
    res.json({ ok: true });
  } catch (err) {
    console.error("Voice send-menu-pdf failed:", err.message);
    res.status(500).json({ ok: false });
  }
});

// ======================================================
// WEB MENU (needs PUBLIC_BASE_URL or Render's RENDER_EXTERNAL_URL, https)
// ======================================================
const webMenu = createWebMenu({
  app, getSession, hydrateSession, persistSession, withPhoneLock,
  startTypedItem, addCurrentItemToCart, resetSelection, clearTyped,
  sendCart, sendText, sendCtaUrlButton, isOpenNow,
  MAX_QTY, MAX_CART_LINES, MIN_FOOD_ORDER, BONELESS_CHARGE, EXTRA_CHEESE_CHARGE
});
webMenu.register();

// IN-CHAT MENU (WhatsApp Flow) - active only when WHATSAPP_FLOW_ID is set
const flowMenu = createFlowMenu({ getSession, sendWhatsAppMessage, startTypedItem, processQueue });
// Flow first; if Meta rejects it (wrong / unpublished Flow ID) fall back to the web menu so the customer is never stuck
async function sendMenuEntry(to) {
  if (flowMenu.enabled) {
    try {
      await sendFlowMenu(to);
      return;
    } catch (err) {
      console.error("FLOW SEND FAILED (check WHATSAPP_FLOW_ID is the FLOW id and the flow is Published):", err.message);
    }
  }
  if (webMenu.enabled) await webMenu.sendLink(to);
}

async function sendFlowMenu(to) {
  const lang = getSession(to).lang || "hg";
  const body = { en: "Open the menu and pick your dishes 👇", hi: "मेनू खोलकर अपनी डिश चुनें 👇", hg: "Menu kholo aur apni dish chuno 👇" }[lang] || "Menu kholo aur apni dish chuno 👇";
  const btn = { en: "🍽️ OPEN MENU", hi: "🍽️ मेनू खोलें", hg: "🍽️ MENU KHOLO" }[lang] || "🍽️ MENU KHOLO";
  await flowMenu.sendFlow(to, body, btn);
}

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TREAT RESTAURANT bot running on port ${PORT}`);
});
