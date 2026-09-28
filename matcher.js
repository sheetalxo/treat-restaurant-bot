// ======================================================
// TYPED ORDER PARSER
// "2 veg steam momos, 1 dal makhani, pizza, 3 butter naan"
// -> entries: item / pick / category / catpick / unknown
// Works with English (Roman) spelling only.
// ======================================================

const { getCategories, getItems } = require("./menu");

// ---------- normalisation ----------

const ALIAS = {
  chilly: "chilli", chili: "chilli", chile: "chilli",
  panner: "paneer", paner: "paneer", panir: "paneer",
  lachha: "lacchha", laccha: "lacchha", lacha: "lacchha", lachcha: "lacchha",
  chap: "chaap", chaapp: "chaap",
  daal: "dal", makhni: "makhani",
  manchuriyan: "manchurian", manchurien: "manchurian",
  burgar: "burger", piza: "pizza", pizzza: "pizza",
  biriyani: "biryani", briyani: "biryani", biriani: "biryani",
  coffe: "coffee", cofee: "coffee", kofi: "coffee",
  moktail: "mocktail", mocktel: "mocktail",
  coldrink: "colddrink", cooldrink: "colddrink",
  nan: "naan", nann: "naan",
  parantha: "paratha", prantha: "paratha", paratha: "paratha",
  haka: "hakka", shezwan: "schezwan", szechuan: "schezwan", schezuan: "schezwan",
  lolipop: "lollipop", lollypop: "lollipop",
  afgani: "afghani", tandori: "tandoori",
  kabab: "kebab", sheekh: "seekh",
  labadar: "lababdar", lababdaar: "lababdar",
  pyaja: "pyaza", piyaza: "pyaza", pyaaz: "pyaza", dopyaza: "pyaza",
  momoz: "momo", mumo: "momo"
};

const STOP = new Set([
  "plate", "pcs", "pc", "piece", "of", "the", "a", "an", "please", "pls", "plz",
  "chahiye", "chaiye", "chahie", "dena", "de", "mujhe", "mereko", "mujhko",
  "humko", "hume", "order", "bhi", "with", "add", "want", "need", "i", "me",
  "give", "get", "ko", "ka", "ki", "ke", "hai", "hain", "kar", "karo", "no", "nos"
]);

const NUMWORD = {
  one: 1, ek: 1, two: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5, six: 6, chhe: 6, seven: 7, saat: 7,
  eight: 8, aath: 8, nine: 9, nau: 9, ten: 10, das: 10
};

function stem(w) {
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return ALIAS[w] || w;
}

function clean(s) {
  return s
    .toLowerCase()
    .replace(/cold\s*drink/g, "colddrink")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// tokens for menu names (drop stopwords and plain numbers except 65)
function keyTokens(name) {
  return clean(name)
    .split(" ")
    .filter(Boolean)
    .map(stem)
    .filter((w) => !STOP.has(w) && (!/^\d+$/.test(w) || w === "65"));
}

// ---------- index of menu ----------

const ALL_CATS = getCategories("BOTH");
const ALL_ITEMS = [];
for (const c of ALL_CATS) ALL_ITEMS.push(...getItems("BOTH", c));

const ITEM_KEYS = ALL_ITEMS.map((item) => ({ item, tokens: new Set(keyTokens(item.name)) }));
const CAT_KEYS = ALL_CATS.map((c) => ({ c, tokens: new Set(keyTokens(c)) }));

const VOCAB = new Set();
ITEM_KEYS.forEach((k) => k.tokens.forEach((t) => VOCAB.add(t)));
CAT_KEYS.forEach((k) => k.tokens.forEach((t) => VOCAB.add(t)));

const CAT_ALIAS = {
  beverage: ["MOCKTAILS", "SHAKES", "COFFEE & DESSERTS"],
  drink: ["MOCKTAILS", "SHAKES", "COFFEE & DESSERTS"],
  sweet: ["COFFEE & DESSERTS"],
  starter: ["CHINESE SNACKS", "TANDOORI SNACKS", "CHICKEN SNACKS"],
  extra: ["EXTRAS"]
};

// ---------- helpers ----------

const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const subset = (a, b) => [...a].every((x) => b.has(x));

function lev(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return d[m][n];
}

// fix small typos: "mumos" -> "momo", "pnner" -> "paneer"
function fuzzyFix(tokens) {
  return tokens.map((t) => {
    if (VOCAB.has(t) || t.length < 4 || /\d/.test(t)) return t;
    const maxD = t.length <= 5 ? 1 : 2;
    let best = null, bestD = 99, tie = false;
    for (const v of VOCAB) {
      if (/\d/.test(v)) continue;
      const dist = lev(t, v);
      if (dist < bestD) { bestD = dist; best = v; tie = false; }
      else if (dist === bestD && v !== best) tie = true;
    }
    return best && bestD <= maxD && !tie ? best : t;
  });
}

// ---------- resolve tokens -> menu ----------

function resolve(tokens) {
  const q = new Set(tokens);
  if (!q.size) return null;

  // 0. category aliases ("drinks", "starter")
  if (tokens.length === 1 && CAT_ALIAS[tokens[0]]) {
    const cats = CAT_ALIAS[tokens[0]].filter((c) => ALL_CATS.includes(c));
    return cats.length === 1
      ? { kind: "category", category: cats[0] }
      : { kind: "catpick", categories: cats };
  }

  // 1. exact category (plus any other category that also contains the word)
  const exactCat = CAT_KEYS.find((k) => setEq(k.tokens, q));
  if (exactCat) {
    const others = CAT_KEYS.filter((k) => k !== exactCat && subset(q, k.tokens)).map((k) => k.c);
    return others.length
      ? { kind: "catpick", categories: [exactCat.c, ...others] }
      : { kind: "category", category: exactCat.c };
  }

  // 2. exact item
  const exactItem = ITEM_KEYS.find((k) => setEq(k.tokens, q));
  if (exactItem) return { kind: "item", item: exactItem.item };

  // 3. item contains every word typed
  const subs = ITEM_KEYS
    .filter((k) => subset(q, k.tokens))
    .sort((a, b) => a.tokens.size - b.tokens.size);

  if (subs.length === 1) return { kind: "item", item: subs[0].item };
  if (subs.length > 1) {
    if (subs.length <= 10) return { kind: "pick", candidates: subs.map((k) => k.item) };
    const cats = [...new Set(subs.map((k) => k.item.category))];
    return cats.length === 1
      ? { kind: "category", category: cats[0] }
      : { kind: "catpick", categories: cats.slice(0, 10) };
  }

  // 4. category contains every word typed ("snacks", "course")
  const cs = CAT_KEYS.filter((k) => subset(q, k.tokens)).map((k) => k.c);
  if (cs.length === 1) return { kind: "category", category: cs[0] };
  if (cs.length > 1) return { kind: "catpick", categories: cs.slice(0, 10) };

  return null;
}

// ---------- segment parsing ----------

function parseSegment(segment) {
  const original = segment.trim();
  if (!original) return null;

  let s = original.toLowerCase();

  // flags
  let boneless = null;
  let cheese = null;
  let variant = null;

  if (/\b(no|without)\s+(extra\s+)?cheese\b/.test(s)) {
    cheese = false;
    s = s.replace(/\b(no|without)\s+(extra\s+)?cheese\b/g, " ");
  }
  if (/\b(extra\s+cheese|cheese\s+extra)\b/.test(s)) {
    cheese = true;
    s = s.replace(/\b(extra\s+cheese|cheese\s+extra)\b/g, " ");
  }
  if (/\bbone\s*less\b/.test(s)) {
    boneless = true;
    s = s.replace(/\bbone\s*less\b/g, " ");
  } else if (/\b(bone\s*in|with\s*bone|bones?)\b/.test(s)) {
    boneless = false;
    s = s.replace(/\b(bone\s*in|with\s*bone|bones?)\b/g, " ");
  }
  if (/\b(half|aadha|adha)\b/.test(s)) {
    variant = "HALF";
    s = s.replace(/\b(half|aadha|adha)\b/g, " ");
  } else if (/\b(full|poori|pura)\b/.test(s)) {
    variant = "FULL";
    s = s.replace(/\b(full|poori|pura)\b/g, " ");
  }

  // "2x momos" / "momos x2"
  s = s.replace(/(\d+)\s*[x×]\s+/g, "$1 ").replace(/\s+[x×]\s*(\d+)\b/g, " $1");

  const raw = clean(s).split(" ").filter(Boolean);

  // quantity
  let qty = null;
  const isQtyNum = (w) => /^\d{1,3}$/.test(w) && w !== "65";

  if (raw.length && isQtyNum(raw[0])) {
    qty = parseInt(raw.shift(), 10);
  } else if (raw.length && NUMWORD[raw[0]] && raw.length > 1) {
    qty = NUMWORD[raw.shift()];
  } else if (raw.length > 1 && isQtyNum(raw[raw.length - 1])) {
    qty = parseInt(raw.pop(), 10);
  }

  let tokens = raw.map(stem).filter((w) => w && !STOP.has(w));

  if (!tokens.length) return { kind: "unknown", text: original };

  let res = resolve(tokens);
  if (!res) res = resolve(fuzzyFix(tokens));
  if (!res) return { kind: "unknown", text: original };

  return {
    ...res,
    qty: qty && qty > 0 ? qty : 1,
    variant,
    boneless,
    cheese,
    query: original.replace(/^\s*\d+\s*/, "").trim() || original
  };
}

function splitSegments(text) {
  return text
    .split(/[\n,;]+|\s+(?:aur|and)\s+/i)
    // "2 momos 3 pizza" -> ["2 momos", "3 pizza"]  (but keep "chicken 65" and "6 pcs")
    .flatMap((s) =>
      s.split(/\s+(?=(?!65\b)\d{1,3}\s+(?!(?:pcs|pc|piece|pieces|plate|plates)\b)[a-z])/i)
    )
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseTypedOrder(text) {
  return splitSegments(text).map(parseSegment).filter(Boolean);
}

module.exports = { parseTypedOrder };
