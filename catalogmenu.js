// ======================================================
// CATALOG MENU  (WhatsApp's own product view: + / - quantity, "View cart", "Place order")
//
//   1. node catalogmenu.js        -> writes catalog.csv   (upload it in Meta Commerce Manager -> Catalog -> Items -> Data feed)
//   2. connect that catalog to your WhatsApp number, then put its id in Render env:  WHATSAPP_CATALOG_ID=xxxx
//
// Customer taps a category -> bot sends ONE multi-product message for that category -> customer opens it,
// sets quantities with + / -, taps View cart -> Place order -> Meta sends the bot an "order" message.
// The bot maps product ids back to menu.js (prices always come from menu.js, never from the customer's message)
// and then asks the options in chat: Half / Full, Bone / Boneless, Extra cheese.
// If WHATSAPP_CATALOG_ID is not set nothing changes.
// ======================================================
const fs = require("fs");
const path = require("path");
const { getCategories, getItems, isHalfFull, isBonelessEligible, isPizza } = require("./menu");

const BONELESS_FEE = Number(process.env.BONELESS_CHARGE || 50);
const MAX_PER_MESSAGE = 30; // WhatsApp: max 30 products in one multi-product message
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));
const slug = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// every dish once, with a stable product id (does not change when menu.js is re-ordered)
function allDishes() {
  const out = [];
  const seen = new Set();
  for (const category of getCategories("BOTH")) {
    for (const item of getItems("BOTH", category)) {
      let id = cut(`${slug(category)}-${slug(item.name)}`, 100);
      if (seen.has(id)) id = `${id}-${out.length}`;
      seen.add(id);
      out.push({ id, item, category });
    }
  }
  return out;
}

const basePrice = (item) => (isHalfFull(item) ? item.price.half : item.price); // catalog needs ONE price: Half price for Half/Full dishes

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCatalogCsv() {
  const SITE = process.env.CATALOG_LINK || "https://example.com/menu"; // product page link (required by Meta)
  const IMG = (process.env.CATALOG_IMAGE_BASE || "https://example.com/images").replace(/\/+$/, ""); // <base>/<id>.jpg
  const rows = [["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "product_type"]];
  for (const { id, item, category } of allDishes()) {
    const mark = item.veg === true ? "Veg" : item.veg === false ? "Non-Veg" : "Veg / Non-Veg";
    let desc = `${mark}. ${item.desc ? item.desc + ". " : ""}`;
    if (isHalfFull(item)) desc += `Half ₹${item.price.half} / Full ₹${item.price.full} - choose Half or Full after the cart. `;
    if (isBonelessEligible(item)) desc += `Boneless +₹${BONELESS_FEE} option after the cart. `;
    if (isPizza(item)) desc += "Extra cheese option after the cart. ";
    rows.push([
      id,
      isHalfFull(item) ? `${item.name} (Half/Full)` : item.name,
      desc.trim(),
      "in stock",
      "new",
      `${basePrice(item).toFixed(2)} INR`,
      SITE,
      `${IMG}/${id}.jpg`,
      "TREAT",
      category
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

module.exports = function createCatalogMenu(deps) {
  const { getSession, sendWhatsAppMessage, processQueue, MAX_QTY = 500 } = deps;
  const CATALOG_ID = process.env.WHATSAPP_CATALOG_ID || "";
  const enabled = !!CATALOG_ID;
  const dishes = enabled ? allDishes() : [];
  const byId = new Map(dishes.map((d) => [d.id, d]));

  // one multi-product message holding the dishes of one category (sections: Veg / Non-Veg)
  async function sendCategory(to, category) {
    const list = dishes.filter((d) => d.category === category);
    if (!list.length) return false;
    if (list.length > MAX_PER_MESSAGE) console.warn(`Category ${category} has ${list.length} dishes - only the first ${MAX_PER_MESSAGE} fit in one message`);
    const groups = [
      ["🟢 Veg", (d) => d.item.veg === true],
      ["🔴 Non-Veg", (d) => d.item.veg === false],
      ["🍽️ Veg & Non-Veg", (d) => d.item.veg !== true && d.item.veg !== false]
    ];
    let left = MAX_PER_MESSAGE;
    const sections = [];
    for (const [title, keep] of groups) {
      const picked = list.filter(keep).slice(0, left);
      if (!picked.length) continue;
      left -= picked.length;
      sections.push({ title: cut(title, 24), product_items: picked.map((d) => ({ product_retailer_id: d.id })) });
    }
    await sendWhatsAppMessage(to, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: { type: "text", text: cut(category, 60) },
        body: { text: "Tap *View items*, set quantity with + / − and open your cart 🛒" },
        footer: { text: "Half/Full, bone/boneless & cheese: next step" },
        action: { catalog_id: CATALOG_ID, sections }
      }
    });
    return true;
  }

  // customer pressed "Place order" in the native cart -> put the lines in the bot's cart
  // returns true (added) | false (nothing recognised)
  async function handleOrder(from, order) {
    const session = getSession(from);
    const lines = Array.isArray(order?.product_items) ? order.product_items : [];
    let added = 0;
    for (const line of lines.slice(0, 40)) {
      const dish = byId.get(String(line.product_retailer_id || ""));
      if (!dish) {
        console.warn("Unknown catalog product id:", line.product_retailer_id);
        continue;
      }
      const qty = Math.max(1, Math.min(MAX_QTY, parseInt(line.quantity, 10) || 1));
      // variant / boneless / cheese stay null -> the normal chat steps ask them (only for dishes that need them)
      session.queue.push({ kind: "item", item: dish.item, qty, variant: null, boneless: null, cheese: null });
      added++;
    }
    if (!added) return false;
    await processQueue(from);
    return true;
  }

  return { enabled, sendCategory, handleOrder };
};

module.exports.buildCatalogCsv = buildCatalogCsv;
module.exports.allDishes = allDishes;

if (require.main === module) {
  const out = path.join(__dirname, "catalog.csv");
  fs.writeFileSync(out, buildCatalogCsv());
  console.log("written", out, "-", allDishes().length, "products");
  console.log("Edit CATALOG_IMAGE_BASE / CATALOG_LINK env vars before running (image_link and link are required by Meta).");
}
