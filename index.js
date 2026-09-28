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
  marker
} = require("./menu");
const { t } = require("./i18n");
const { parseTypedOrder } = require("./matcher");
const { buildInvoicePdf } = require("./invoice");

const app = express();

// Keep raw body: needed to verify Razorpay webhook signature
app.use(
  express.json({
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

// Owner number with country code, no "+" (e.g. 919876543210)
// Free-form messages to the owner only work if the owner messaged the bot
// in the last 24h. For reliable alerts use an approved template message.
const OWNER_PHONE = process.env.OWNER_PHONE;

// ---------------- Razorpay (add keys at the end) ----------------
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// ---------------- Business rules ----------------
const MIN_FOOD_ORDER = 300;      // excludes packing/delivery
const PACKING_PERCENT = 7;       // % of food subtotal (takeaway + delivery)
const BONELESS_CHARGE = 50;      // per plate, non-veg main course (as printed on menu)
const EXTRA_CHEESE_CHARGE = 30;  // per pizza
const MAX_QTY = 500;

const RESTAURANT_LAT = Number(process.env.RESTAURANT_LAT || 0);
const RESTAURANT_LNG = Number(process.env.RESTAURANT_LNG || 0);

// !!! CHANGE the km limits to your real tiers (charges are from your notes,
// km breakpoints are PLACEHOLDERS). Last maxKm = delivery limit.
const DELIVERY_TIERS = [
  { maxKm: 2.5, charge: 30 },
  { maxKm: 5, charge: 50 },
  { maxKm: 7.5, charge: 80 },
  { maxKm: 10, charge: 100 }
];

const MENU_PDF_PATH = path.join(__dirname, "assets", "menu.pdf");

// ======================================================
// SESSIONS / ORDERS  (in memory: lost on restart/sleep)
// ======================================================

const sessions = {};
const orders = {};
const processedMessages = new Set();

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      lang: null, // "en" | "hi" | "hg"
      type: null, // "VEG" | "NON-VEG" | "BOTH"
      category: null,
      item: null,
      variant: null,
      boneless: null,
      cheese: null,
      quantity: 1,
      cart: [],
      awaiting: null, // "qty" | "address" | "table" | "location"
      orderType: null,
      address: null,
      table: null,
      distanceKm: null,
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
  return sessions[phone];
}

// translate for a given customer
const T = (to, key, ...args) => t(getSession(to).lang || "en", key, ...args);

const cut = (s, n) => Array.from(String(s)).slice(0, n).join("");
const round2 = (n) => Math.round(n * 100) / 100;

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

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

// ======================================================
// RECEIVE WHATSAPP MESSAGES
// ======================================================

app.post("/webhook", async (req, res) => {
  // Reply to Meta immediately so it doesn't retry while we process
  res.sendStatus(200);

  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    if (!message) return;

    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    if (processedMessages.size > 2000) processedMessages.clear();

    const from = message.from;
    const session = getSession(from);
    const profileName = value.contacts?.[0]?.profile?.name;
    if (profileName) session.name = profileName;

    if (message.type === "text") {
      await handleText(from, message.text?.body || "");
      return;
    }

    if (message.type === "location") {
      await handleLocation(from, message.location);
      return;
    }

    if (message.type === "interactive") {
      const id =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id;
      if (id) await handleAction(from, id);
      return;
    }

    // image / sticker / audio etc.
    if (!session.lang) await sendLanguagePrompt(from);
    else await sendWelcomeMessage(from);
  } catch (error) {
    console.error("Webhook error:", error);
  }
});

// ======================================================
// TEXT HANDLER
// ======================================================

const GREETINGS = [
  "hi", "hii", "hiii", "hello", "hlo", "helo", "hey", "hie", "start",
  "menu", "order", "namaste", "namaskar", "नमस्ते", "हेलो", "हाय"
];

async function handleText(from, raw) {
  const session = getSession(from);
  const text = raw.trim();
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

  // 2. greetings always restart
  if (GREETINGS.includes(lower)) {
    resetSelection(session);
    clearTyped(session);
    session.awaiting = null;
    session.type = null;
    session.category = null;
    await sendWelcomeMessage(from);
    return;
  }

  // 3. checkout inputs
  if (session.awaiting === "address") {
    if (text.length < 10) {
      await sendText(from, T(from, "addressShort"));
      return;
    }
    session.address = text;
    session.awaiting = "location";
    await sendText(from, T(from, "askLocation"));
    return;
  }

  if (session.awaiting === "table") {
    session.table = cut(text, 30);
    session.awaiting = null;
    await sendBill(from);
    return;
  }

  if (session.awaiting === "location") {
    await sendText(from, T(from, "needLocation"));
    return;
  }

  // 4. typed quantity
  if (session.awaiting === "qty" || (session.item && !pendingStep(session))) {
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
    await sendWelcomeMessage(from);
    return;
  }

  // 6. typed order
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

function deliveryChargeFor(km) {
  for (const tier of DELIVERY_TIERS) {
    if (km <= tier.maxKm) return tier.charge;
  }
  return null; // beyond delivery limit
}

async function handleLocation(from, loc) {
  const session = getSession(from);

  if (!session.lang) {
    await sendLanguagePrompt(from);
    return;
  }

  if (session.awaiting !== "location") {
    await sendWelcomeMessage(from);
    return;
  }

  if (!RESTAURANT_LAT || !RESTAURANT_LNG) {
    console.error("RESTAURANT_LAT / RESTAURANT_LNG env vars are not set");
    session.awaiting = null;
    await sendText(from, T(from, "deliveryNotConfigured"));
    await sendOrderTypeButtons(from);
    return;
  }

  // Straight-line distance, NOT road distance
  const km = haversineKm(RESTAURANT_LAT, RESTAURANT_LNG, loc.latitude, loc.longitude);
  const maxKm = DELIVERY_TIERS[DELIVERY_TIERS.length - 1].maxKm;

  session.awaiting = null;

  if (deliveryChargeFor(km) === null) {
    session.distanceKm = null;
    await sendText(from, T(from, "tooFar", km.toFixed(1), maxKm));
    await sendOrderTypeButtons(from);
    return;
  }

  session.distanceKm = round2(km);
  await sendBill(from);
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

  // ---------- MENU PDF / WRITE ORDER ----------
  if (id === "menu_pdf") {
    await sendMenuPdf(to);
    await sendWelcomeMessage(to);
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
    session.awaiting = "table";
    await sendText(to, T(to, "askTable"));
    return;
  }

  if (id === "ot_takeaway") {
    session.orderType = "TAKEAWAY";
    session.address = null;
    session.table = null;
    session.distanceKm = null;
    session.awaiting = null;
    await sendBill(to);
    return;
  }

  if (id === "ot_delivery") {
    session.orderType = "DELIVERY";
    session.table = null;
    session.awaiting = "address";
    await sendText(to, T(to, "askAddress"));
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

async function sendWelcomeMessage(to) {
  await sendButtons(to, T(to, "welcome"), [
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
    console.error("assets/menu.pdf not found");
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

  const price = unitPrice(item, session.variant, session.boneless, session.cheese);
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
    quantity: session.quantity
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
  } else {
    session.cart.push(line);
  }

  resetSelection(session);
  return summary;
}

function cartSubtotal(session) {
  return session.cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

function buildCartLines(session) {
  let text = "";
  session.cart.forEach((line, index) => {
    text +=
      `${index + 1}. ${line.name}${optionsText(line)}\n` +
      `   ₹${line.price} × ${line.quantity} = ₹${line.price * line.quantity}\n\n`;
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
  let body = `${T(to, "cartTitle")}\n\n${buildCartLines(session)}${T(to, "subtotalLbl")}: ₹${subtotal}`;

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

  const entries = session.cart.map((line, index) => ({
    id: `remove:${index}`,
    title: cut(`${index + 1}. ${line.name}`, 24),
    description: cut(
      `${optionsText(line).trim()} × ${line.quantity} — ₹${line.price * line.quantity}`.trim(),
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

  const subtotal = cartSubtotal(session);

  if (subtotal < MIN_FOOD_ORDER) {
    await sendButtons(to, T(to, "minOrder", MIN_FOOD_ORDER, subtotal), [
      ["add_more", T(to, "btnAddMore")],
      ["view_cart", T(to, "btnViewCart")]
    ]);
    return;
  }

  await sendOrderTypeButtons(to);
}

async function sendOrderTypeButtons(to) {
  await sendButtons(to, T(to, "orderTypeBody"), [
    ["ot_dinein", T(to, "btnDineIn")],
    ["ot_takeaway", T(to, "btnTakeaway")],
    ["ot_delivery", T(to, "btnDelivery")]
  ]);
}

function calcBill(session) {
  const subtotal = cartSubtotal(session);

  const packing =
    session.orderType === "DINE-IN" ? 0 : round2((subtotal * PACKING_PERCENT) / 100);

  const delivery =
    session.orderType === "DELIVERY" && session.distanceKm !== null
      ? deliveryChargeFor(session.distanceKm) || 0
      : 0;

  return {
    subtotal,
    packing,
    packingPercent: PACKING_PERCENT,
    delivery,
    total: round2(subtotal + packing + delivery)
  };
}

function billText(to, session, bill) {
  let text = `${T(to, "cartTitle")}\n\n${buildCartLines(session)}`;

  text += "━━━━━━━━━━━━\n";
  text += `${T(to, "billSubtotal")}: ₹${bill.subtotal}\n`;
  if (session.orderType !== "DINE-IN") {
    text += `${T(to, "billPacking", PACKING_PERCENT)}: ₹${bill.packing}\n`;
  }
  if (session.orderType === "DELIVERY") {
    text += `${T(to, "billDelivery", session.distanceKm)}: ₹${bill.delivery}\n`;
  }
  text += `*${T(to, "billTotal")}: ₹${bill.total}*\n`;
  text += "━━━━━━━━━━━━\n\n";
  text += `${T(to, "billType")}: ${session.orderType}\n`;
  if (session.table) text += `${T(to, "billTable")}: ${session.table}\n`;
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

function makeOrderId() {
  // always starts with TR
  return "TR" + Date.now().toString(36).toUpperCase();
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

  const bill = calcBill(session);

  const order = {
    id: makeOrderId(),
    phone: to,
    name: session.name,
    lang: session.lang,
    orderType: session.orderType,
    table: session.table,
    address: session.address,
    distanceKm: session.distanceKm,
    items: JSON.parse(JSON.stringify(session.cart)),
    bill,
    method,
    status: method === "ONLINE" ? "AWAITING_PAYMENT" : "CONFIRMED_CASH",
    createdAt: new Date().toISOString()
  };

  orders[order.id] = order;

  // ---------------- CASH ----------------
  if (method === "CASH") {
    session.cart = [];
    session.orderType = null;

    await sendText(
      to,
      T(to, "cashConfirmed", order.id, bill.total, order.orderType === "DELIVERY")
    );

    await deliverInvoice(order, to, order.lang);
    await notifyOwner(order);
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
    await sendButtons(to, T(to, "payUnavailable"), [
      ["pay_cash", T(to, "btnPayCash")],
      ["view_cart", T(to, "btnViewCart")]
    ]);
    return;
  }

  order.paymentLink = link;
  session.cart = [];
  session.orderType = null;

  await sendText(to, T(to, "payLink", order.id, bill.total, link));
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
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Razorpay API error: ${JSON.stringify(data)}`);
  }

  return data.short_url;
}

// Razorpay Dashboard -> Webhooks: https://<render-url>/razorpay-webhook
// Event: payment_link.paid    Secret = RAZORPAY_WEBHOOK_SECRET
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

    const order = orders[entity.reference_id];

    if (order) {
      if (order.status === "PAID") return; // duplicate event

      order.status = "PAID";
      order.paidAt = new Date().toISOString();
      order.paymentId = req.body.payload?.payment?.entity?.id || null;

      await sendText(order.phone, t(order.lang || "hg", "payReceived", order.id, order.bill.total));
      await deliverInvoice(order, order.phone, order.lang);
      await notifyOwner(order);
    } else {
      // Server restarted and lost in-memory orders: still tell the customer
      const phone = entity.notes?.phone;
      console.error("Paid link for unknown order:", entity.reference_id);
      if (phone) {
        await sendText(
          phone,
          `✅ Payment received for order ${entity.reference_id}. Restaurant will contact you shortly.`
        );
      }
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
  if (!OWNER_PHONE) {
    console.log("OWNER_PHONE not set - order:", JSON.stringify(order));
    return;
  }

  let text = `🔔 NEW ORDER ${order.id}\n`;
  text += `Customer: ${order.name || "-"} (+${order.phone})\n`;
  text += `Type: ${order.orderType}\n`;
  if (order.table) text += `Table: ${order.table}\n`;
  if (order.address) text += `Address: ${order.address} (${order.distanceKm} km)\n`;
  text += "\n";

  order.items.forEach((l, i) => {
    text += `${i + 1}. ${l.name}${optionsText(l)} × ${l.quantity} = ₹${l.price * l.quantity}\n`;
  });

  text += `\nTotal: ₹${order.bill.total}\n`;
  text += `Payment: ${order.status === "PAID" ? "PAID ONLINE" : "CASH"}`;

  try {
    await sendText(OWNER_PHONE, text);
    await deliverInvoice(order, OWNER_PHONE, "en");
  } catch (err) {
    console.error("Owner notification failed:", err.message);
  }
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

async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
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
    body: form
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
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TREAT RESTAURANT bot running on port ${PORT}`);
});
