const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// =====================================================
// TREAT RESTAURANT LOCATION
// =====================================================

const RESTAURANT_LAT = 32.5192169;
const RESTAURANT_LNG = 74.9215249;

// =====================================================
// DELIVERY RULES
// =====================================================

const DELIVERY_RULES = [
  { max: 2.5, charge: 30 },
  { max: 5, charge: 50 },
  { max: 7, charge: 80 },
  { max: 10, charge: 100 }
];

// =====================================================
// MENU
// =====================================================

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
      ["Margherita Pizza", 160],
      ["Veg Deluxe Pizza", 200],
      ["Cheese Chilli Pizza", 220],
      ["Farm House Pizza", 250],
      ["Italian Pizza", 270],
      ["Treat Signature Pizza", 300]
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
    ]
  },

  NON_VEG: {

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
      ["Lemon Chicken", 380],
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
      ["Masala Chicken", { half: 260, full: 480, boneless: 50 }],
      ["Kadai Chicken", { half: 260, full: 480, boneless: 50 }],
      ["Rara Chicken", { half: 300, full: 500, boneless: 50 }],
      ["Butter Chicken", { half: 280, full: 490, boneless: 50 }],
      ["Chicken Do Pyaza", { half: 270, full: 480, boneless: 50 }],
      ["Chicken Lababdar", { half: 270, full: 480, boneless: 50 }]
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
      ["Lachha Paratha", 70],
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
    ]
  },

  COMMON: {

    "SALAD": [
      ["Salad", 50]
    ],

    "WATER": [
      ["Water", 10],
      ["Water Bottle", 20]
    ],

    "DISPOSAL": [
      ["Disposal Glass", 5]
    ],

    "BEVERAGE": [
      ["Colddrink", 20],
      ["Coke Can", 30],
      ["Can", 50]
    ]
  }
};

// =====================================================
// SESSION STORAGE
// =====================================================

const sessions = {};

function getSession(phone) {

  if (!sessions[phone]) {

    sessions[phone] = {

      mode: null,

      category: null,

      item: null,

      variant: null,

      boneless: false,

      extraCheese: false,

      quantity: 1,

      cart: [],

      checkoutStep: null,

      customerName: "",
      address: "",
      latitude: null,
      longitude: null

    };
  }

  return sessions[phone];
}

// =====================================================
// HEALTH
// =====================================================

app.get("/", (req, res) => {

  res.status(200).send(
    "TREAT RESTAURANT WhatsApp Bot is running"
  );

});

// =====================================================
// WEBHOOK VERIFY
// =====================================================

app.get("/webhook", (req, res) => {

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (
    mode === "subscribe" &&
    token === VERIFY_TOKEN
  ) {

    console.log("Webhook verified successfully");

    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =====================================================
// WEBHOOK RECEIVE
// =====================================================

app.post("/webhook", async (req, res) => {

  try {

    const message =
      req.body.entry?.[0]
        ?.changes?.[0]
        ?.value
        ?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const session = getSession(from);

    // -----------------------------------------------
    // TEXT
    // -----------------------------------------------

    if (message.type === "text") {

      const text =
        message.text?.body?.trim();

      const lower =
        text.toLowerCase();

      // Customer entering name/address
      if (session.checkoutStep === "name") {

        session.customerName = text;
        session.checkoutStep = "address";

        await sendText(
          from,
          "Please enter your complete delivery address."
        );

        return res.sendStatus(200);
      }

      if (session.checkoutStep === "address") {

        session.address = text;
        session.checkoutStep = "location";

        await sendLocationRequest(from);

        return res.sendStatus(200);
      }

      if (
        lower === "hi" ||
        lower === "hello" ||
        lower === "hey" ||
        lower === "start"
      ) {

        resetOrderingSession(session);

        await sendWelcomeMessage(from);

        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    }

    // -----------------------------------------------
    // LOCATION
    // -----------------------------------------------

    if (message.type === "location") {

      session.latitude =
        message.location.latitude;

      session.longitude =
        message.location.longitude;

      session.checkoutStep = "payment";

      await sendCheckoutSummary(from);

      return res.sendStatus(200);
    }

    // -----------------------------------------------
    // INTERACTIVE
    // -----------------------------------------------

    if (message.type === "interactive") {

      if (
        message.interactive.type ===
        "button_reply"
      ) {

        await handleButton(
          from,
          message.interactive.button_reply.id
        );

        return res.sendStatus(200);
      }

      if (
        message.interactive.type ===
        "list_reply"
      ) {

        await handleList(
          from,
          message.interactive.list_reply.id
        );

        return res.sendStatus(200);
      }
    }

    return res.sendStatus(200);

  } catch (error) {

    console.error(
      "Webhook error:",
      error
    );

    return res.sendStatus(500);
  }

});

// =====================================================
// RESET
// =====================================================

function resetOrderingSession(session) {

  session.mode = null;
  session.category = null;
  session.item = null;
  session.variant = null;
  session.boneless = false;
  session.extraCheese = false;
  session.quantity = 1;
  session.cart = [];
  session.checkoutStep = null;
  session.customerName = "";
  session.address = "";
  session.latitude = null;
  session.longitude = null;
}

// =====================================================
// WELCOME
// =====================================================

async function sendWelcomeMessage(to) {

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          "Hey! Welcome to TREAT RESTAURANT 🍽️\n\n" +
          "What would you like to order?"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {
              id: "mode_veg",
              title: "VEG"
            }
          },

          {
            type: "reply",

            reply: {
              id: "mode_nonveg",
              title: "NON-VEG"
            }
          },

          {
            type: "reply",

            reply: {
              id: "mode_both",
              title: "VEG + NON-VEG"
            }
          }

        ]
      }
    }
  });
}

// =====================================================
// BUTTON HANDLER
// =====================================================

async function handleButton(to, id) {

  const session = getSession(to);

  // -----------------------------------------------
  // MODES
  // -----------------------------------------------

  if (id === "mode_veg") {

    session.mode = "VEG";

    await sendCategoryList(
      to,
      "VEG"
    );

    return;
  }

  if (id === "mode_nonveg") {

    session.mode = "NON-VEG";

    await sendCategoryList(
      to,
      "NON-VEG"
    );

    return;
  }

  if (id === "mode_both") {

    session.mode = "BOTH";

    await sendBothCategoryList(to);

    return;
  }

  // -----------------------------------------------
  // BACK
  // -----------------------------------------------

  if (id === "back_main") {

    await sendWelcomeMessage(to);

    return;
  }

  if (id === "back_categories") {

    if (session.mode === "BOTH") {

      await sendBothCategoryList(to);

    } else {

      await sendCategoryList(
        to,
        session.mode
      );

    }

    return;
  }

  // -----------------------------------------------
  // QUANTITY
  // -----------------------------------------------

  if (id === "qty_minus") {

    if (session.quantity > 1) {
      session.quantity--;
    }

    await sendQuantityScreen(to);

    return;
  }

  if (id === "qty_plus") {

    session.quantity++;

    await sendQuantityScreen(to);

    return;
  }

  // -----------------------------------------------
  // ADD CART
  // -----------------------------------------------

  if (id === "add_cart") {

    addCurrentItemToCart(session);

    await sendCart(to);

    return;
  }

  // -----------------------------------------------
  // MORE
  // -----------------------------------------------

  if (id === "add_more") {

    if (session.mode === "BOTH") {

      await sendBothCategoryList(to);

    } else {

      await sendCategoryList(
        to,
        session.mode
      );

    }

    return;
  }

  // -----------------------------------------------
  // CART
  // -----------------------------------------------

  if (id === "remove_mode") {

    await sendRemoveList(to);

    return;
  }

  if (id === "checkout") {

    await startCheckout(to);

    return;
  }

  // -----------------------------------------------
  // VARIANTS
  // -----------------------------------------------

  if (id === "variant_half") {

    session.variant = "HALF";

    await sendAddOnOptions(to);

    return;
  }

  if (id === "variant_full") {

    session.variant = "FULL";

    await sendAddOnOptions(to);

    return;
  }

  // -----------------------------------------------
  // BONELESS
  // -----------------------------------------------

  if (id === "boneless_yes") {

    session.boneless = true;

    await sendQuantityScreen(to);

    return;
  }

  if (id === "boneless_no") {

    session.boneless = false;

    await sendQuantityScreen(to);

    return;
  }

  // -----------------------------------------------
  // EXTRA CHEESE
  // -----------------------------------------------

  if (id === "cheese_yes") {

    session.extraCheese = true;

    await sendQuantityScreen(to);

    return;
  }

  if (id === "cheese_no") {

    session.extraCheese = false;

    await sendQuantityScreen(to);

    return;
  }

  // -----------------------------------------------
  // PAYMENT
  // -----------------------------------------------

  if (id === "payment_cod") {

    await confirmCOD(to);

    return;
  }

  if (id === "payment_online") {

    await sendText(
      to,
      "Online payment will be connected with Razorpay in the next step.\n\n" +
      "For now, please choose COD."
    );

    return;
  }
}

// =====================================================
// LIST HANDLER
// =====================================================

async function handleList(to, id) {

  const session = getSession(to);

  // -----------------------------------------------
  // CATEGORY
  // -----------------------------------------------

  if (id.startsWith("cat:")) {

    const data =
      id.replace("cat:", "");

    const parts =
      data.split("|");

    const type =
      parts[0];

    const category =
      parts.slice(1).join("|");

    session.category = category;
    session.currentType = type;

    await sendItemList(
      to,
      type,
      category
    );

    return;
  }

  // -----------------------------------------------
  // ITEM
  // -----------------------------------------------

  if (id.startsWith("item:")) {

    const index =
      Number(
        id.replace("item:", "")
      );

    const type =
      session.currentType;

    const items =
      MENU[type][session.category];

    if (!items[index]) return;

    session.item =
      items[index];

    session.variant = null;
    session.boneless = false;
    session.extraCheese = false;
    session.quantity = 1;

    const price =
      session.item[1];

    // Half / Full
    if (
      typeof price === "object" &&
      price.half &&
      price.full
    ) {

      await sendVariantButtons(to);

      return;
    }

    // Single price
    await sendAddOnOptions(to);

    return;
  }

  // -----------------------------------------------
  // ITEM PAGE
  // -----------------------------------------------

  if (id.startsWith("itempage:")) {

    const page =
      Number(
        id.replace("itempage:", "")
      );

    await sendItemList(
      to,
      session.currentType,
      session.category,
      page
    );

    return;
  }

  // -----------------------------------------------
  // CATEGORY PAGE
  // -----------------------------------------------

  if (id.startsWith("catpage:")) {

    const page =
      Number(
        id.replace("catpage:", "")
      );

    if (session.mode === "BOTH") {

      await sendBothCategoryList(
        to,
        page
      );

    } else {

      await sendCategoryList(
        to,
        session.mode,
        page
      );

    }

    return;
  }

  // -----------------------------------------------
  // REMOVE
  // -----------------------------------------------

  if (id.startsWith("remove:")) {

    const index =
      Number(
        id.replace("remove:", "")
      );

    if (session.cart[index]) {

      session.cart.splice(
        index,
        1
      );

    }

    await sendCart(to);

    return;
  }
}

// =====================================================
// CATEGORY LIST
// =====================================================

async function sendCategoryList(
  to,
  type,
  page = 0
) {

  const categories =
    Object.keys(
      MENU[type]
    );

  const rows =
    createCategoryRows(
      type,
      categories,
      page
    );

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "list",

      body: {

        text:
          `🍽️ ${type} MENU\n\n` +
          "Choose a category:"

      },

      action: {

        button:
          "VIEW CATEGORIES",

        sections: [

          {
            title:
              `${type} CATEGORIES`,

            rows
          }

        ]
      }
    }
  });
}

// =====================================================
// BOTH CATEGORY LIST
// =====================================================

async function sendBothCategoryList(
  to,
  page = 0
) {

  const rows = [];

  const vegCategories =
    Object.keys(
      MENU.VEG
    );

  const nonVegCategories =
    Object.keys(
      MENU.NON_VEG
    );

  const commonCategories =
    Object.keys(
      MENU.COMMON
    );

  vegCategories.forEach(
    category => {

      rows.push({

        id:
          `cat:VEG|${category}`,

        title:
          `VEG - ${category}`
            .substring(0, 24),

        description:
          "Vegetarian items"

      });

    }
  );

  nonVegCategories.forEach(
    category => {

      rows.push({

        id:
          `cat:NON_VEG|${category}`,

        title:
          `NON-VEG - ${category}`
            .substring(0, 24),

        description:
          "Non-vegetarian items"

      });

    }
  );

  commonCategories.forEach(
    category => {

      rows.push({

        id:
          `cat:COMMON|${category}`,

        title:
          category
            .substring(0, 24),

        description:
          "Available for all orders"

      });

    }
  );

  const PAGE_SIZE = 9;

  const start =
    page * PAGE_SIZE;

  const pageRows =
    rows.slice(
      start,
      start + PAGE_SIZE
    );

  if (
    start + PAGE_SIZE <
    rows.length
  ) {

    pageRows.push({

      id:
        `catpage:${page + 1}`,

      title:
        "MORE CATEGORIES",

      description:
        "View more categories"

    });

  }

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "list",

      body: {

        text:
          "🍽️ VEG + NON-VEG MENU\n\n" +
          "You can add items from both menus."

      },

      action: {

        button:
          "VIEW CATEGORIES",

        sections: [

          {
            title:
              "COMBINED MENU",

            rows:
              pageRows
          }

        ]
      }
    }
  });
}

// =====================================================
// CATEGORY ROW HELPER
// =====================================================

function createCategoryRows(
  type,
  categories,
  page
) {

  const PAGE_SIZE = 9;

  const start =
    page * PAGE_SIZE;

  const rows =
    categories
      .slice(
        start,
        start + PAGE_SIZE
      )
      .map(category => ({

        id:
          `cat:${type}|${category}`,

        title:
          category.substring(
            0,
            24
          ),

        description:
          `View ${category}`

      }));

  if (
    start + PAGE_SIZE <
    categories.length
  ) {

    rows.push({

      id:
        `catpage:${page + 1}`,

      title:
        "MORE CATEGORIES",

      description:
        "View more categories"

    });

  }

  return rows;
}

// =====================================================
// ITEM LIST
// =====================================================

async function sendItemList(
  to,
  type,
  category,
  page = 0
) {

  const items =
    MENU[type][category];

  const PAGE_SIZE = 9;

  const start =
    page * PAGE_SIZE;

  const rows =
    items
      .slice(
        start,
        start + PAGE_SIZE
      )
      .map(
        (item, index) => {

          const actualIndex =
            start + index;

          let description;

          if (
            typeof item[1] ===
            "object"
          ) {

            description =
              `Half ₹${item[1].half} | Full ₹${item[1].full}`;

          } else {

            description =
              `₹${item[1]}`;

          }

          return {

            id:
              `item:${actualIndex}`,

            title:
              item[0].substring(
                0,
                24
              ),

            description:
              description.substring(
                0,
                72
              )

          };
        }
      );

  if (
    start + PAGE_SIZE <
    items.length
  ) {

    rows.push({

      id:
        `itempage:${page + 1}`,

      title:
        "MORE ITEMS",

      description:
        "View more items"

    });

  }

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "list",

      body: {

        text:
          `🍽️ ${category}\n\n` +
          "Select your food:"

      },

      action: {

        button:
          "VIEW FOOD",

        sections: [

          {
            title:
              category,

            rows
          }

        ]
      }
    }
  });
}

// =====================================================
// HALF / FULL
// =====================================================

async function sendVariantButtons(to) {

  const session =
    getSession(to);

  const item =
    session.item;

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          `🍽️ ${item[0]}\n\n` +
          "Choose plate size:"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {

              id:
                "variant_half",

              title:
                `HALF ₹${item[1].half}`

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "variant_full",

              title:
                `FULL ₹${item[1].full}`

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "back_categories",

              title:
                "BACK"

            }
          }

        ]
      }
    }
  });
}

// =====================================================
// ADD-ON OPTIONS
// =====================================================

async function sendAddOnOptions(to) {

  const session =
    getSession(to);

  const item =
    session.item;

  const price =
    item[1];

  // Boneless option
  if (
    session.currentType ===
      "NON_VEG" &&
    session.category ===
      "MAIN COURSE" &&
    typeof price ===
      "object" &&
    price.boneless
  ) {

    await sendWhatsAppMessage(to, {

      messaging_product: "whatsapp",

      recipient_type: "individual",

      to,

      type: "interactive",

      interactive: {

        type: "button",

        body: {

          text:
            `🍗 ${item[0]}\n\n` +
            "Would you like Boneless?\n" +
            "+₹50"

        },

        action: {

          buttons: [

            {
              type: "reply",

              reply: {

                id:
                  "boneless_yes",

                title:
                  "BONELESS +₹50"

              }
            },

            {
              type: "reply",

              reply: {

                id:
                  "boneless_no",

                title:
                  "REGULAR"

              }
            },

            {
              type: "reply",

              reply: {

                id:
                  "back_categories",

                title:
                  "BACK"

              }
            }

          ]
        }
      }
    });

    return;
  }

  // Pizza extra cheese
  if (
    session.category ===
      "PIZZA"
  ) {

    await sendWhatsAppMessage(to, {

      messaging_product: "whatsapp",

      recipient_type: "individual",

      to,

      type: "interactive",

      interactive: {

        type: "button",

        body: {

          text:
            `🍕 ${item[0]}\n\n` +
            "Add Extra Cheese?\n" +
            "+₹30"

        },

        action: {

          buttons: [

            {
              type: "reply",

              reply: {

                id:
                  "cheese_yes",

                title:
                  "YES +₹30"

              }
            },

            {
              type: "reply",

              reply: {

                id:
                  "cheese_no",

                title:
                  "NO"

              }
            },

            {
              type: "reply",

              reply: {

                id:
                  "back_categories",

                title:
                  "BACK"

              }
            }

          ]
        }
      }
    });

    return;
  }

  await sendQuantityScreen(to);
}

// =====================================================
// PRICE CALCULATION
// =====================================================

function getCurrentUnitPrice(session) {

  const item =
    session.item;

  const base =
    item[1];

  let price;

  if (
    typeof base ===
    "object"
  ) {

    price =
      session.variant ===
      "HALF"
        ? base.half
        : base.full;

  } else {

    price = base;

  }

  if (
    session.boneless
  ) {

    price += 50;

  }

  if (
    session.extraCheese
  ) {

    price += 30;

  }

  return price;
}

// =====================================================
// QUANTITY
// =====================================================

async function sendQuantityScreen(to) {

  const session =
    getSession(to);

  const unitPrice =
    getCurrentUnitPrice(
      session
    );

  const total =
    unitPrice *
    session.quantity;

  let details = "";

  if (
    session.variant
  ) {

    details +=
      `\nSize: ${session.variant}`;

  }

  if (
    session.boneless
  ) {

    details +=
      "\nBoneless: +₹50";

  }

  if (
    session.extraCheese
  ) {

    details +=
      "\nExtra Cheese: +₹30";

  }

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          `🍽️ ${session.item[0]}` +
          details +
          `\n\nUnit Price: ₹${unitPrice}` +
          `\nQuantity: ${session.quantity}` +
          `\nTotal: ₹${total}` +
          "\n\nChoose quantity:"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {

              id:
                "qty_minus",

              title:
                "−"

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "qty_plus",

              title:
                "+"

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "add_cart",

              title:
                "ADD TO CART"

            }
          }

        ]
      }
    }
  });
}

// =====================================================
// ADD TO CART
// =====================================================

function addCurrentItemToCart(
  session
) {

  const price =
    getCurrentUnitPrice(
      session
    );

  const options = [];

  if (
    session.variant
  ) {

    options.push(
      session.variant
    );

  }

  if (
    session.boneless
  ) {

    options.push(
      "Boneless"
    );

  }

  if (
    session.extraCheese
  ) {

    options.push(
      "Extra Cheese"
    );

  }

  session.cart.push({

    name:
      session.item[0],

    options,

    price,

    quantity:
      session.quantity

  });

  session.item = null;
  session.variant = null;
  session.boneless = false;
  session.extraCheese = false;
  session.quantity = 1;
}

// =====================================================
// CART
// =====================================================

function getFoodSubtotal(
  session
) {

  return session.cart.reduce(
    (
      total,
      item
    ) =>
      total +
      item.price *
        item.quantity,
    0
  );
}

async function sendCart(to) {

  const session =
    getSession(to);

  if (
    session.cart.length ===
    0
  ) {

    await sendWhatsAppMessage(
      to,
      {

        messaging_product:
          "whatsapp",

        recipient_type:
          "individual",

        to,

        type:
          "interactive",

        interactive: {

          type:
            "button",

          body: {

            text:
              "🛒 Your cart is empty."

          },

          action: {

            buttons: [

              {
                type:
                  "reply",

                reply: {

                  id:
                    "add_more",

                  title:
                    "VIEW MENU"

                }
              },

              {
                type:
                  "reply",

                reply: {

                  id:
                    "back_main",

                  title:
                    "BACK"

                }
              }

            ]
          }
        }
      }
    );

    return;
  }

  let text =
    "🛒 YOUR CART\n\n";

  let subtotal = 0;

  session.cart.forEach(
    (
      item,
      index
    ) => {

      const total =
        item.price *
        item.quantity;

      subtotal += total;

      const options =
        item.options.length
          ? ` (${item.options.join(", ")})`
          : "";

      text +=
        `${index + 1}. ${item.name}${options}\n` +
        `   ₹${item.price} × ${item.quantity} = ₹${total}\n\n`;

    }
  );

  text +=
    `Food Subtotal: ₹${subtotal}`;

  await sendWhatsAppMessage(
    to,
    {

      messaging_product:
        "whatsapp",

      recipient_type:
        "individual",

      to,

      type:
        "interactive",

      interactive: {

        type:
          "button",

        body: {
          text
        },

        action: {

          buttons: [

            {
              type:
                "reply",

              reply: {

                id:
                  "add_more",

                title:
                  "ADD MORE"

              }
            },

            {
              type:
                "reply",

              reply: {

                id:
                  "remove_mode",

                title:
                  "REMOVE"

              }
            },

            {
              type:
                "reply",

              reply: {

                id:
                  "checkout",

                title:
                  "CHECKOUT"

              }
            }

          ]
        }
      }
    }
  );
}

// =====================================================
// REMOVE LIST
// =====================================================

async function sendRemoveList(
  to
) {

  const session =
    getSession(to);

  const rows =
    session.cart
      .map(
        (
          item,
          index
        ) => {

          const options =
            item.options.length
              ? ` (${item.options.join(", ")})`
              : "";

          return {

            id:
              `remove:${index}`,

            title:
              `${index + 1}. ${item.name}`
                .substring(
                  0,
                  24
                ),

            description:
              `${options} × ${item.quantity} — ₹${item.price * item.quantity}`

          };

        }
      )
      .slice(
        0,
        10
      );

  await sendWhatsAppMessage(
    to,
    {

      messaging_product:
        "whatsapp",

      recipient_type:
        "individual",

      to,

      type:
        "interactive",

      interactive: {

        type:
          "list",

        body: {

          text:
            "🗑️ REMOVE ITEM\n\n" +
            "Select the item to remove."

        },

        action: {

          button:
            "REMOVE ITEM",

          sections: [

            {
              title:
                "YOUR CART",

              rows
            }

          ]
        }
      }
    }
  );
}

// =====================================================
// CHECKOUT START
// =====================================================

async function startCheckout(
  to
) {

  const session =
    getSession(to);

  const subtotal =
    getFoodSubtotal(
      session
    );

  if (
    subtotal < 300
  ) {

    await sendText(
      to,
      `Minimum food order is ₹300.\n\n` +
      `Your current food subtotal is ₹${subtotal}.\n\n` +
      `Please add ₹${300 - subtotal} more food items.`
    );

    return;
  }

  session.checkoutStep =
    "name";

  await sendText(
    to,
    "CHECKOUT\n\nPlease enter your name."
  );
}

// =====================================================
// LOCATION REQUEST
// =====================================================

async function sendLocationRequest(
  to
) {

  await sendWhatsAppMessage(
    to,
    {

      messaging_product:
        "whatsapp",

      recipient_type:
        "individual",

      to,

      type:
        "interactive",

      interactive: {

        type:
          "location_request_message",

        body: {

          text:
            "Please share your delivery location so we can calculate delivery charges."

        },

        action: {

          name:
            "send_location"

        }
      }
    }
  );
}

// =====================================================
// DISTANCE
// =====================================================

function calculateDistanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {

  const R =
    6371;

  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      dLat / 2
    ) ** 2 +
    Math.cos(
      toRadians(lat1)
    ) *
    Math.cos(
      toRadians(lat2)
    ) *
    Math.sin(
      dLon / 2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

function toRadians(
  degrees
) {

  return degrees *
    Math.PI /
    180;
}

// =====================================================
// DELIVERY CHARGE
// =====================================================

function getDeliveryCharge(
  distance
) {

  for (
    const rule
    of DELIVERY_RULES
  ) {

    if (
      distance <=
      rule.max
    ) {

      return rule.charge;

    }
  }

  return null;
}

// =====================================================
// CHECKOUT SUMMARY
// =====================================================

async function sendCheckoutSummary(
  to
) {

  const session =
    getSession(to);

  const subtotal =
    getFoodSubtotal(
      session
    );

  const packing =
    Math.round(
      subtotal * 0.07
    );

  const distance =
    calculateDistanceKm(
      RESTAURANT_LAT,
      RESTAURANT_LNG,
      session.latitude,
      session.longitude
    );

  const delivery =
    getDeliveryCharge(
      distance
    );

  if (
    delivery === null
  ) {

    await sendText(
      to,

      "Sorry, TREAT RESTAURANT delivers only within 10 km.\n\n" +
      `Your location is approximately ${distance.toFixed(2)} km away.\n\n` +
      "Please use a delivery location within 10 km."
    );

    session.checkoutStep =
      "location";

    await sendLocationRequest(
      to
    );

    return;
  }

  const total =
    subtotal +
    packing +
    delivery;

  let items =
    "";

  session.cart.forEach(
    item => {

      const options =
        item.options.length
          ? ` (${item.options.join(", ")})`
          : "";

      items +=
        `${item.name}${options} × ${item.quantity}\n` +
        `₹${item.price * item.quantity}\n\n`;

    }
  );

  const summary =
    `🧾 CHECKOUT\n\n` +

    `${items}` +

    `Food Subtotal: ₹${subtotal}\n` +
    `Packing (7%): ₹${packing}\n` +
    `Delivery: ₹${delivery}\n` +
    `Distance: ${distance.toFixed(2)} km\n\n` +

    `TOTAL: ₹${total}\n\n` +

    `Name: ${session.customerName}\n` +
    `Address: ${session.address}\n\n` +

    "Choose payment method:";

  await sendWhatsAppMessage(
    to,
    {

      messaging_product:
        "whatsapp",

      recipient_type:
        "individual",

      to,

      type:
        "interactive",

      interactive: {

        type:
          "button",

        body: {
          text:
            summary
        },

        action: {

          buttons: [

            {
              type:
                "reply",

              reply: {

                id:
                  "payment_cod",

                title:
                  "COD"

              }
            },

            {
              type:
                "reply",

              reply: {

                id:
                  "payment_online",

                title:
                  "PAY ONLINE"

              }
            },

            {
              type:
                "reply",

              reply: {

                id:
                  "back_categories",

                title:
                  "BACK"

              }
            }

          ]
        }
      }
    }
  );
}

// =====================================================
// COD CONFIRMATION
// =====================================================

async function confirmCOD(
  to
) {

  const session =
    getSession(to);

  const subtotal =
    getFoodSubtotal(
      session
    );

  const packing =
    Math.round(
      subtotal * 0.07
    );

  const distance =
    calculateDistanceKm(
      RESTAURANT_LAT,
      RESTAURANT_LNG,
      session.latitude,
      session.longitude
    );

  const delivery =
    getDeliveryCharge(
      distance
    );

  if (
    delivery === null
  ) {

    await sendText(
      to,
      "Delivery is unavailable for this location because it is beyond 10 km."
    );

    return;
  }

  const total =
    subtotal +
    packing +
    delivery;

  const orderId =
    "TR" +
    Math.floor(
      1000 +
      Math.random() *
      9000
    );

  await sendText(
    to,

    `✅ ORDER RECEIVED\n\n` +

    `Order ID: ${orderId}\n` +
    `Payment: COD\n\n` +

    `Food: ₹${subtotal}\n` +
    `Packing: ₹${packing}\n` +
    `Delivery: ₹${delivery}\n` +
    `TOTAL: ₹${total}\n\n` +

    `Thank you for ordering from TREAT RESTAURANT!\n` +
    `Your order has been sent to the restaurant.`
  );

  // Clear cart after order
  session.cart = [];
  session.checkoutStep = null;
}

// =====================================================
// TEXT SENDER
// =====================================================

async function sendText(
  to,
  text
) {

  await sendWhatsAppMessage(
    to,
    {

      messaging_product:
        "whatsapp",

      recipient_type:
        "individual",

      to,

      type:
        "text",

      text: {
        body: text
      }
    }
  );
}

// =====================================================
// WHATSAPP API
// =====================================================

async function sendWhatsAppMessage(
  to,
  message
) {

  const url =
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const response =
    await fetch(
      url,
      {

        method:
          "POST",

        headers: {

          "Authorization":
            `Bearer ${ACCESS_TOKEN}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(
            message
          )

      }
    );

  const data =
    await response.json();

  console.log(
    "WhatsApp API response:",
    JSON.stringify(
      data,
      null,
      2
    )
  );

  if (
    !response.ok
  ) {

    throw new Error(
      `WhatsApp API error: ${JSON.stringify(data)}`
    );

  }

  return data;
}

// =====================================================
// SERVER
// =====================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `TREAT RESTAURANT bot running on port ${PORT}`
    );

  }
);
