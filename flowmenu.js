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
        opts.push({
          id: code ? `${item.name}|${code}` : item.name, // resolved server-side by category + name
          cat: category,
          title: cut(label ? `${item.name} (${label})` : item.name, 30),
          description: `${mark} ₹${price}${item.desc ? " · " + cut(item.desc, 60) : ""}`
        });
      }
    });
    flush();
  }
  return pages;
}

function buildFlowJson() {
  const pages = buildPages();
  const keys = pages.map((_, i) => `c${i}`);
  const allData = Object.fromEntries(keys.map((k) => [k, { type: "array", items: { type: "string" }, __example__: [] }]));
  const emptyPayloadFor = (except, val) =>
    Object.fromEntries(keys.map((k) => [k, k === except ? val : `\${data.${k}}`]));

  const catScreen = {
    id: "CATS",
    title: "TREAT Menu",
    data: allData,
    layout: {
      type: "SingleColumnLayout",
      children: [
        { type: "TextBody", text: "Category chuno, dish select karo. Sab chunne ke baad 'Order bhejo' dabao." },
        {
          type: "NavigationList",
          name: "cats",
          "list-items": [
            ...pages.map((p, i) => ({
              id: `p${i}`,
              "main-content": { title: cut(pages.filter((x) => x.category === p.category).length > 1 ? `${p.category} ${p.part}` : p.category, 30) },
              "on-click-action": {
                name: "navigate",
                next: { type: "screen", name: `PAGE_${i}` },
                payload: Object.fromEntries(keys.map((k) => [k, `\${data.${k}}`]))
              }
            })),
            {
              id: "done",
              "main-content": { title: "✅ Order bhejo", description: "Review" },
              "on-click-action": {
                name: "navigate",
                next: { type: "screen", name: "CONFIRM" },
                payload: Object.fromEntries(keys.map((k) => [k, `\${data.${k}}`]))
              }
            }
          ]
        }
      ]
    }
  };

  const pageScreens = pages.map((p, i) => ({
    id: `PAGE_${i}`,
    title: cut(p.category, 30),
    data: allData,
    layout: {
      type: "SingleColumnLayout",
      children: [
        {
          type: "Form",
          name: "form",
          children: [
            {
              type: "CheckboxGroup",
              name: "sel",
              label: cut(p.category, 30),
              required: false,
              "data-source": p.opts.map((o) => ({ id: o.id, title: o.title, description: o.description })),
              "init-value": `\${data.c${i}}`
            },
            {
              type: "Footer",
              label: "Add karo",
              "on-click-action": {
                name: "navigate",
                next: { type: "screen", name: "CATS" },
                payload: emptyPayloadFor(`c${i}`, "${form.sel}")
              }
            }
          ]
        }
      ]
    }
  }));

  const confirm = {
    id: "CONFIRM",
    title: "Order bhejo",
    terminal: true,
    data: allData,
    layout: {
      type: "SingleColumnLayout",
      children: [
        { type: "TextBody", text: "Aapke chune hue items WhatsApp chat me cart me aa jayenge. Wahan quantity, size aur checkout kar sakte ho." },
        {
          type: "Footer",
          label: "WhatsApp pe bhejo",
          "on-click-action": {
            name: "complete",
            payload: Object.fromEntries(keys.map((k) => [k, `\${data.${k}}`]))
          }
        }
      ]
    }
  };

  return { version: "7.0", screens: [catScreen, ...pageScreens, confirm] };
}

// ---- runtime part --------------------------------------------------------
module.exports = function createFlowMenu(deps) {
  const { getSession, sendWhatsAppMessage, startTypedItem, processQueue } = deps;
  const FLOW_ID = process.env.WHATSAPP_FLOW_ID || "";
  const enabled = !!FLOW_ID;
  const pages = enabled ? buildPages() : [];

  async function sendFlow(to, bodyText, ctaLabel) {
    const data = Object.fromEntries(pages.map((_, i) => [`c${i}`, []]));
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
            flow_action_payload: { screen: "CATS", data },
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

if (require.main === module) {
  const out = path.join(__dirname, "flow.json");
  fs.writeFileSync(out, JSON.stringify(buildFlowJson(), null, 2));
  console.log("written", out, "pages:", buildPages().length);
}
