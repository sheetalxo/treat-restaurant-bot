// Run: node test/billing.test.js   (no dependencies needed)
const assert = require("assert");
const { calculateOrderTotal } = require("../billing");

const N = "NORMAL_FOOD";
const line = (name, price, quantity, chargeCat = N) => ({ name, price, quantity, chargeCat });

// Spec example 6 (Delivery, shake menu price Rs.80)
let b = calculateOrderTotal({
  orderType: "DELIVERY",
  distanceKm: 3.5,
  items: [line("Chicken Hakka Noodles", 180, 2), line("Butter Chicken Full", 490, 1),
          line("Garlic Naan", 60, 2), line("Shake", 80, 1, "SHAKE")]
});
assert.strictEqual(b.foodSubtotal, 1060);
assert.strictEqual(b.packingCharges, 48.5);
assert.strictEqual(b.deliveryCharges, 50);
assert.strictEqual(b.total, 1158.5);

// Spec example 8 (Dine-In)
b = calculateOrderTotal({
  orderType: "DINE-IN",
  items: [line("Paneer Tikka", 220, 1), line("Butter Naan", 60, 2), line("Shake", 80, 1, "SHAKE")]
});
assert.strictEqual(b.foodSubtotal, 420);
assert.strictEqual(b.packingCharges, 17);
assert.strictEqual(b.deliveryCharges, 0);
assert.strictEqual(b.total, 437);

// Shake x2: takeaway/delivery = 80*2 + 10*2 = 180, no packing; dine-in = 160
const shake2 = [line("Shake", 80, 2, "SHAKE")];
assert.strictEqual(calculateOrderTotal({ orderType: "TAKEAWAY", items: shake2 }).total, 180);
assert.strictEqual(calculateOrderTotal({ orderType: "DINE-IN", items: shake2 }).total, 160);
assert.strictEqual(calculateOrderTotal({ orderType: "TAKEAWAY", items: shake2 }).packingCharges, 0);

// Mocktail same rule as shake
assert.strictEqual(calculateOrderTotal({ orderType: "TAKEAWAY", items: [line("Mojito", 120, 1, "MOCKTAIL")] }).total, 130);

// Cold drink / water: menu price only, in every order type
for (const type of ["DINE-IN", "TAKEAWAY"]) {
  assert.strictEqual(calculateOrderTotal({ orderType: type, items: [line("Colddrink", 20, 1, "COLD_DRINK")] }).total, 20);
  assert.strictEqual(calculateOrderTotal({ orderType: type, items: [line("Water Bottle", 20, 1, "WATER")] }).total, 20);
}
assert.strictEqual(
  calculateOrderTotal({ orderType: "DELIVERY", distanceKm: 1, items: [line("Water Bottle", 20, 1, "WATER")] }).total, 50);

// Delivery slabs (boundaries) + out of range
const del = (km) => calculateOrderTotal({ orderType: "DELIVERY", distanceKm: km, items: [line("x", 100, 1)] }).deliveryCharges;
assert.deepStrictEqual([2.5, 2.51, 5, 5.01, 7, 7.01, 10].map(del), [30, 50, 50, 80, 80, 100, 100]);
assert.throws(() => del(10.01));

// Returned billing data never carries distance
assert.ok(!("distanceKm" in calculateOrderTotal({ orderType: "DELIVERY", distanceKm: 3, items: [line("x", 100, 1)] })));

console.log("billing tests passed");
