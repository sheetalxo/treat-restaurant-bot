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
// internal only - flat packing per unit (goes INTO Packing Charges, no 5% on these)
const FLAT_PACKING = { SHAKE: 10, MOCKTAIL: 10, COFFEE: 10, ICE_CREAM: 5 };

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
  const isDelivery = orderType === "DELIVERY";

  let normalFoodSubtotal = 0; // gets the 5% packing
  let flatPacking = 0;        // shake/mocktail/coffee Rs.10, ice cream Rs.5 per unit
  let foodSubtotal = 0;

  const lines = items.map((line) => {
    const cat = categoryOf(line);
    const qty = line.quantity;

    // Menu price is NEVER changed (shake / mocktail stay at their menu price).
    const unitPrice = line.price; // incl. boneless / cheese add-ons
    const lineTotal = unitPrice * qty;
    foodSubtotal += lineTotal;

    if (cat === "NORMAL_FOOD") normalFoodSubtotal += lineTotal;
    else if (FLAT_PACKING[cat]) flatPacking += FLAT_PACKING[cat] * qty;
    // COLD_DRINK / WATER: menu price only, no packing of any kind

    return { ...line, chargeCat: cat, unitPrice, lineTotal };
  });

  // Packing = 5% of normal food + flat per-unit packing (shake/mocktail/coffee Rs.10, ice cream Rs.5).
  // Only the combined amount is returned - the formula is never exposed.
  // Dine-In: food is served at the table -> NO packing charge of any kind.
  const packingCharges =
    orderType === "DINE-IN"
      ? 0
      : round2((normalFoodSubtotal * PACKING_PERCENT) / 100 + flatPacking);

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
  FLAT_PACKING,
  round2
};
