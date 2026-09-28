// ======================================================
// CENTRAL BILLING  (single source of truth)
//
// calculateOrderTotal() is the ONLY place where totals are computed.
// WhatsApp bill, PDF invoice, printed bill and Telegram alert all
// read the object it returns - nothing is recalculated elsewhere.
//
// Delivery distance is used INTERNALLY (to pick the delivery slab)
// and is deliberately NOT part of the returned data, so it can never
// leak into a customer-facing message, PDF or Telegram alert.
// ======================================================

const PACKING_PERCENT = 5;        // internal only - never printed anywhere
const SHAKE_TAKEAWAY_EXTRA = 10;  // per item, shake + mocktail, takeaway/delivery only

// 0-2.5 km = 30 | 2.5-5 km = 50 | 5-7 km = 80 | 7-10 km = 100. Last maxKm = limit.
const DELIVERY_TIERS = [
  { maxKm: 2.5, charge: 30 },
  { maxKm: 5, charge: 50 },
  { maxKm: 7, charge: 80 },
  { maxKm: 10, charge: 100 }
];

const round2 = (n) => Math.round(n * 100) / 100;

// returns null when beyond the delivery limit
function deliveryChargeFor(km) {
  for (const tier of DELIVERY_TIERS) {
    if (km <= tier.maxKm) return tier.charge;
  }
  return null;
}

// Cart line -> charge category (set when the line is added to the cart)
function categoryOf(line) {
  return line.chargeCat || "NORMAL_FOOD";
}

// order types are stored as "DINE-IN" | "TAKEAWAY" | "DELIVERY"
function calculateOrderTotal({ items, orderType, distanceKm = null, discount = 0 }) {
  const isDineIn = orderType === "DINE-IN";
  const isDelivery = orderType === "DELIVERY";

  let normalFoodSubtotal = 0;
  let foodSubtotal = 0;

  const lines = items.map((line) => {
    const cat = categoryOf(line);
    const qty = line.quantity;

    let unitPrice = line.price; // menu price (incl. boneless / cheese add-ons)

    if ((cat === "SHAKE" || cat === "MOCKTAIL") && !isDineIn) {
      unitPrice += SHAKE_TAKEAWAY_EXTRA;
    }
    // COLD_DRINK / WATER: menu price only, nothing added

    const lineTotal = unitPrice * qty;
    foodSubtotal += lineTotal;
    if (cat === "NORMAL_FOOD") normalFoodSubtotal += lineTotal;

    return { ...line, chargeCat: cat, unitPrice, lineTotal };
  });

  // 5% packing on NORMAL_FOOD only (all 3 order types)
  const packingCharges = round2((normalFoodSubtotal * PACKING_PERCENT) / 100);

  // Delivery charge: DELIVERY orders only
  let deliveryCharges = 0;
  if (isDelivery) {
    if (distanceKm === null || distanceKm === undefined) {
      throw new Error("Delivery distance missing for DELIVERY order");
    }
    const charge = deliveryChargeFor(distanceKm);
    if (charge === null) throw new Error("Delivery location is out of range");
    deliveryCharges = charge;
  }

  const discountAmt = round2(Math.max(0, Number(discount) || 0));
  const total = round2(
    Math.max(0, foodSubtotal + packingCharges + deliveryCharges - discountAmt)
  );

  return {
    orderType,
    items: lines,
    foodSubtotal: round2(foodSubtotal),
    packingCharges,
    deliveryCharges,
    discount: discountAmt,
    total
  };
}

module.exports = {
  calculateOrderTotal,
  deliveryChargeFor,
  DELIVERY_TIERS,
  PACKING_PERCENT,
  SHAKE_TAKEAWAY_EXTRA,
  round2
};
