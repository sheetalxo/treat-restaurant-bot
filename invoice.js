// ======================================================
// THERMAL INVOICE PDF  (80mm by default, set INVOICE_WIDTH_MM=58 for 58mm)
// Monospace text only, so it prints the same on any thermal printer.
// NOTE: standard PDF fonts are used -> only English/ASCII characters print.
// Hindi / emoji in name or address are replaced with "?" on the PDF.
// ======================================================

const PDFDocument = require("pdfkit");

const WIDTH_MM = Number(process.env.INVOICE_WIDTH_MM || 80);
const MARGIN_MM = 4;
const FONT_SIZE = 8;
const LINE_H = 10;

const RESTAURANT = {
  name: process.env.RESTAURANT_NAME || "TREAT RESTAURANT",
  tagline: "Where Families Eat Together",
  address:
    process.env.RESTAURANT_ADDRESS ||
    "Hira Chak, Swankha, Nandpur, Samba (J&K)",
  phone: process.env.RESTAURANT_PHONE || "9018777799",
  gstin: process.env.GSTIN || "",
  fssai: process.env.FSSAI_NO || ""
};

const TYPE_LABEL = { "DINE-IN": "Dine-In", TAKEAWAY: "Takeaway", DELIVERY: "Delivery" };

const mmToPt = (mm) => (mm * 72) / 25.4;

function ascii(s) {
  return String(s ?? "")
    .replace(/[\u00a0\u202f\u2009]/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/₹/g, "Rs.")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\?{2,}/g, "?");
}

function wrap(text, width) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";

  for (let w of words) {
    while (w.length > width) {
      if (cur) { lines.push(cur); cur = ""; }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

const money = (n) => Number(n).toFixed(2);

function fmtDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  return ascii(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(d)
  );
}

function optionsText(line) {
  const o = [];
  if (line.variant) o.push(line.variant);
  if (line.boneless) o.push("Boneless");
  if (line.cheese) o.push("Extra Cheese");
  return o.length ? ` (${o.join(", ")})` : "";
}

function buildLines(order, cols) {
  const lines = [];
  const push = (text, bold = false, link = null) => lines.push({ text, bold, link });

  const center = (t) => {
    t = ascii(t).slice(0, cols);
    return " ".repeat(Math.max(0, Math.floor((cols - t.length) / 2))) + t;
  };
  const lr = (left, right) => {
    left = ascii(left);
    right = ascii(right);
    const space = cols - left.length - right.length;
    if (space < 1) left = left.slice(0, Math.max(0, cols - right.length - 1));
    return left + " ".repeat(Math.max(1, cols - left.length - right.length)) + right;
  };
  const dash = () => push("-".repeat(cols));
  const dbl = () => push("=".repeat(cols));

  // ----- header -----
  push(center(RESTAURANT.name), true);
  push(center(RESTAURANT.tagline));
  wrap(RESTAURANT.address, cols).forEach((l) => push(center(l)));
  push(center("Ph: " + RESTAURANT.phone));
  if (RESTAURANT.gstin) push(center("GSTIN: " + RESTAURANT.gstin));
  if (RESTAURANT.fssai) push(center("FSSAI Lic: " + RESTAURANT.fssai));
  dash();
  push(center("INVOICE"), true);
  dash();

  // ----- order info -----
  push(lr("Order ID:", order.id), true);
  push(lr("Date:", fmtDate(order.createdAt)));
  push(lr("Type:", TYPE_LABEL[order.orderType] || order.orderType));
  if (order.orderType === "DINE-IN" && order.visitTime) {
    wrap("Expected Visit: " + order.visitTime, cols).forEach((l) => push(l));
  }
  wrap("Customer: " + (order.name || "-"), cols).forEach((l) => push(l));
  push("Phone: +" + ascii(order.phone));
  if (order.orderType === "DELIVERY") {
    if (order.address) wrap("Address: " + order.address, cols).forEach((l) => push(l));
    if (order.lat && order.lng) {
      // clickable in the PDF; no distance is ever printed
      push("Google Maps Location", false, `https://www.google.com/maps?q=${order.lat},${order.lng}`);
    }
  }
  dash();

  // ----- items -----
  push(lr("ITEM", "AMOUNT"), true);
  dash();

  const b = order.bill; // single source of truth (billing.js)

  let totalQty = 0;
  for (const it of b.items) {
    totalQty += it.quantity;

    wrap(it.name + optionsText(it), cols).forEach((l) => push(l));
    push(lr("  " + it.quantity + " x " + money(it.unitPrice), money(it.lineTotal)));
  }

  dash();
  push(lr("Items: " + b.items.length, "Qty: " + totalQty));
  dash();

  // ----- totals -----
  push(lr("Food Subtotal", money(b.foodSubtotal)));
  if (b.packingCharges > 0) push(lr("Packing Charges", money(b.packingCharges)));
  if (order.orderType === "DELIVERY") push(lr("Delivery Charges", money(b.deliveryCharges)));
  push(lr("Discount", money(b.discount)));
  dbl();
  push(lr("TOTAL (Rs.)", money(b.total)), true);
  dbl();

  // ----- payment -----
  if (order.status === "PAID") {
    push(lr("Payment:", "PAID ONLINE"), true);
    if (order.paymentId) push(lr("Ref:", order.paymentId));
  } else if (order.method === "CASH") {
    push(
      lr(
        "Payment:",
        order.orderType === "DELIVERY" ? "CASH ON DELIVERY" : "PAY AT RESTAURANT"
      ),
      true
    );
    push(lr("Amount due:", money(b.total)));
  } else {
    push(lr("Payment:", "PENDING"), true);
  }
  push(lr("Status:", "CONFIRMED"), true);
  dash();

  // ----- footer -----
  push(center("Thank you! Visit again"), true);
  push(center("Dine-In | Takeaway | Home Delivery"));
  push(center("Ph: " + RESTAURANT.phone));
  push("");
  push("");

  return lines;
}

function buildInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    try {
      const widthPt = mmToPt(WIDTH_MM);
      const marginPt = mmToPt(MARGIN_MM);
      const charW = FONT_SIZE * 0.6; // Courier char width
      const cols = Math.floor((widthPt - marginPt * 2) / charW);

      const lines = buildLines(order, cols);
      const heightPt = marginPt * 2 + lines.length * LINE_H + 2;

      const doc = new PDFDocument({
        size: [widthPt, heightPt],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: { Title: `Invoice ${order.id}`, Author: RESTAURANT.name }
      });

      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      let y = marginPt;
      for (const line of lines) {
        doc
          .font(line.bold ? "Courier-Bold" : "Courier")
          .fontSize(FONT_SIZE)
          .text(line.text, marginPt, y, { lineBreak: false, link: line.link || undefined });
        y += LINE_H;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { buildInvoicePdf };
