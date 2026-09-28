const express = require("express");
const crypto = require("crypto");

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
// NOTE: free-form text to the owner only works if the owner messaged the bot
// in the last 24h. For reliable alerts use an approved template message.
const OWNER_PHONE = process.env.OWNER_PHONE;

// ---------------- Razorpay (add keys at the end) ----------------
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// ---------------- Business rules ----------------
const MIN_FOOD_ORDER = 300;          // excludes packing/delivery
const PACKING_PERCENT = 7;           // % of food subtotal (takeaway + delivery)
const BONELESS_CHARGE = 50;          // per plate, main course non-veg
const EXTRA_CHEESE_CHARGE = 30;      // per pizza
const MAX_QTY = 500;

// Restaurant location for delivery distance
const RESTAURANT_LAT = Number(process.env.RESTAURANT_LAT || 0);
const RESTAURANT_LNG = Number(process.env.RESTAURANT_LNG || 0);

// !!! CHANGE THESE km limits to your real tiers. Prices are from your notes,
// km breakpoints are PLACEHOLDERS. Last tier max = delivery limit (10 km).
const DELIVERY_TIERS = [
  { maxKm: 2.5, charge: 30 },
  { maxKm: 5, charge: 50 },
  { maxKm: 7.5, charge: 80 },
  { maxKm: 10, charge: 100 }
];

// ======================================================
// MENU
// ======================================================

const EXTRAS = [
  ["Salad", 50],
  ["Water", 10],
  ["Water Bottle", 20],
  ["Disposable Glass", 5],
  ["Colddrink", 20],
  ["Coke Can", 30],
  ["Can", 50]
];

const MENU = {
  VEG: {
    "MOMOS": [
      ["Veg Steam Momos", 70],
      ["Veg Fried Momos", 80],
      ["Kurkure Veg Momos", 120],
      ["Chilli Veg Momos", 120],
      ["Malai Veg Momos", 140],
      ["Steam Paneer Momos", 100],
      ["Paneer Fried Momos", 110],
      ["Kurkure Paneer Momos", 130],
      ["Chilli Paneer Momos", 140],
      ["Malai Paneer Momos", 160]
    ],
    "NOODLES": [
      ["Veg Noodles", 100],
      ["Veg Hakka Noodles", 120],
      ["Paneer Noodle", 130],
      ["Chilli Garlic Noodles", 140]
    ],
    "CHINESE SNACKS": [
      ["French Fries", 80],
      ["Peri Peri Fries", 100],
      ["Honey Chilli Potato", 150],
      ["Veg Manchurian Dry", 150],
      ["Veg Manchurian Gravy", 170],
      ["Chilly Chaap", 180],
      ["Chilly Mushroom", 200],
      ["Chilly Paneer", 210],
      ["Crispy Corn", 190],
      ["Butterfly Paneer", 220],
      ["Garlic Mushroom", 220],
      ["Paneer 65", 250],
      ["Mushroom Duplex", 250]
    ],
    "TANDOORI SNACKS": [
      ["Tandoori Chaap", 150],
      ["Tandoori Lemon Chaap", 160],
      ["Malai Chaap", 180],
      ["Paneer Tikka", 200],
      ["Paneer Malai Tikka", 220]
    ],
    "MAIN COURSE": [
      ["Dal Fry", 200],
      ["Dal Makhani", 220],
      ["Paneer Butter Masala", 250],
      ["Masala Paneer", 230],
      ["Kadai Paneer", 230],
      ["Paneer Lababdar", 230],
      ["Mushroom Do Pyaza", 240],
      ["Masala Mushroom", 220],
      ["Paneer Bhurji", 220],
      ["Paneer Do Pyaza", 240],
      ["Kadai Chaap", 240],
      ["Tawa Chaap", 240],
      ["Masala Chaap", 230],
      ["Rara Paneer", 300]
    ],
    "RICE": [
      ["Plain Rice", 80],
      ["Jeera Rice", 100],
      ["Veg Fried Rice", 120],
      ["Paneer Fried Rice", 150],
      ["Chilli Garlic Fried Rice", 140],
      ["Veg Biryani", 240]
    ],
    "BURGERS": [
      ["Aloo Tikki Burger", 70],
      ["Veg Cheese Burger", 90],
      ["Paneer Cheese Burger", 120],
      ["Double Decker Burger", 150]
    ],
    "PIZZA": [
      ["Margherita Pizza", 160],
      ["Veg Deluxe Pizza", 200],
      ["Cheese Chilli Pizza", 220],
      ["Farm House Pizza", 250],
      ["Italian Pizza", 270],
      ["Treat Signature Pizza", 300]
    ],
    "PASTA": [
      ["Red Sauce Pasta", 150],
      ["White Sauce Pasta", 170],
      ["Veggie Masala Pasta", 160],
      ["Mexican Pasta", 180]
    ],
    "ROLLS": [
      ["Spring Roll", 90],
      ["Veggie Roll", 110],
      ["Cheese Corn Roll", 130],
      ["Chaap Roll", 140],
      ["Paneer Roll", 150]
    ],
    "SOUPS": [
      ["Veg Clear Soup", 90],
      ["Sweet Corn Soup", 120],
      ["Manchow Soup", 130],
      ["Hot & Sour Soup", 140],
      ["Lemon Coriander Soup", 170]
    ],
    "MOCKTAILS": [
      ["Lime Soda", 80],
      ["Virgin Mojito", 120],
      ["Blue Heaven", 120],
      ["Green Apple", 120],
      ["Black Currant", 120],
      ["Blue Berry", 120]
    ],
    "SHAKES": [
      ["Strawberry Shake", 120],
      ["Blue Berry Shake", 120],
      ["KitKat Shake", 120],
      ["Oreo Chocolate Shake", 140],
      ["Black Current Shake", 120]
    ],
    "COFFEE & DESSERTS": [
      ["Hot Coffee", 50],
      ["Cold Coffee", 120],
      ["Oreo Cold Coffee", 140],
      ["Vanilla Ice Cream", 40],
      ["Butterscotch Ice Cream", 60],
      ["Gulab Jamun (2 Pcs)", 60],
      ["Vanilla & Butterscotch Mix", 70]
    ],
    "EXTRAS": EXTRAS
  },

  "NON-VEG": {
    "MOMOS": [
      ["Chicken Steam Momos", 120],
      ["Chicken Fried Momos", 140],
      ["Chicken Chilli Momos", 160],
      ["Chicken Malai Momos", 180]
    ],
    "CHICKEN SNACKS": [
      ["Crispy Chicken", { half: 260, full: 480 }],
      ["Chilli Chicken", { half: 250, full: 480 }],
      ["Garlic Chicken", { half: 250, full: 480 }],
      ["Lemon Chicken", 380],
      ["Chicken 65 (Boneless)", 380],
      ["Dragon Chicken (Boneless)", 380],
      ["Chicken Lollipop (6 Pcs)", 380]
    ],
    "NOODLES": [
      ["Egg Noodles", 130],
      ["Chicken Noodles", 150],
      ["Schezwan Noodles", 170],
      ["Chicken Hakka Noodles", 180],
      ["Chicken Garlic Noodles", 180]
    ],
    "MAIN COURSE": [
      ["Masala Chicken", { half: 260, full: 480 }],
      ["Kadai Chicken", { half: 260, full: 480 }],
      ["Rara Chicken", { half: 300, full: 500 }],
      ["Butter Chicken", { half: 280, full: 490 }],
      ["Chicken Do Pyaza", { half: 270, full: 480 }],
      ["Chicken Lababdar", { half: 270, full: 480 }]
    ],
    "RICE": [
      ["Plain Rice", 80],
      ["Jeera Rice", 100],
      ["Egg Fried Rice", 130],
      ["Chicken Fried Rice", 150],
      ["Garlic Chicken Fried Rice", 170],
      ["Egg + Chicken Fried Rice", 200],
      ["Matka Chicken Biryani", 420]
    ],
    "SOUPS": [
      ["Egg Soup", 90],
      ["Chicken Manchow Soup", 130],
      ["Chicken Hot & Sour Soup", 120],
      ["Chicken Clear Soup", 140]
    ],
    "BREADS": [
      ["Plain Roti", 15],
      ["Butter Roti", 20],
      ["Garlic Naan", 60],
      ["Lachha Paratha", 70],
      ["Butter Naan", 40]
    ],
    "TANDOORI": [
      ["Tandoori Chicken", { half: 240, full: 450 }],
      ["Tandoori Lemon Chicken", { half: 250, full: 470 }],
      ["Afghani Chicken", { half: 270, full: 480 }],
      ["Chicken Tikka (8 pcs)", 280],
      ["Chicken Seekh Kebab", 220]
    ],
    "ROLLS": [
      ["Egg Roll", 120],
      ["Chicken Roll", 140],
      ["Chicken Chilli Roll", 160]
    ],
    "EXTRAS": EXTRAS
  }
};

// ======================================================
// MENU HELPERS  (type = "VEG" | "NON-VEG" | "BOTH")
// ======================================================

function typeLabel(type) {
  return type === "BOTH" ? "VEG + NON-VEG" : type;
}

function getCategories(type) {
  const set = new Set();
  if (type !== "NON-VEG") Object.keys(MENU.VEG).forEach((c) => set.add(c));
  if (type !== "VEG") Object.keys(MENU["NON-VEG"]).forEach((c) => set.add(c));
  return [...set];
}

// veg: true = veg only, false = non-veg only, null = same item in both menus
function getItems(type, category) {
  const out = [];
  const byName = new Map();

  const add = (menuKey, isVeg) => {
    for (const [name, price] of MENU[menuKey][category] || []) {
      if (byName.has(name)) {
        byName.get(name).veg = null;
        continue;
      }
      const it = { name, price, veg: isVeg, category };
      byName.set(name, it);
      out.push(it);
    }
  };

  if (type !== "NON-VEG") add("VEG", true);
  if (type !== "VEG") add("NON-VEG", false);

  return out;
}

const isHalfFull = (item) => typeof item.price === "object";
const isBonelessEligible = (item) =>
  item.veg === false && item.category === "MAIN COURSE" && isHalfFull(item);
const isPizza = (item) => item.category === "PIZZA";

function marker(item, type) {
  if (type !== "BOTH") return "";
  if (item.veg === true) return "🟢 ";
  if (item.veg === false) return "🔴 ";
  return "";
}

// ======================================================
// SESSIONS / ORDERS  (in memory: lost on restart/sleep)
// ======================================================

const sessions = {};
const orders = {};
const processedMessages = new Set();

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      type: null,
      category: null,
      item: null,
      variant: null,
      boneless: null,
      cheese: null,
      quantity: 1,
      cart: [],
      awaiting: null, // "qty" | "address" | "table" | "location"
      orderType: null, // "DINE-IN" | "TAKEAWAY" | "DELIVERY"
      address: null,
      table: null,
      distanceKm: null,
      name: null
    };
  }
  return sessions[phone];
}

function resetSelection(session) {
  session.item = null;
  session.variant = null;
  session.boneless = null;
  session.cheese = null;
  session.quantity = 1;
  if (session.awaiting === "qty") session.awaiting = null;
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

const round2 = (n) => Math.round(n * 100) / 100;

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

    // Ignore duplicate deliveries
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    if (processedMessages.size > 2000) processedMessages.clear();

    const from = message.from;
    const session = getSession(from);
    const profileName = value.contacts?.[0]?.profile?.name;
    if (profileName) session.name = profileName;

    // ---------------- TEXT ----------------
    if (message.type === "text") {
      await handleText(from, message.text?.body || "");
      return;
    }

    // ---------------- LOCATION ----------------
    if (message.type === "location") {
      await handleLocation(from, message.location);
      return;
    }

    // ---------------- INTERACTIVE ----------------
    if (message.type === "interactive") {
      const id =
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id;

      if (id) await handleAction(from, id);
      return;
    }

    // Anything else (image, sticker...) -> welcome
    await sendWelcomeMessage(from);
  } catch (error) {
    console.error("Webhook error:", error);
  }
});

// ======================================================
// TEXT HANDLER
// ======================================================

async function handleText(from, raw) {
  const session = getSession(from);
  const text = raw.trim();
  const lower = text.toLowerCase();

  // Typed quantity
  const busyWithCheckout = ["address", "table", "location"].includes(session.awaiting);

  if (
    !busyWithCheckout &&
    (session.awaiting === "qty" || (session.item && !pendingStep(session))) &&
    /\d+/.test(text)
  ) {
    const qty = parseInt(text.match(/\d+/)[0], 10);

    if (!qty || qty < 1) {
      await sendText(from, "Quantity 1 ya usse zyada honi chahiye. Number type karo (e.g. 5).");
      return;
    }
    if (qty > MAX_QTY) {
      await sendText(from, `Max ${MAX_QTY} allowed hai. Bulk order ke liye restaurant ko directly call karo.`);
      return;
    }

    session.quantity = qty;
    session.awaiting = null;
    await sendQuantityScreen(from);
    return;
  }

  if (session.awaiting === "qty") {
    await sendText(from, "Sirf number type karo, e.g. 3 ya 10.");
    return;
  }

  // Delivery address
  if (session.awaiting === "address") {
    if (text.length < 10) {
      await sendText(from, "Address thoda detail mein likho (house no., area, landmark).");
      return;
    }
    session.address = text;
    session.awaiting = "location";
    await sendText(
      from,
      "📍 Ab apni *location pin* bhejo taaki delivery charge calculate ho sake.\n\n" +
        "Attach (📎) → Location → Send your current location."
    );
    return;
  }

  // Dine-in table
  if (session.awaiting === "table") {
    session.table = text.substring(0, 30);
    session.awaiting = null;
    await sendBill(from);
    return;
  }

  if (session.awaiting === "location") {
    await sendText(from, "Please location pin bhejo (📎 → Location). Uske bina delivery charge nahi ban sakta.");
    return;
  }

  if (["hi", "hello", "hey", "start", "hii", "menu"].includes(lower)) {
    resetSelection(session);
    session.type = null;
    session.category = null;
    await sendWelcomeMessage(from);
    return;
  }

  if (lower === "cart") {
    await sendCart(from);
    return;
  }

  // Fallback: don't stay silent
  await sendWelcomeMessage(from);
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

  if (session.awaiting !== "location") {
    await sendWelcomeMessage(from);
    return;
  }

  if (!RESTAURANT_LAT || !RESTAURANT_LNG) {
    console.error("RESTAURANT_LAT / RESTAURANT_LNG env vars are not set");
    await sendText(from, "Delivery abhi configure nahi hai. Takeaway / dine-in choose karo.");
    session.awaiting = null;
    await sendOrderTypeButtons(from);
    return;
  }

  // Straight-line distance, NOT road distance
  const km = haversineKm(RESTAURANT_LAT, RESTAURANT_LNG, loc.latitude, loc.longitude);
  session.distanceKm = round2(km);

  if (deliveryChargeFor(km) === null) {
    session.awaiting = null;
    session.distanceKm = null;
    await sendText(
      from,
      `😔 Aap ${session.distanceKm ?? km.toFixed(1)} km door ho. Hum sirf ${
        DELIVERY_TIERS[DELIVERY_TIERS.length - 1].maxKm
      } km tak deliver karte hain. Takeaway / dine-in choose kar sakte ho.`
    );
    await sendOrderTypeButtons(from);
    return;
  }

  session.awaiting = null;
  await sendBill(from);
}

// ======================================================
// ACTION HANDLER (buttons + lists share one router)
// ======================================================

async function handleAction(to, id) {
  const session = getSession(to);

  // ---------- TYPE ----------
  if (id === "veg" || id === "non_veg" || id === "both") {
    session.type = id === "veg" ? "VEG" : id === "non_veg" ? "NON-VEG" : "BOTH";
    session.category = null;
    resetSelection(session);
    await sendCategoryList(to, 0);
    return;
  }

  // ---------- NAVIGATION ----------
  if (id === "nav:back_main" || id === "back_main") {
    session.type = null;
    session.category = null;
    resetSelection(session);
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

    resetSelection(session);
    session.item = item;
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
    await sendText(
      to,
      "✍️ Kitne chahiye? Number type karke bhejo (e.g. 4, 10, 25).\n\n" +
        `Max ${MAX_QTY}.`
    );
    return;
  }

  if (id === "add_cart") {
    if (!session.item || pendingStep(session)) return sendCart(to);
    addCurrentItemToCart(session);
    await sendCart(to);
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
    await sendText(to, "🪑 Apna *table number* type karke bhejo.");
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
    await sendText(to, "🏠 Apna *poora delivery address* type karke bhejo (house no., area, landmark).");
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
// WELCOME
// ======================================================

async function sendWelcomeMessage(to) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "Hey! Welcome to TREAT RESTAURANT 🍽️\n\n" +
          "What would you like to order?"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "veg", title: "VEG" } },
          { type: "reply", reply: { id: "non_veg", title: "NON-VEG" } },
          { type: "reply", reply: { id: "both", title: "VEG + NON-VEG" } }
        ]
      }
    }
  });
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
      title: "⬅ PREVIOUS",
      description: `Go back (page ${page} of ${totalPages})`
    });
  }

  if (start + PAGE_SIZE < entries.length) {
    rows.push({
      id: `${pagePrefix}:${page + 1}`,
      title: "➡ MORE",
      description: `See more (page ${page + 2} of ${totalPages})`
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
      body: { text: totalPages > 1 ? `${body}\n\nPage ${page + 1}/${totalPages}` : body },
      action: {
        button,
        sections: [{ title: sectionTitle.substring(0, 24), rows }]
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
    title: category.substring(0, 24),
    description: `View ${category}`.substring(0, 72)
  }));

  await sendPagedList(to, {
    body: `🍽️ ${label} MENU\n\nChoose a category:` +
      (session.type === "BOTH" ? "\n🟢 veg  🔴 non-veg" : ""),
    button: "VIEW CATEGORIES",
    sectionTitle: `${label} CATEGORIES`,
    entries,
    page,
    pagePrefix: "catpage",
    extraNavRow: {
      id: "nav:back_main",
      title: "🔙 VEG/NON-VEG",
      description: "Change VEG / NON-VEG / BOTH"
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
    const description = isHalfFull(item)
      ? `Half ₹${item.price.half} | Full ₹${item.price.full}`
      : `₹${item.price}`;

    return {
      id: `item:${index}`,
      title: (marker(item, session.type) + item.name).substring(0, 24),
      description: description.substring(0, 72)
    };
  });

  await sendPagedList(to, {
    body: `🍽️ ${session.category}\n\nSelect an item:` +
      (session.type === "BOTH" ? "\n🟢 veg  🔴 non-veg" : ""),
    button: "VIEW FOOD",
    sectionTitle: session.category,
    entries,
    page,
    pagePrefix: "itempage",
    extraNavRow: {
      id: "nav:back_categories",
      title: "🔙 CATEGORIES",
      description: "Back to categories"
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
  return sendQuantityScreen(to);
}

async function sendButtons(to, text, buttons) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: buttons.map(([id, title]) => ({
          type: "reply",
          reply: { id, title: title.substring(0, 20) }
        }))
      }
    }
  });
}

async function sendVariantButtons(to) {
  const item = getSession(to).item;

  await sendButtons(to, `🍽️ ${item.name}\n\nChoose plate size:`, [
    ["variant_half", `HALF ₹${item.price.half}`],
    ["variant_full", `FULL ₹${item.price.full}`]
  ]);
}

async function sendBonelessButtons(to) {
  const item = getSession(to).item;

  await sendButtons(
    to,
    `🍗 ${item.name}\n\nBone-in ya Boneless?\nBoneless = +₹${BONELESS_CHARGE} per plate`,
    [
      ["bone_no", "WITH BONE"],
      ["bone_yes", `BONELESS +₹${BONELESS_CHARGE}`]
    ]
  );
}

async function sendCheeseButtons(to) {
  const item = getSession(to).item;

  await sendButtons(
    to,
    `🍕 ${item.name}\n\nExtra cheese chahiye?\nExtra cheese = +₹${EXTRA_CHEESE_CHARGE} per pizza`,
    [
      ["cheese_no", "NO EXTRA CHEESE"],
      ["cheese_yes", `EXTRA CHEESE +₹${EXTRA_CHEESE_CHARGE}`]
    ]
  );
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

  await sendButtons(
    to,
    `🍽️ ${item.name}${opts}\n\n` +
      `Price: ₹${price}\n` +
      `Quantity: ${session.quantity}\n` +
      `Item Total: ₹${total}\n\n` +
      `Zyada chahiye? ✍️ TYPE QTY dabao aur number likho.`,
    [
      ["qty_minus", "➖"],
      ["qty_plus", "➕"],
      ["qty_type", "✍️ TYPE QTY"]
    ]
  );

  await sendButtons(to, "Quantity final hai?", [
    ["add_cart", "✅ ADD TO CART"],
    ["back_items", "🔙 BACK"]
  ]);
}

// ======================================================
// CART
// ======================================================

function addCurrentItemToCart(session) {
  const item = session.item;

  const line = {
    name: item.name,
    variant: isHalfFull(item) ? session.variant : null,
    boneless: !!session.boneless,
    cheese: !!session.cheese,
    price: unitPrice(item, session.variant, session.boneless, session.cheese),
    quantity: session.quantity
  };

  // Merge identical lines
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
}

function cartSubtotal(session) {
  return session.cart.reduce((sum, l) => sum + l.price * l.quantity, 0);
}

function buildCartText(session) {
  let text = "🛒 YOUR CART\n\n";

  session.cart.forEach((line, index) => {
    text +=
      `${index + 1}. ${line.name}${optionsText(line)}\n` +
      `   ₹${line.price} × ${line.quantity} = ₹${line.price * line.quantity}\n\n`;
  });

  text += `Subtotal: ₹${cartSubtotal(session)}`;
  return text;
}

async function sendCart(to) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendButtons(to, "🛒 Your cart is empty.\n\nWould you like to view the menu?", [
      ["add_more", "VIEW MENU"],
      ["back_main", "BACK"]
    ]);
    return;
  }

  let body = buildCartText(session);

  // Button message body limit is 1024 chars -> send long carts as plain text first
  if (body.length > 900) {
    await sendText(to, body);
    body = `Subtotal: ₹${cartSubtotal(session)}\n\nWhat next?`;
  }

  await sendButtons(to, body, [
    ["add_more", "ADD MORE"],
    ["remove_mode", "REMOVE"],
    ["checkout", "CHECKOUT"]
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
    title: `${index + 1}. ${line.name}`.substring(0, 24),
    description:
      `${optionsText(line).trim()} × ${line.quantity} — ₹${line.price * line.quantity}`.trim().substring(0, 72)
  }));

  await sendPagedList(to, {
    body: "🗑️ REMOVE ITEM\n\nSelect the item you want to remove:",
    button: "REMOVE ITEM",
    sectionTitle: "YOUR CART",
    entries,
    page,
    pagePrefix: "rempage",
    extraNavRow: {
      id: "empty_cart",
      title: "🗑 CLEAR CART",
      description: "Remove everything"
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
    await sendButtons(
      to,
      `⚠️ Minimum food order ₹${MIN_FOOD_ORDER} hai.\n` +
        `Aapka subtotal ₹${subtotal} hai. ₹${MIN_FOOD_ORDER - subtotal} ka aur order add karo.`,
      [
        ["add_more", "ADD MORE"],
        ["view_cart", "VIEW CART"]
      ]
    );
    return;
  }

  await sendOrderTypeButtons(to);
}

async function sendOrderTypeButtons(to) {
  await sendButtons(to, "How would you like to receive your order?", [
    ["ot_dinein", "🪑 DINE-IN"],
    ["ot_takeaway", "🥡 TAKEAWAY"],
    ["ot_delivery", "🛵 DELIVERY"]
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

  const total = round2(subtotal + packing + delivery);

  return { subtotal, packing, delivery, total };
}

function billText(session, bill) {
  let text = buildCartText(session).replace(/\n\nSubtotal: ₹\d+$/, "") + "\n\n";

  text += "━━━━━━━━━━━━\n";
  text += `Subtotal: ₹${bill.subtotal}\n`;
  if (session.orderType !== "DINE-IN") {
    text += `Packing (${PACKING_PERCENT}%): ₹${bill.packing}\n`;
  }
  if (session.orderType === "DELIVERY") {
    text += `Delivery (${session.distanceKm} km): ₹${bill.delivery}\n`;
  }
  text += `*TOTAL: ₹${bill.total}*\n`;
  text += "━━━━━━━━━━━━\n\n";
  text += `Order type: ${session.orderType}\n`;
  if (session.table) text += `Table: ${session.table}\n`;
  if (session.address) text += `Address: ${session.address}\n`;

  return text;
}

async function sendBill(to) {
  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendCart(to);
    return;
  }

  const bill = calcBill(session);
  await sendText(to, billText(session, bill));

  await sendButtons(to, "Payment method choose karo:", [
    ["pay_online", "💳 PAY ONLINE"],
    ["pay_cash", session.orderType === "DELIVERY" ? "💵 CASH ON DELIVERY" : "💵 PAY AT COUNTER"],
    ["view_cart", "✏️ EDIT CART"]
  ]);
}

// ======================================================
// PLACE ORDER
// ======================================================

function makeOrderId() {
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

  if (method === "CASH") {
    session.cart = [];
    session.orderType = null;

    await sendText(
      to,
      `✅ Order confirmed!\n\nOrder ID: *${order.id}*\nTotal: ₹${bill.total}\n` +
        `Payment: ${order.orderType === "DELIVERY" ? "Cash on delivery" : "Pay at counter"}\n\n` +
        "Thank you for ordering from TREAT RESTAURANT 🙏"
    );
    await notifyOwner(order);
    return;
  }

  // ONLINE
  let link = null;
  try {
    link = await createRazorpayPaymentLink(order);
  } catch (err) {
    console.error("Razorpay link error:", err.message);
  }

  if (!link) {
    order.status = "PAYMENT_LINK_FAILED";
    await sendButtons(
      to,
      "😔 Online payment abhi available nahi hai. Cash se order karna chahoge?",
      [
        ["pay_cash", "💵 PAY CASH"],
        ["view_cart", "VIEW CART"]
      ]
    );
    // Order was registered as online; drop it so it can be re-placed as cash
    delete orders[order.id];
    return;
  }

  order.paymentLink = link;
  session.cart = [];
  session.orderType = null;

  await sendText(
    to,
    `💳 Order ID: *${order.id}*\nAmount: *₹${bill.total}*\n\n` +
      `Pay karne ke liye link kholo:\n${link}\n\n` +
      "Payment hone par yahin confirmation mil jayega. Link 30 minute mein expire hoga."
  );
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

// Razorpay -> Dashboard -> Webhooks: URL = https://<your-render-url>/razorpay-webhook
// Event: payment_link.paid   Secret = RAZORPAY_WEBHOOK_SECRET
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

    // Verified. Acknowledge first.
    res.sendStatus(200);

    if (req.body.event !== "payment_link.paid") return;

    const entity = req.body.payload?.payment_link?.entity;
    if (!entity) return;

    const order = orders[entity.reference_id];

    if (order) {
      if (order.status === "PAID") return; // duplicate event
      order.status = "PAID";
      order.paidAt = new Date().toISOString();

      await sendText(
        order.phone,
        `✅ Payment received!\n\nOrder ID: *${order.id}*\nAmount: ₹${order.bill.total}\n\n` +
          "Aapka order confirm ho gaya hai. Thank you 🙏"
      );
      await notifyOwner(order);
    } else {
      // Server restarted and lost in-memory orders: still tell the customer
      const phone = entity.notes?.phone;
      console.error("Paid link for unknown order:", entity.reference_id);
      if (phone) {
        await sendText(
          phone,
          `✅ Payment received for order ${entity.reference_id}. Restaurant aapse contact karega.`
        );
      }
    }
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    if (!res.headersSent) res.sendStatus(500);
  }
});

// ======================================================
// OWNER NOTIFICATION
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

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TREAT RESTAURANT bot running on port ${PORT}`);
});
