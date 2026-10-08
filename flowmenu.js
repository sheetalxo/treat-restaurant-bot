// ======================================================
// FLOW MENU  (menu opens INSIDE the WhatsApp chat as a native screen - no website, no link)
//
// Uses a WhatsApp Flow (static - needs no encryption endpoint).
//   1. node flowmenu.js         -> writes flow.json  (upload it in Meta Flow Builder)
//   2. publish the flow, copy its Flow ID into Render env:  WHATSAPP_FLOW_ID=xxxx
// If WHATSAPP_FLOW_ID is not set, the old web menu / chat menu keeps working.
//
// Customer picks dishes (qty 1 each) -> Flow returns the picks -> bot puts them in the
// normal chat ordering steps (Half/Full, boneless, cheese, qty) exactly like typed items.
// ======================================================
const fs = require("fs");
const path = require("path");
const { getCategories, getItems, isHalfFull } = require("./menu");


// ---- optional section banners (used by the 5-section layout, flow_grouped.json) ------------------
// Put images in ./flow-images/ named momos.jpg, noodles.jpg, maincourse.jpg, burger.jpg, drinks.jpg
// (square ~400x400 JPEG/PNG, each well under 300KB). Missing files are simply skipped.
// If Meta's Builder rejects the plain base64, rebuild with  FLOW_IMG_DATAURL=1 node flowmenu.js
const IMG_DIR = process.env.FLOW_IMAGES_DIR || path.join(__dirname, "flow-images");
const IMG_MAX_BYTES = 300 * 1024;
function loadBanner(key) {
  if (!key) return null;
  for (const ext of ["jpg", "jpeg", "png"]) {
    const file = path.join(IMG_DIR, `${key}.${ext}`);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    if (buf.length > IMG_MAX_BYTES) {
      console.warn(`SKIPPED ${key}.${ext}: ${Math.round(buf.length / 1024)}KB > 300KB - compress it`);
      return null;
    }
    const b64 = buf.toString("base64");
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    return process.env.FLOW_IMG_DATAURL ? `data:${mime};base64,${b64}` : b64;
  }
  return null;
}

const MAX_OPTS = 20; // WhatsApp limit per CheckboxGroup
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

// One "page" = up to 20 options of one category. ids: "<pageIndex>.<itemIndex>[.H|.F]"
function buildPages() {
  const pages = [];
  for (const category of getCategories("BOTH")) {
    const items = getItems("BOTH", category);
    let opts = [];
    let part = 1;
    const flush = () => {
      if (!opts.length) return;
      pages.push({ category, part, opts });
      opts = [];
      part++;
    };
    items.forEach((item, idx) => {
      const mark = item.veg === true ? "🟢" : item.veg === false ? "🔴" : "🟡";
      const variants = isHalfFull(item)
        ? [["H", "Half", item.price.half], ["F", "Full", item.price.full]]
        : [[null, null, item.price]];
      for (const [code, label, price] of variants) {
        if (opts.length >= MAX_OPTS) flush();
        const suffix = ` ₹${price}`;
        const base = `${mark} ${label ? `${item.name} (${label})` : item.name}`;
        opts.push({
          id: code ? `${item.name}|${code}` : item.name, // resolved server-side by category + name
          cat: category,
          veg: item.veg,
          title: cut(base, 30 - suffix.length) + suffix
        });
      }
    });
    flush();
  }
  return pages;
}

// Screens shown to the customer. Each screen holds several categories (fewer taps).
// Any category NOT listed here is auto-added to an "Aur items" screen, so nothing is ever lost.
const SCREEN_GROUPS = [
  ["🥟 Momos & Snacks", ["MOMOS", "CHINESE SNACKS", "TANDOORI SNACKS", "CHICKEN SNACKS"], "momos"],
  ["🍜 Noodles, Rice & Soup", ["NOODLES", "RICE", "PASTA", "SOUPS"], "noodles"],
  ["🍛 Main Course & Roti", ["MAIN COURSE", "BREADS", "TANDOORI"], "maincourse"],
  ["🍔 Burger, Pizza & Rolls", ["BURGERS", "PIZZA", "ROLLS"], "burger"],
  ["🥤 Drinks & Dessert", ["MOCKTAILS", "SHAKES", "COFFEE & DESSERTS", "EXTRAS"], "drinks"]
];

const LET = "ABCDEFGHIJ";

// Menu-type filter shown first. veg === null means "same item in both menus" -> shown in VEG and NON-VEG.
const FILTERS = [
  { code: "V", title: "🟢 VEG", keep: (o) => o.veg !== false },
  { code: "N", title: "🔴 NON-VEG", keep: (o) => o.veg !== true },
  { code: "A", title: "🍽️ ALL (VEG + NON-VEG)", keep: () => true }
];

function groupPages(pages) {
  const used = new Set();
  const groups = SCREEN_GROUPS.map(([title, cats, imgKey]) => {
    const idx = [];
    pages.forEach((p, i) => { if (cats.includes(p.category)) { idx.push(i); used.add(i); } });
    return { title, idx, imgKey };
  }).filter((g) => g.idx.length);
  const rest = pages.map((_, i) => i).filter((i) => !used.has(i));
  if (rest.length) groups.push({ title: "🍽️ More items", idx: rest });
  return groups;
}

function buildFlowJsonGrouped() {
  const pages = buildPages();
  const groups = groupPages(pages);
  const keys = pages.map((_, i) => `c${i}`);
  const allData = Object.fromEntries(keys.map((k) => [k, { type: "array", items: { type: "string" }, __example__: [] }]));
  const carryAll = () => Object.fromEntries(keys.map((k) => [k, `\${data.${k}}`]));
  const nav = (name) => ({ name: "navigate", next: { type: "screen", name }, payload: carryAll() });
  const sendItem = { id: "done", "main-content": { title: "✅ Send my order" }, "on-click-action": nav("CONFIRM") };

  const screens = [];

  // 1) choose VEG / NON-VEG / ALL
  screens.push({
    id: "CATS",
    title: "TREAT Menu",
    data: allData,
    layout: {
      type: "SingleColumnLayout",
      children: [
        {
          type: "NavigationList",
          name: "types",
          label: "What would you like?",
          description: "Pick menu type, then dishes",
          "list-items": [
            sendItem,
            ...FILTERS.map((f) => ({ id: `f${f.code}`, "main-content": { title: f.title }, "on-click-action": nav(`LIST_${f.code}`) }))
          ]
        }
      ]
    }
  });

  for (const f of FILTERS) {
    // groups that still have at least one dish after filtering
    const shown = groups
      .map((g, gi) => ({ g, gi, idx: g.idx.filter((i) => pages[i].opts.some(f.keep)) }))
      .filter((x) => x.idx.length);

    // 2) category list for this filter
    screens.push({
      id: `LIST_${f.code}`,
      title: cut(f.title.replace("🍽️ ", ""), 30),
      data: allData,
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "NavigationList",
            name: `cats${f.code}`,
            label: "Pick a section",
            description: "Tick dishes, then tap Add",
            "list-items": [
              sendItem,
              ...shown.map((x) => ({
                id: `g${x.gi}`,
                "main-content": { title: cut(x.g.title, 30) },
                "on-click-action": nav(`GROUP_${f.code}_${LET[x.gi]}`)
              }))
            ]
          }
        ]
      }
    });

    // 3) dishes of each section
    for (const x of shown) {
      const payload = Object.fromEntries(keys.map((k) => [k, `\${data.${k}}`]));
      for (const i of x.idx) payload[`c${i}`] = `\${form.sel${i}}`;
      screens.push({
        id: `GROUP_${f.code}_${LET[x.gi]}`,
        title: cut(x.g.title, 30),
        data: allData,
        layout: {
          type: "SingleColumnLayout",
          children: [
            ...(loadBanner(x.g.imgKey) ? [{ type: "Image", src: loadBanner(x.g.imgKey), "alt-text": cut(x.g.title, 30) }] : []),
            {
              type: "Form",
              name: "form",
              "init-values": Object.fromEntries(x.idx.map((i) => [`sel${i}`, `\${data.c${i}}`])),
              children: [
                ...x.idx.map((i) => {
                  const p = pages[i];
                  const same = pages.filter((q) => q.category === p.category).length > 1;
                  return {
                    type: "CheckboxGroup",
                    name: `sel${i}`,
                    label: cut(same ? `${p.category} (${p.part})` : p.category, 30),
                    required: false,
                    "data-source": p.opts.filter(f.keep).map((o) => ({ id: o.id, title: o.title }))
                  };
                }),
                {
                  type: "Footer",
                  label: "Add to order",
                  "on-click-action": { name: "navigate", next: { type: "screen", name: `LIST_${f.code}` }, payload }
                }
              ]
            }
          ]
        }
      });
    }
  }

  screens.push({
    id: "CONFIRM",
    title: "Send order",
    terminal: true,
    data: allData,
    layout: {
      type: "SingleColumnLayout",
      children: [
        { type: "TextBody", text: "Your picks will go to the chat cart. Quantity, size and payment are done there." },
        { type: "Footer", label: "Send to WhatsApp", "on-click-action": { name: "complete", payload: carryAll() } }
      ]
    }
  });

  return { version: "7.0", screens };
}

// ONE PAGE per menu type: pick VEG / NON-VEG / ALL, then every category is on a single scrolling page.
function buildFlowJson() {
  const pages = buildPages();
  const screens = [
    {
      id: "CATS",
      title: "TREAT Menu",
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "NavigationList",
            name: "types",
            label: "What would you like?",
            description: "Pick menu type",
            "list-items": FILTERS.map((f) => ({
              id: `f${f.code}`,
              "main-content": { title: f.title },
              "on-click-action": { name: "navigate", next: { type: "screen", name: `MENU_${f.code}` }, payload: {} }
            }))
          }
        ]
      }
    }
  ];

  for (const f of FILTERS) {
    const used = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.opts.some(f.keep));
    screens.push({
      id: `MENU_${f.code}`,
      title: cut(f.title.replace("🍽️ ", ""), 30),
      terminal: true,
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              ...used.map(({ p, i }) => {
                const same = pages.filter((q) => q.category === p.category).length > 1;
                return {
                  type: "CheckboxGroup",
                  name: `sel${i}`,
                  label: cut(same ? `${p.category} (${p.part})` : p.category, 30),
                  required: false,
                  "data-source": p.opts.filter(f.keep).map((o) => ({ id: o.id, title: o.title }))
                };
              }),
              {
                type: "Footer",
                label: "Send order",
                "on-click-action": {
                  name: "complete",
                  payload: Object.fromEntries(used.map(({ i }) => [`c${i}`, `\${form.sel${i}}`]))
                }
              }
            ]
          }
        ]
      }
    });
  }
  return { version: "7.0", screens };
}

// ---- runtime part --------------------------------------------------------
module.exports = function createFlowMenu(deps) {
  const { getSession, sendWhatsAppMessage, startTypedItem, processQueue } = deps;
  const FLOW_ID = process.env.WHATSAPP_FLOW_ID || "";
  const enabled = !!FLOW_ID;
  const pages = enabled ? buildPages() : [];

  // One-page flow (default): its first screen declares no data, so we send none.
  // Only the 5-section layout (flow_grouped.json) needs the empty selections:  FLOW_LAYOUT=grouped on Render.
  const GROUPED = String(process.env.FLOW_LAYOUT || "").toLowerCase() === "grouped";

  async function sendFlow(to, bodyText, ctaLabel) {
    const payload = { screen: "CATS" };
    if (GROUPED) payload.data = Object.fromEntries(pages.map((_, i) => [`c${i}`, []]));
    await sendWhatsAppMessage(to, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: cut(bodyText, 1000) },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: FLOW_ID,
            flow_cta: cut(ctaLabel, 20),
            flow_action: "navigate",
            flow_action_payload: payload,
            flow_token: `menu-${to}`
          }
        }
      }
    });
  }

  // customer finished the flow -> put the picked dishes into the normal chat ordering steps
  async function handleReply(from, responseJson) {
    let data;
    try {
      data = typeof responseJson === "string" ? JSON.parse(responseJson) : responseJson || {};
    } catch (_) {
      return false;
    }
    const session = getSession(from);
    const picked = [];
    pages.forEach((p, i) => {
      const ids = Array.isArray(data[`c${i}`]) ? data[`c${i}`] : [];
      for (const id of ids) {
        const opt = p.opts.find((o) => o.id === id);
        if (!opt) continue; // never trust ids from the client
        const [name, code] = opt.id.split("|");
        const item = getItems("BOTH", opt.cat).find((x) => x.name === name);
        if (item) picked.push({ item, variant: code === "H" ? "HALF" : code === "F" ? "FULL" : null });
      }
    });
    if (!picked.length) return false;

    for (const pk of picked.slice(0, 40)) {
      session.queue.push({ kind: "item", item: pk.item, qty: 1, variant: pk.variant, boneless: null, cheese: null });
    }
    await processQueue(from);
    return true;
  }

  return { enabled, sendFlow, handleReply };
};

module.exports.buildFlowJson = buildFlowJson;
module.exports.buildFlowJsonGrouped = buildFlowJsonGrouped;

if (require.main === module) {
  const out = path.join(__dirname, "flow.json");
  fs.writeFileSync(out, JSON.stringify(buildFlowJson(), null, 2));
  fs.writeFileSync(path.join(__dirname, "flow_grouped.json"), JSON.stringify(buildFlowJsonGrouped(), null, 2));
  console.log("written", out, "(one page) + flow_grouped.json (fallback), pages:", buildPages().length);
}
