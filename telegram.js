// ======================================================
// TELEGRAM ADMIN NOTIFICATION
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//
// The message is built ONLY from order.bill (billing.js output).
// Delivery distance is never included.
// ======================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TYPE_LABEL = { "DINE-IN": "Dine-In", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

// 1060 -> "₹1,060"   48.5 -> "₹48.50"
function inr(n) {
  n = Number(n) || 0;
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2
    })
  );
}

// 919018777799 -> "+91 90187 77799"
function fmtPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return d ? "+" + d : "-";
}

function optionsText(line) {
  const o = [];
  if (line.variant) o.push(line.variant);
  if (line.boneless) o.push("Boneless");
  if (line.cheese) o.push("Extra Cheese");
  return o.length ? ` (${o.join(", ")})` : "";
}

function paymentLabel(order) {
  if (order.status === "PAID") return "Paid Online";
  return order.orderType === "DELIVERY" ? "COD" : "Pay at Restaurant";
}

function orderSummaryText(order) {
  const b = order.bill;
  const L = [];

  L.push("NEW ORDER — TREAT RESTAURANT", "");
  L.push(`Order ID: ${order.id}`);
  L.push(`Customer: ${order.name || "-"}`);
  L.push(`Phone: ${fmtPhone(order.phone)}`);
  L.push(`Order Type: ${TYPE_LABEL[order.orderType] || order.orderType}`);
  if (order.orderType === "DINE-IN" && order.visitTime) {
    L.push(`Expected Visit: ${order.visitTime}`);
  }

  L.push("", "ITEMS");
  for (const it of b.items) {
    L.push(`• ${it.name}${optionsText(it)} × ${it.quantity} — ${inr(it.lineTotal)}`);
  }

  L.push("");
  L.push(`Food Subtotal: ${inr(b.foodSubtotal)}`);
  if (b.packingCharges > 0) L.push(`Packing Charges: ${inr(b.packingCharges)}`);
  if (order.orderType === "DELIVERY") L.push(`Delivery Charges: ${inr(b.deliveryCharges)}`);
  L.push(`Discount: ${inr(b.discount)}`);
  L.push("", `TOTAL: ${inr(b.total)}`);

  L.push("", `Payment: ${paymentLabel(order)}`);
  L.push("Status: CONFIRMED");

  if (order.orderType === "DELIVERY") {
    L.push("", "Delivery Location:");
    if (order.address) L.push(order.address);
    const lat = Number(order.lat);
    const lng = Number(order.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      L.push(`Google Maps: https://www.google.com/maps?q=${lat},${lng}`);
    }
  }

  L.push("", `PDF Invoice: ${order.pdfAttached === false ? "Not available" : "Attached"}`);
  // Telegram rejects messages over 4096 chars
  return L.join("\n").slice(0, 4000);
}

async function tgCall(method, body, headers) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

// Sends the order summary, then the PDF invoice as a document.
// Returns true when Telegram is configured and the summary was delivered.
async function notifyTelegram(order, pdfBuffer) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("Telegram env vars not set - skipping Telegram alert");
    return false;
  }

  order.pdfAttached = !!pdfBuffer;

  await tgCall(
    "sendMessage",
    JSON.stringify({ chat_id: CHAT_ID, text: orderSummaryText(order) }),
    { "Content-Type": "application/json" }
  );

  if (pdfBuffer) {
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("caption", `Invoice ${order.id}`);
    form.append(
      "document",
      new Blob([pdfBuffer], { type: "application/pdf" }),
      `Invoice_${order.id}.pdf`
    );
    await tgCall("sendDocument", form); // fetch sets the multipart boundary
  }

  return true;
}

module.exports = { orderSummaryText, notifyTelegram, inr, fmtPhone, TYPE_LABEL };
