// ======================================================
// WEB MENU  (opens inside WhatsApp's in-app browser, like the payment link)
//
// Flow:  order type chosen -> bot sends a "MENU KHOLO" button (cta_url)
//        -> customer browses categories, taps + / - for quantity
//        -> "SEND ORDER TO WHATSAPP" -> items land in the SAME session.cart
//        -> bot shows the normal cart (Add more / Remove / Checkout)
//
// Everything after the cart (bill, address, payment, invoice, Telegram) is unchanged.
//
// Security: the link carries an HMAC-signed token (phone + expiry). The server
// NEVER trusts prices from the browser - it only accepts item name / options / qty
// and looks the price up in menu.js again.
// ======================================================

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  getCategories,
  getItems,
  isHalfFull,
  isBonelessEligible,
  isPizza
} = require("./menu");

const TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // link valid for 3 hours

// ---- texts shown in the WhatsApp chat + inside the web page -------------
const STR = {
  linkBody: {
    en: "🍽️ Open our menu, pick your items with ➕ / ➖ and send the order back here.",
    hi: "🍽️ हमारा मेनू खोलें, ➕ / ➖ से आइटम चुनें और ऑर्डर यहीं भेज दें।",
    hg: "🍽️ Menu kholo, ➕ / ➖ se items chuno aur order yahin bhej do."
  },
  linkBtn: { en: "🍽️ OPEN MENU", hi: "🍽️ मेनू खोलें", hg: "🍽️ MENU KHOLO" },
  orWrite: {
    en: "✍️ Or just type your order here, e.g.\n2 veg steam momos, 1 dal makhani",
    hi: "✍️ या यहीं लिखकर ऑर्डर दें, जैसे\n2 veg steam momos, 1 dal makhani",
    hg: "✍️ Ya seedha yahin likh do, jaise\n2 veg steam momos, 1 dal makhani"
  },
  added: {
    en: (n) => `✅ ${n} item(s) added from the menu.`,
    hi: (n) => `✅ मेनू से ${n} आइटम जुड़ गए।`,
    hg: (n) => `✅ Menu se ${n} item add ho gaye.`
  },
  // ---- web page strings ----
  ui: {
    en: {
      search: "Search dish…", all: "All", veg: "Veg", nonveg: "Non-Veg", add: "ADD",
      viewCart: "VIEW CART", items: "items", cart: "Your order", empty: "Nothing added yet",
      send: "SEND ORDER TO WHATSAPP", sending: "Sending…", addToCart: "Add", half: "Half",
      full: "Full", bone: "With bone", boneless: "Boneless", cheese: "Extra cheese",
      noCheese: "No extra cheese", size: "Size", subtotal: "Subtotal", already: "Already in your WhatsApp cart",
      note: "Packing / delivery charges are added in the final bill on WhatsApp.",
      minOrder: (m) => `Minimum food order for delivery is ₹${m}.`,
      doneTitle: "Order sent to WhatsApp ✅", doneText: "Go back to the WhatsApp chat to review your cart and checkout.",
      closeBtn: "Back to WhatsApp", noResult: "No dish found", expired: "This menu link has expired.",
      expiredText: "Please go back to WhatsApp and tap MENU again.", closed: "Restaurant is closed right now.",
      noType: "Please choose Delivery / Takeaway / Dine-in in the chat first.", error: "Something went wrong. Please try again.",
      remove: "Remove"
    },
    hi: {
      search: "डिश खोजें…", all: "सब", veg: "वेज", nonveg: "नॉन-वेज", add: "जोड़ें",
      viewCart: "कार्ट देखें", items: "आइटम", cart: "आपका ऑर्डर", empty: "अभी कुछ नहीं जोड़ा",
      send: "ऑर्डर WHATSAPP पर भेजें", sending: "भेज रहे हैं…", addToCart: "जोड़ें", half: "हाफ",
      full: "फुल", bone: "हड्डी के साथ", boneless: "बोनलेस", cheese: "एक्स्ट्रा चीज़",
      noCheese: "बिना एक्स्ट्रा चीज़", size: "साइज़", subtotal: "सबटोटल", already: "WhatsApp कार्ट में पहले से",
      note: "पैकिंग / डिलीवरी चार्ज WhatsApp पर फाइनल बिल में जुड़ेंगे।",
      minOrder: (m) => `डिलीवरी के लिए न्यूनतम फ़ूड ऑर्डर ₹${m} है।`,
      doneTitle: "ऑर्डर WhatsApp पर भेज दिया ✅", doneText: "कार्ट देखने और चेकआउट के लिए WhatsApp चैट पर वापस जाएँ।",
      closeBtn: "WhatsApp पर वापस", noResult: "कोई डिश नहीं मिली", expired: "यह मेनू लिंक एक्सपायर हो गया है।",
      expiredText: "कृपया WhatsApp पर वापस जाकर फिर से MENU दबाएँ।", closed: "रेस्टोरेंट अभी बंद है।",
      noType: "पहले चैट में Delivery / Takeaway / Dine-in चुनें।", error: "कुछ गड़बड़ हो गई। फिर से कोशिश करें।",
      remove: "हटाएँ"
    },
    hg: {
      search: "Dish dhundo…", all: "Sab", veg: "Veg", nonveg: "Non-Veg", add: "ADD",
      viewCart: "CART DEKHO", items: "items", cart: "Aapka order", empty: "Abhi kuch add nahi kiya",
      send: "ORDER WHATSAPP PE BHEJO", sending: "Bhej rahe hain…", addToCart: "Add karo", half: "Half",
      full: "Full", bone: "Bone ke saath", boneless: "Boneless", cheese: "Extra cheese",
      noCheese: "Extra cheese nahi", size: "Size", subtotal: "Subtotal", already: "WhatsApp cart mein pehle se",
      note: "Packing / delivery charge WhatsApp ke final bill mein judenge.",
      minOrder: (m) => `Delivery ke liye minimum food order ₹${m} hai.`,
      doneTitle: "Order WhatsApp pe bhej diya ✅", doneText: "Cart dekhne aur checkout ke liye WhatsApp chat pe wapas jao.",
      closeBtn: "WhatsApp pe wapas", noResult: "Koi dish nahi mili", expired: "Ye menu link expire ho gaya hai.",
      expiredText: "WhatsApp pe wapas jaake dobara MENU dabao.", closed: "Restaurant abhi band hai.",
      noType: "Pehle chat mein Delivery / Takeaway / Dine-in choose karo.", error: "Kuch gadbad ho gayi. Dobara try karo.",
      remove: "Hatao"
    }
  }
};

function tx(lang, key, ...args) {
  const e = STR[key];
  const v = e[lang] !== undefined ? e[lang] : e.en;
  return typeof v === "function" ? v(...args) : v;
}

// ---- factory ---------------------------------------------------------------
module.exports = function createWebMenu(deps) {
  const {
    app, getSession, hydrateSession, persistSession, withPhoneLock,
    startTypedItem, addCurrentItemToCart, resetSelection, clearTyped,
    sendCart, sendText, sendCtaUrlButton, isOpenNow,
    MAX_QTY, MAX_CART_LINES, MIN_FOOD_ORDER, BONELESS_CHARGE, EXTRA_CHEESE_CHARGE
  } = deps;

  const BASE = String(process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
  const SECRET = process.env.WEB_MENU_SECRET || process.env.WHATSAPP_APP_SECRET || "";
  const enabled = /^https:\/\//.test(BASE) && !!SECRET;

  if (!enabled) {
    console.warn("Web menu DISABLED (needs PUBLIC_BASE_URL or RENDER_EXTERNAL_URL (https) + WEB_MENU_SECRET/WHATSAPP_APP_SECRET) - old chat menu is used");
  }

  const PAGE_PATH = path.join(__dirname, "webmenu.html");
  const PAGE_HTML = fs.existsSync(PAGE_PATH) ? fs.readFileSync(PAGE_PATH, "utf8") : null;

  // ---------- signed token ----------
  const b64 = (s) => Buffer.from(s).toString("base64url");
  const sign = (payload) => crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");

  // compact token (~28 chars) so the link shown in WhatsApp's in-app browser stays short
  function makeToken(phone) {
    const payload = `${Number(phone).toString(36)}-${Math.floor((Date.now() + TOKEN_TTL_MS) / 60000).toString(36)}`;
    return `${payload}.${sign(payload).slice(0, 16)}`;
  }

  // returns the phone number, or null when invalid / expired
  function readToken(token) {
    if (!enabled) return null;
    const [payload, sig, extra] = String(token || "").split(".");
    if (!payload || !sig || extra !== undefined) return null;
    const want = Buffer.from(sign(payload).slice(0, 16));
    const got = Buffer.from(sig);
    if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
    const [p36, e36] = payload.split("-");
    const phone = String(parseInt(p36, 36));
    const exp = parseInt(e36, 36) * 60000;
    if (!/^\d{6,15}$/.test(phone) || !(exp > Date.now())) return null;
    return phone;
  }

  const linkFor = (phone) => `${BASE}/m/${makeToken(phone)}`;

  // ---------- chat side ----------
  async function sendLink(to) {
    const lang = getSession(to).lang || "hg";
    await sendCtaUrlButton(to, tx(lang, "linkBody"), tx(lang, "linkBtn"), linkFor(to));
  }

  const hintText = (to) => tx(getSession(to).lang || "hg", "orWrite");

  // ---------- menu JSON (prices are menu prices, same as chat) ----------
  function buildMenu() {
    return getCategories("BOTH").map((category) => ({
      name: category,
      items: getItems("BOTH", category).map((it) => ({
        n: it.name,
        d: it.desc || "",
        v: it.veg, // true = veg, false = non-veg, null = both
        ...(isHalfFull(it) ? { h: it.price.half, f: it.price.full } : { p: it.price }),
        ...(isBonelessEligible(it) ? { bone: 1 } : {}),
        ...(isPizza(it) ? { cheese: 1 } : {})
      }))
    }));
  }
  const MENU_JSON = buildMenu(); // menu is static -> build once

  const noStore = (res) => res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });

  // ---------- routes ----------
  function register() {
    // the page itself (static HTML, token is read by its JS from the URL)
    app.get("/m/:token", (req, res) => {
      noStore(res);
      if (!enabled || !PAGE_HTML) return res.status(404).send("Menu not available");
      res.type("html").send(PAGE_HTML);
    });

    app.get("/m/:token/data", async (req, res) => {
      noStore(res);
      const phone = readToken(req.params.token);
      if (!phone) return res.status(401).json({ error: "expired" });

      try {
        await hydrateSession(phone);
      } catch (err) {
        console.error("webmenu data hydrate:", err.message);
      }
      const s = getSession(phone);
      const lang = ["en", "hi", "hg"].includes(s.lang) ? s.lang : "hg";

      res.json({
        lang,
        ui: STR.ui[lang],
        orderType: s.orderType || null,
        minOrder: s.orderType === "DELIVERY" ? MIN_FOOD_ORDER : 0,
        boneCharge: BONELESS_CHARGE,
        cheeseCharge: EXTRA_CHEESE_CHARGE,
        maxQty: MAX_QTY,
        existing: s.cart.map((l) => ({
          name: l.name,
          opts: [l.variant, l.boneless ? "Boneless" : null, l.cheese ? "Extra Cheese" : null].filter(Boolean).join(", "),
          qty: l.quantity,
          total: l.price * l.quantity
        })),
        menu: MENU_JSON
      });
    });

    const usedNonces = new Map(); // nonce -> time, stops double-tap / retry duplicates
    setInterval(() => {
      const now = Date.now();
      for (const [k, ts] of usedNonces) if (now - ts > TOKEN_TTL_MS) usedNonces.delete(k);
    }, 10 * 60 * 1000).unref();

    app.post("/m/:token/submit", async (req, res) => {
      noStore(res);
      const phone = readToken(req.params.token);
      if (!phone) return res.status(401).json({ error: "expired" });

      const body = req.body || {};
      const nonce = String(body.nonce || "");
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) return res.status(400).json({ error: "bad_request" });
      if (usedNonces.has(`${phone}:${nonce}`)) return res.json({ ok: true, duplicate: true });

      if (!isOpenNow()) return res.status(409).json({ error: "closed" });

      // ---- validate every line against the real menu (never trust browser prices) ----
      const rawLines = Array.isArray(body.lines) ? body.lines.slice(0, MAX_CART_LINES) : [];
      const clean = [];
      for (const l of rawLines) {
        const category = String(l?.c ?? "");
        const name = String(l?.n ?? "");
        const item = getItems("BOTH", category).find((i) => i.name === name);
        const qty = Math.floor(Number(l?.q));
        if (!item || !Number.isFinite(qty) || qty < 1) continue;

        let variant = null;
        if (isHalfFull(item)) {
          variant = l.v === "HALF" || l.v === "FULL" ? l.v : null;
          if (!variant) continue;
        }
        clean.push({
          item,
          qty: Math.min(qty, MAX_QTY),
          variant,
          boneless: isBonelessEligible(item) ? !!l.b : null,
          cheese: isPizza(item) ? !!l.ch : null
        });
      }
      if (!clean.length) return res.status(400).json({ error: "empty" });

      try {
        let result;
        await withPhoneLock(phone, async () => {
          await hydrateSession(phone);
          const s = getSession(phone);
          if (!s.orderType) {
            result = { status: 409, body: { error: "no_order_type" } };
            return;
          }

          // a half-finished chat selection must not leak into these lines
          resetSelection(s);
          clearTyped(s);

          for (const c of clean) {
            startTypedItem(s, c.item, { qty: c.qty, variant: c.variant, boneless: c.boneless, cheese: c.cheese });
            addCurrentItemToCart(s);
          }
          usedNonces.set(`${phone}:${nonce}`, Date.now());
          await persistSession(phone);
          result = { status: 200, body: { ok: true, count: clean.length } };

          // customer-facing chat messages are best effort - the cart is already saved
          try {
            const lang = s.lang || "hg";
            await sendText(phone, tx(lang, "added", clean.length));
            await sendCart(phone);
          } catch (err) {
            console.error("webmenu chat reply failed:", err.message);
          }
        });
        return res.status(result.status).json(result.body);
      } catch (err) {
        console.error("webmenu submit error:", err);
        return res.status(500).json({ error: "server" });
      }
    });
  }

  return { enabled, register, sendLink, hintText };
};
