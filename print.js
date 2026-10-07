// ======================================================
// THERMAL PRINT FORMATTING (Phase 2)
// Builds plain-text KOT + customer bill from order.bill (billing.js output).
// Env: PRINT_WIDTH (chars per line: 32 = 58mm paper, 48 = 80mm paper; default 32)
//      PRINT_JOB_KINDS (comma list, default "kot,bill")
// "Rs." is used instead of the rupee sign: most thermal printers lack it in their codepage.
// ======================================================

const WIDTH = Math.max(24, Number(process.env.PRINT_WIDTH) || 32);
const KINDS = (process.env.PRINT_JOB_KINDS || "kot,bill")
  .split(",").map((s) => s.trim().toLowerCase()).filter((k) => k === "kot" || k === "bill");

const TYPE_LABEL = { "DINE-IN": "DINE-IN", TAKEAWAY: "TAKEAWAY", DELIVERY: "DELIVERY" };

const line = (ch = "-") => ch.repeat(WIDTH);
const center = (s) => {
  s = String(s).slice(0, WIDTH);
  return " ".repeat(Math.floor((WIDTH - s.length) / 2)) + s;
};
const money = (n) => "Rs." + (Number(n) || 0).toFixed(Number.isInteger(Number(n)) ? 0 : 2);
// left text ..... right text
function lr(left, right) {
  left = String(left); right = String(right);
  const room = WIDTH - right.length - 1;
  if (left.length > room) left = left.slice(0, room);
  return left + " ".repeat(WIDTH - left.length - right.length) + right;
}
// word-wrap to WIDTH with optional indent on continuation lines
function wrap(text, indent = "") {
  const out = [];
  let cur = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    if ((cur + " " + w).trim().length > WIDTH) {
      if (cur) out.push(cur);
      cur = indent + w;
    } else cur = (cur ? cur + " " : "") + w;
  }
  if (cur) out.push(cur);
  return out;
}
function optionsText(it) {
  const o = [];
  if (it.variant) o.push(it.variant);
  if (it.boneless) o.push("Boneless");
  if (it.cheese) o.push("Extra Cheese");
  return o.join(", ");
}
function fmtPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : d ? "+" + d : "-";
}
function when(order) {
  try {
    return new Date(order.createdAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true
    });
  } catch { return ""; }
}

// Kitchen order ticket: big on quantities, no prices.
function formatKot(order) {
  const L = [];
  L.push(center("*** KOT ***"), center("TREAT RESTAURANT"), line("="));
  L.push(`Order: ${order.id}`);
  L.push(`Type : ${TYPE_LABEL[order.orderType] || order.orderType}`);
  if (order.orderType === "DINE-IN" && order.visitTime) L.push(`Visit: ${order.visitTime}`);
  L.push(`Time : ${when(order)}`);
  L.push(line());
  for (const it of order.bill?.items || []) {
    L.push(...wrap(`${it.quantity} x ${it.name}`, "    "));
    const opt = optionsText(it);
    if (opt) L.push(...wrap(`   (${opt})`, "    "));
  }
  L.push(line("="));
  if (order.orderType === "DELIVERY") L.push(center("** DELIVERY **"));
  return L.join("\n") + "\n";
}

// Customer bill: prices come ONLY from order.bill (distance is never printed).
function formatBill(order) {
  const b = order.bill || {};
  const L = [];
  L.push(center("TREAT RESTAURANT"), center("Customer Bill"), line("="));
  L.push(`Order: ${order.id}`);
  L.push(`Date : ${when(order)}`);
  L.push(`Type : ${TYPE_LABEL[order.orderType] || order.orderType}`);
  if (order.name) L.push(`Name : ${order.name}`);
  L.push(`Phone: ${fmtPhone(order.phone)}`);
  L.push(line());
  for (const it of b.items || []) {
    const opt = optionsText(it);
    L.push(...wrap(`${it.name}${opt ? " (" + opt + ")" : ""}`));
    L.push(lr(`  ${it.quantity} x ${money(it.unitPrice)}`, money(it.lineTotal)));
  }
  L.push(line());
  L.push(lr("Food Subtotal", money(b.foodSubtotal)));
  if (b.packingCharges > 0) L.push(lr("Packing Charges", money(b.packingCharges)));
  if (order.orderType === "DELIVERY") L.push(lr("Delivery Charges", money(b.deliveryCharges)));
  if (b.discount > 0) L.push(lr("Discount", "-" + money(b.discount)));
  L.push(line("="));
  L.push(lr("TOTAL", money(b.total)));
  L.push(line("="));
  const pay = order.status === "PAID" ? "Paid Online" : order.orderType === "DELIVERY" ? "Cash on Delivery" : "Pay at Restaurant";
  L.push(`Payment: ${pay}`);
  if (order.orderType === "DELIVERY" && order.address) {
    L.push(line(), "Deliver to:", ...wrap(order.address));
  }
  L.push("", center("Thank you! Visit again"));
  return L.join("\n") + "\n";
}

// -> [{ kind, payload }]  payload.text is ready to print as-is
function buildPrintJobs(order) {
  const fmt = { kot: formatKot, bill: formatBill };
  return KINDS.map((kind) => ({
    kind,
    payload: {
      text: fmt[kind](order),
      width: WIDTH,
      orderId: order.id,
      orderType: order.orderType,
      total: order.bill?.total ?? null
    }
  }));
}

module.exports = { buildPrintJobs, formatKot, formatBill };
