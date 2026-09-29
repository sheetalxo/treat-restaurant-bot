// ======================================================
// TREAT RESTAURANT MENU  (prices checked against menu PDF)
// item = [name, price, optionalDescription]
// price = number  OR  { half, full }
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
      ["Margherita Pizza", 160, "Oregano, chilly flakes, Mozzarella Cheese"],
      ["Veg Deluxe Pizza", 200, "Capsicum, Onion, Corn"],
      ["Cheese Chilli Pizza", 220, "Paneer, Capsicum, Chilly Sauce, Onion"],
      ["Farm House Pizza", 250, "Capsicum, Onion, Paneer, Red Paprika, Black Olives"],
      ["Italian Pizza", 270, "Capsicum, Onion, Black Olives, Jalapeno, Paneer"],
      ["Treat Signature Pizza", 300, "Capsicum, Corn, Black Olives, Paneer, Red Paprika, Jalapenos"]
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
      ["Lemon Chicken (Dry/Gravy)", 380],
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
      ["Lacchha Paratha", 70],
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
// HELPERS   (type = "VEG" | "NON-VEG" | "BOTH")
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
    for (const [name, price, desc] of MENU[menuKey][category] || []) {
      if (byName.has(name)) {
        byName.get(name).veg = null;
        continue;
      }
      const it = { name, price, desc: desc || "", veg: isVeg, category };
      byName.set(name, it);
      out.push(it);
    }
  };

  if (type !== "NON-VEG") add("VEG", true);
  if (type !== "VEG") add("NON-VEG", false);

  return out;
}

const isHalfFull = (item) => typeof item.price === "object";

// Non-veg MAIN COURSE items (all have half/full) get the boneless option
const isBonelessEligible = (item) =>
  item.veg === false && item.category === "MAIN COURSE" && isHalfFull(item);

const isPizza = (item) => item.category === "PIZZA";

// Charging category used by billing.js:
// NORMAL_FOOD | SHAKE | MOCKTAIL | COFFEE | ICE_CREAM | COLD_DRINK | WATER
// COLD_DRINK / WATER (incl. cans and disposable glass) are exempt from all extra charges.
function chargeCategory(item) {
  const cat = String(item.category || "").toUpperCase();
  if (cat === "SHAKES") return "SHAKE";
  if (cat === "MOCKTAILS") return "MOCKTAIL";

  if (cat === "COFFEE & DESSERTS") {
    const n = String(item.name || "").toLowerCase();
    if (n.includes("coffee")) return "COFFEE";                        // Hot / Cold / Oreo Cold Coffee
    if (/ice cream|butterscotch/.test(n)) return "ICE_CREAM";         // incl. Vanilla & Butterscotch Mix
    // Gulab Jamun stays NORMAL_FOOD
  }

  if (cat === "EXTRAS") {
    const n = String(item.name || "").toLowerCase();
    if (n.includes("water")) return "WATER";
    if (/colddrink|cold drink|coke|^can$|disposable glass/.test(n)) return "COLD_DRINK";
  }
  return "NORMAL_FOOD";
}

function marker(item, type) {
  if (type !== "BOTH") return "";
  if (item.veg === true) return "🟢 ";
  if (item.veg === false) return "🔴 ";
  return "";
}

module.exports = {
  MENU,
  typeLabel,
  getCategories,
  getItems,
  isHalfFull,
  isBonelessEligible,
  isPizza,
  chargeCategory,
  marker
};
