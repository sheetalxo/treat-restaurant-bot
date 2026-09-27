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
        ?.value?.messages?.[0];

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

      // Customer entering direct quantity
      if (session.checkoutStep === "quantity") {

        const quantity = Number(text);

        if (
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {

          await sendText(
            from,
            "Please enter a valid quantity, for example: 4, 10 or 20."
          );

          return res.sendStatus(200);
        }

        session.quantity = quantity;
        session.checkoutStep = null;

        await sendQuantityScreen(from);

        return res.sendStatus(200);
      }

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
  // ENTER QUANTITY
  // -----------------------------------------------

  if (id === "enter_quantity") {

    session.checkoutStep = "quantity";

    await sendText(
      to,
      "Please enter the quantity."
    );

    return;
  }
          sections: [

          {
            title:
              category.substring(
                0,
                24
              ),

            rows
          }

        ]
      }
    }
  });
}

// =====================================================
// VARIANT BUTTONS
// =====================================================

async function sendVariantButtons(to) {

  const session =
    getSession(to);

  const item =
    session.item;

  const price =
    item[1];

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
          `Half ₹${price.half}\n` +
          `Full ₹${price.full}\n\n` +
          "Please select a size:"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {
              id: "variant_half",
              title: "HALF"
            }
          },

          {
            type: "reply",

            reply: {
              id: "variant_full",
              title: "FULL"
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

  if (!item) {
    return;
  }

  const itemName =
    item[0];

  const category =
    session.category;

  const isNonVegMainCourse =
    session.currentType === "NON_VEG" &&
    category === "MAIN COURSE";

  const isPizza =
    category === "PIZZA";

  // -----------------------------------------------
  // BONELESS OPTION
  // -----------------------------------------------

  if (isNonVegMainCourse) {

    await sendWhatsAppMessage(to, {

      messaging_product: "whatsapp",

      recipient_type: "individual",

      to,

      type: "interactive",

      interactive: {

        type: "button",

        body: {

          text:
            `${itemName}\n\n` +
            "Would you like Boneless?\n\n" +
            "Boneless: +₹50"

        },

        action: {

          buttons: [

            {
              type: "reply",

              reply: {
                id: "boneless_yes",
                title: "BONELESS +₹50"
              }
            },

            {
              type: "reply",

              reply: {
                id: "boneless_no",
                title: "REGULAR"
              }
            }

          ]
        }
      }
    });

    return;
  }

  // -----------------------------------------------
  // EXTRA CHEESE
  // -----------------------------------------------

  if (isPizza) {

    await sendWhatsAppMessage(to, {

      messaging_product: "whatsapp",

      recipient_type: "individual",

      to,

      type: "interactive",

      interactive: {

        type: "button",

        body: {

          text:
            `${itemName}\n\n` +
            "Would you like extra cheese?\n\n" +
            "Extra Cheese: +₹30"

        },

        action: {

          buttons: [

            {
              type: "reply",

              reply: {
                id: "cheese_yes",
                title: "EXTRA CHEESE +₹30"
              }
            },

            {
              type: "reply",

              reply: {
                id: "cheese_no",
                title: "NO CHEESE"
              }
            }

          ]
        }
      }
    });

    return;
  }

  // -----------------------------------------------
  // NO ADD-ON
  // -----------------------------------------------

  await sendQuantityScreen(to);
}

// =====================================================
// QUANTITY SCREEN
// =====================================================

async function sendQuantityScreen(to) {

  const session =
    getSession(to);

  const item =
    session.item;

  if (!item) {
    return;
  }

  const unitPrice =
    getCurrentUnitPrice(session);

  const quantity =
    session.quantity || 1;

  const total =
    unitPrice * quantity;

  // -----------------------------------------------
  // QUANTITY CONTROLS
  // -----------------------------------------------

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
          `Quantity: ${quantity}\n` +
          `Price: ₹${unitPrice}\n` +
          `Total: ₹${total}`

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {
              id: "qty_minus",
              title: "−"
            }
          },

          {
            type: "reply",

            reply: {
              id: "qty_plus",
              title: "+"
            }
          }

        ]
      }
    }
  });

  // -----------------------------------------------
  // ENTER QUANTITY
  // -----------------------------------------------

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          "Want to enter the quantity manually?"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {

              id:
                "enter_quantity",

              title:
                "ENTER QUANTITY"

            }
          }

        ]
      }
    }
  });

  // -----------------------------------------------
  // ADD TO CART
  // -----------------------------------------------

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          "Ready to add this item to your cart?"

      },

      action: {

        buttons: [

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
// CURRENT UNIT PRICE
// =====================================================

function getCurrentUnitPrice(session) {

  if (!session.item) {
    return 0;
  }

  const price =
    session.item[1];

  let unitPrice;

  // -----------------------------------------------
  // OBJECT PRICE
  // -----------------------------------------------

  if (
    typeof price === "object"
  ) {

    if (
      session.variant === "HALF"
    ) {

      unitPrice =
        price.half;

    } else if (
      session.variant === "FULL"
    ) {

      unitPrice =
        price.full;

    } else {

      unitPrice =
        price.half ||
        price.full ||
        0;

    }

  } else {

    unitPrice =
      price;
  }

  // -----------------------------------------------
  // BONELESS
  // -----------------------------------------------

  if (
    session.boneless
  ) {

    unitPrice += 50;

  }

  // -----------------------------------------------
  // EXTRA CHEESE
  // -----------------------------------------------

  if (
    session.extraCheese
  ) {

    unitPrice += 30;

  }

  return unitPrice;
}

// =====================================================
// ADD CURRENT ITEM TO CART
// =====================================================

function addCurrentItemToCart(session) {

  if (!session.item) {
    return;
  }

  const unitPrice =
    getCurrentUnitPrice(session);

  const quantity =
    session.quantity || 1;

  const cartItem = {

    name:
      session.item[0],

    category:
      session.category,

    type:
      session.currentType,

    variant:
      session.variant,

    boneless:
      session.boneless,

    extraCheese:
      session.extraCheese,

    quantity,

    unitPrice,

    total:
      unitPrice * quantity

  };

  session.cart.push(
    cartItem
  );

  // Reset current item

  session.item = null;

  session.variant = null;

  session.boneless = false;

  session.extraCheese = false;

  session.quantity = 1;

  session.checkoutStep = null;
}

// =====================================================
// CART
// =====================================================

async function sendCart(to) {

  const session =
    getSession(to);

  if (
    !session.cart ||
    session.cart.length === 0
  ) {

    await sendText(
      to,
      "Your cart is empty."
    );

    return;
  }

  let subtotal = 0;

  let lines = [];

  session.cart.forEach(
    (item, index) => {

      subtotal +=
        item.total;

      let options = [];

      if (item.variant) {

        options.push(
          item.variant
        );

      }

      if (item.boneless) {

        options.push(
          "Boneless +₹50"
        );

      }

      if (item.extraCheese) {

        options.push(
          "Extra Cheese +₹30"
        );

      }

      const optionText =
        options.length
          ? ` (${options.join(", ")})`
          : "";

      lines.push(
        `${index + 1}. ${item.name}${optionText}\n` +
        `   Qty: ${item.quantity} × ₹${item.unitPrice} = ₹${item.total}`
      );

    }
  );

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          "🛒 YOUR CART\n\n" +
          lines.join("\n\n") +
          "\n\n" +
          `Food Subtotal: ₹${subtotal}\n\n` +
          "Minimum food order: ₹300"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {

              id:
                "checkout",

              title:
                "CHECKOUT"

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "add_more",

              title:
                "ADD MORE"

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "remove_mode",

              title:
                "REMOVE ITEM"

            }
          }

        ]
      }
    }
  });
}

// =====================================================
// REMOVE CART ITEM
// =====================================================

async function sendRemoveList(to) {

  const session =
    getSession(to);

  if (
    !session.cart ||
    session.cart.length === 0
  ) {

    await sendText(
      to,
      "Your cart is empty."
    );

    return;
  }

  const rows =
    session.cart.map(
      (item, index) => ({

        id:
          `remove:${index}`,

        title:
          `${index + 1}. ${item.name}`
            .substring(0, 24),

        description:
          `Qty ${item.quantity} • ₹${item.total}`

      })
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
          "Which item would you like to remove?"

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
  });
}

// =====================================================
// CHECKOUT
// =====================================================

async function startCheckout(to) {

  const session =
    getSession(to);

  if (
    !session.cart ||
    session.cart.length === 0
  ) {

    await sendText(
      to,
      "Your cart is empty."
    );

    return;
  }

  const subtotal =
    session.cart.reduce(
      (sum, item) =>
        sum + item.total,
      0
    );

  if (subtotal < 300) {

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
    "Please enter your name."
  );
}

// =====================================================
// LOCATION REQUEST
// =====================================================

async function sendLocationRequest(to) {

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          "Please share your current delivery location using WhatsApp location sharing.\n\n" +
          "This is required to calculate your delivery charge."

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {

              id:
                "share_location",

              title:
                "SHARE LOCATION"

            }
          }

        ]
      }
    }
  });
}

// =====================================================
// DISTANCE CALCULATION
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
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +

    Math.cos(
      toRadians(lat1)
    ) *

    Math.cos(
      toRadians(lat2)
    ) *

    Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return R * c;
}

function toRadians(degrees) {

  return (
    degrees *
    Math.PI /
    180
  );

}

// =====================================================
// DELIVERY CHARGE
// =====================================================

function getDeliveryCharge(
  distanceKm
) {

  for (
    const rule of DELIVERY_RULES
  ) {

    if (
      distanceKm <= rule.max
    ) {

      return rule.charge;

    }
  }

  return null;
}

// =====================================================
// CHECKOUT SUMMARY
// =====================================================

async function sendCheckoutSummary(to) {

  const session =
    getSession(to);

  const subtotal =
    session.cart.reduce(
      (sum, item) =>
        sum + item.total,
      0
    );

  const packing =
    Math.round(
      subtotal * 0.07
    );

  const distance =
    calculateDistanceKm(
      RESTAURANT_LAT,
      RESTAURANT_LNG,
      Number(session.latitude),
      Number(session.longitude)
    );

  const delivery =
    getDeliveryCharge(
      distance
    );

  if (delivery === null) {

    await sendText(
      to,
      `Sorry, your location is ${distance.toFixed(2)} km away from TREAT RESTAURANT.\n\n` +
      "Delivery is available only up to 10 km."
    );

    session.checkoutStep =
      null;

    return;
  }

  const total =
    subtotal +
    packing +
    delivery;

  session.checkoutTotal =
    total;

  session.checkoutSubtotal =
    subtotal;

  session.checkoutPacking =
    packing;

  session.checkoutDelivery =
    delivery;

  session.checkoutDistance =
    distance;

  const cartText =
    session.cart
      .map(
        (item, index) =>
          `${index + 1}. ${item.name} × ${item.quantity} = ₹${item.total}`
      )
      .join("\n");

  await sendWhatsAppMessage(to, {

    messaging_product: "whatsapp",

    recipient_type: "individual",

    to,

    type: "interactive",

    interactive: {

      type: "button",

      body: {

        text:
          "🧾 ORDER SUMMARY\n\n" +

          cartText +

          "\n\n" +

          `Food Subtotal: ₹${subtotal}\n` +

          `Packing (7%): ₹${packing}\n` +

          `Delivery (${distance.toFixed(2)} km): ₹${delivery}\n` +

          `\nTOTAL: ₹${total}\n\n` +

          `Name: ${session.customerName}\n` +

          `Address: ${session.address}\n\n` +

          "Choose payment method:"

      },

      action: {

        buttons: [

          {
            type: "reply",

            reply: {

              id:
                "payment_cod",

              title:
                "COD"

            }
          },

          {
            type: "reply",

            reply: {

              id:
                "payment_online",

              title:
                "ONLINE PAYMENT"

            }
          }

        ]
      }
    }
  });
}

// =====================================================
// COD CONFIRMATION
// =====================================================

async function confirmCOD(to) {

  const session =
    getSession(to);

  const orderId =
    generateOrderId();

  session.orderId =
    orderId;

  await sendText(
    to,
    "✅ ORDER CONFIRMED\n\n" +

    `Order ID: ${orderId}\n` +

    `Name: ${session.customerName}\n` +

    `Total: ₹${session.checkoutTotal}\n\n` +

    "Payment Method: COD\n\n" +

    "Thank you for ordering from TREAT RESTAURANT!"
  );

  // Order can be connected to PDF invoice
  // and thermal printer in the next step.

  session.checkoutStep =
    null;
}

// =====================================================
// ORDER ID
// =====================================================

function generateOrderId() {

  const random =
    Math.floor(
      1000 +
      Math.random() *
      9000
    );

  return `TR${random}`;
}

// =====================================================
// WHATSAPP SEND
// =====================================================

async function sendWhatsAppMessage(
  to,
  message
) {

  if (
    !ACCESS_TOKEN ||
    !PHONE_NUMBER_ID
  ) {

    console.log(
      "WhatsApp credentials missing.",
      message
    );

    return;
  }

  const response =
    await fetch(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {

        method: "POST",

        headers: {

          "Authorization":
            `Bearer ${ACCESS_TOKEN}`,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify(message)

      }
    );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      "WhatsApp API error:",
      data
    );

  }

  return data;
}

// =====================================================
// SEND TEXT
// =====================================================

async function sendText(
  to,
  text
) {

  return sendWhatsAppMessage(
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

        body:
          text

      }

    }
  );
}

// =====================================================
// START SERVER
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
// =====================================================
// PART 3
// =====================================================

// WhatsApp webhook + message routing
// Continue directly after PART 2

async function handleList(to, id) {

  const session = getSession(to);

  // -----------------------------------------------
  // BACK TO MAIN MENU
  // -----------------------------------------------

  if (id === "back_main") {

    await sendWelcomeMessage(to);

    return;
  }

  // -----------------------------------------------
  // BACK TO CATEGORY MENU
  // -----------------------------------------------

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
  // CATEGORY PAGE
  // -----------------------------------------------

  if (id.startsWith("catpage:")) {

    const page =
      Number(
        id.split(":")[1]
      );

    if (
      session.mode === "BOTH"
    ) {

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
  // CATEGORY SELECTION
  // -----------------------------------------------

  if (id.startsWith("cat:")) {

    const parts =
      id.split("|");

    const type =
      parts[0].replace(
        "cat:",
        ""
      );

    const category =
      parts[1];

    session.currentType =
      type;

    session.category =
      category;

    session.itemPage =
      0;

    await sendItemList(
      to,
      type,
      category,
      0
    );

    return;
  }

  // -----------------------------------------------
  // ITEM PAGE
  // -----------------------------------------------

  if (id.startsWith("itempage:")) {

    const page =
      Number(
        id.split(":")[1]
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
  // ITEM SELECTION
  // -----------------------------------------------

  if (id.startsWith("item:")) {

    const index =
      Number(
        id.split(":")[1]
      );

    const type =
      session.currentType;

    const category =
      session.category;

    const menu =
      MENU[type];

    if (
      !menu ||
      !menu[category]
    ) {

      await sendText(
        to,
        "Sorry, this item is currently unavailable."
      );

      return;
    }

    const item =
      menu[category][index];

    if (!item) {

      await sendText(
        to,
        "Sorry, this item could not be found."
      );

      return;
    }

    session.item =
      item;

    session.variant =
      null;

    session.boneless =
      false;

    session.extraCheese =
      false;

    session.quantity =
      1;

    session.checkoutStep =
      null;

    // ---------------------------------------------
    // HALF / FULL
    // ---------------------------------------------

    if (
      typeof item[1] === "object" &&
      (
        item[1].half !== undefined ||
        item[1].full !== undefined
      )
    ) {

      await sendVariantButtons(
        to
      );

      return;
    }

    // ---------------------------------------------
    // ADD-ONS
    // ---------------------------------------------

    await sendAddOnOptions(
      to
    );

    return;
  }

  // -----------------------------------------------
  // REMOVE ITEM
  // -----------------------------------------------

  if (
    id.startsWith("remove:")
  ) {

    const index =
      Number(
        id.split(":")[1]
      );

    if (
      Number.isNaN(index) ||
      !session.cart[index]
    ) {

      await sendText(
        to,
        "Sorry, that cart item was not found."
      );

      return;
    }

    const removed =
      session.cart.splice(
        index,
        1
      )[0];

    await sendText(
      to,
      `Removed ${removed.name} from your cart.`
    );

    if (
      session.cart.length === 0
    ) {

      await sendText(
        to,
        "Your cart is now empty."
      );

      return;
    }

    await sendCart(to);

    return;
  }

  // -----------------------------------------------
  // UNKNOWN LIST ACTION
  // -----------------------------------------------

  console.log(
    "Unknown list id:",
    id
  );
}

// =====================================================
// CATEGORY LIST
// =====================================================

async function sendCategoryList(
  to,
  type,
  page = 0
) {

  const session =
    getSession(to);

  const menuType =
    type === "NON-VEG"
      ? "NON_VEG"
      : "VEG";

  const categories =
    Object.keys(
      MENU[menuType]
    );

  const PAGE_SIZE =
    7;

  const totalPages =
    Math.ceil(
      categories.length /
      PAGE_SIZE
    );

  if (
    page < 0
  ) {
    page = 0;
  }

  if (
    page >= totalPages
  ) {

    page =
      totalPages - 1;

  }

  const start =
    page * PAGE_SIZE;

  const pageCategories =
    categories.slice(
      start,
      start + PAGE_SIZE
    );

  const rows =
    pageCategories.map(
      (category) => ({

        id:
          `cat:${menuType}|${category}`,

        title:
          category.substring(
            0,
            24
          ),

        description:
          `View ${category.toLowerCase()}`
      })
    );

  // -----------------------------------------------
  // PREVIOUS CATEGORY
  // -----------------------------------------------

  if (
    page > 0
  ) {

    rows.push({

      id:
        `catpage:${page - 1}`,

      title:
        "PREVIOUS CATEGORY",

      description:
        "Go to previous categories"

    });

  }

  // -----------------------------------------------
  // MORE CATEGORIES
  // -----------------------------------------------

  if (
    page + 1 < totalPages
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

  // -----------------------------------------------
  // BACK
  // -----------------------------------------------

  rows.push({

    id:
      "back_main",

    title:
      "BACK",

    description:
      "Back to VEG / NON-VEG"

  });

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

        header: {

          type:
            "text",

          text:
            type === "NON-VEG"
              ? "NON-VEG MENU"
              : "VEG MENU"

        },

        body: {

          text:
            "Please select a category."

        },

        action: {

          button:
            "VIEW CATEGORIES",

          sections: [

            {

              title:
                type === "NON-VEG"
                  ? "NON-VEG CATEGORIES"
                  : "VEG CATEGORIES",

              rows

            }

          ]

        }

      }

    }
  );
}

// =====================================================
// COMBINED VEG + NON-VEG CATEGORY LIST
// =====================================================

async function sendBothCategoryList(
  to,
  page = 0
) {

  const categories = [];

  // VEG categories

  Object.keys(
    MENU.VEG
  ).forEach(
    category => {

      categories.push({

        type:
          "VEG",

        category

      });

    }
  );

  // NON-VEG categories

  Object.keys(
    MENU.NON_VEG
  ).forEach(
    category => {

      categories.push({

        type:
          "NON_VEG",

        category

      });

    }
  );

  // COMMON categories

  Object.keys(
    MENU.COMMON
  ).forEach(
    category => {

      categories.push({

        type:
          "COMMON",

        category

      });

    }
  );

  const PAGE_SIZE =
    7;

  const totalPages =
    Math.ceil(
      categories.length /
      PAGE_SIZE
    );

  if (
    page < 0
  ) {

    page = 0;

  }

  if (
    page >= totalPages
  ) {

    page =
      totalPages - 1;

  }

  const start =
    page * PAGE_SIZE;

  const current =
    categories.slice(
      start,
      start + PAGE_SIZE
    );

  const rows =
    current.map(
      entry => ({

        id:
          `cat:${entry.type}|${entry.category}`,

        title:
          entry.category.substring(
            0,
            24
          ),

        description:
          entry.type === "VEG"
            ? "VEG"
            : entry.type === "NON_VEG"
              ? "NON-VEG"
              : "COMMON"

      })
    );

  // -----------------------------------------------
  // PREVIOUS CATEGORY
  // -----------------------------------------------

  if (
    page > 0
  ) {

    rows.push({

      id:
        `catpage:${page - 1}`,

      title:
        "PREVIOUS CATEGORY",

      description:
        "Go to previous categories"

    });

  }

  // -----------------------------------------------
  // MORE CATEGORIES
  // -----------------------------------------------

  if (
    page + 1 < totalPages
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

  // -----------------------------------------------
  // BACK
  // -----------------------------------------------

  rows.push({

    id:
      "back_main",

    title:
      "BACK",

    description:
      "Back to VEG / NON-VEG"

  });

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

        header: {

          type:
            "text",

          text:
            "VEG + NON-VEG MENU"

        },

        body: {

          text:
            "Choose any category. You can add VEG and NON-VEG items in the same cart."

        },

        action: {

          button:
            "VIEW CATEGORIES",

          sections: [

            {

              title:
                "ALL CATEGORIES",

              rows

            }

          ]

        }

      }

    }
  );
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

  const session =
    getSession(to);

  let items = [];

  // -----------------------------------------------
  // COMMON MENU
  // -----------------------------------------------

  if (
    type === "COMMON"
  ) {

    items =
      MENU.COMMON[
        category
      ] || [];

  } else {

    items =
      MENU[type]?.[
        category
      ] || [];

  }

  if (
    items.length === 0
  ) {

    await sendText(
      to,
      "No items are available in this category."
    );

    return;
  }

  const PAGE_SIZE =
    8;

  const totalPages =
    Math.ceil(
      items.length /
      PAGE_SIZE
    );

  if (
    page < 0
  ) {

    page = 0;

  }

  if (
    page >= totalPages
  ) {

    page =
      totalPages - 1;

  }

  const start =
    page * PAGE_SIZE;

  const currentItems =
    items.slice(
      start,
      start + PAGE_SIZE
    );

  const rows =
    currentItems.map(
      (item, index) => {

        const actualIndex =
          start + index;

        let priceText =
          "";

        if (
          typeof item[1] === "object"
        ) {

          if (
            item[1].half !== undefined
          ) {

            priceText +=
              `Half ₹${item[1].half}`;

          }

          if (
            item[1].full !== undefined
          ) {

            if (priceText) {
              priceText +=
                " | ";
            }

            priceText +=
              `Full ₹${item[1].full}`;

          }

        } else {

          priceText =
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
            priceText.substring(
              0,
              72
            )

        };

      }
    );

  // -----------------------------------------------
  // MORE ITEMS
  // -----------------------------------------------

  if (
    page + 1 < totalPages
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

  // -----------------------------------------------
  // BACK
  // -----------------------------------------------

  rows.push({

    id:
      "back_categories",

    title:
      "BACK",

    description:
      "Back to categories"

  });

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

        header: {

          type:
            "text",

          text:
            category.substring(
              0,
              60
            )

        },

        body: {

          text:
            "Select an item to continue."

        },

        action: {

          button:
            "VIEW ITEMS",

          sections: [

            {

              title:
                `${category} • Page ${page + 1}`,

              rows

            }

          ]

        }

      }

    }
  );
}

// =====================================================
// BUTTON ROUTER - CONTINUED
// =====================================================

async function handleButton(
  to,
  id
) {

  const session =
    getSession(to);

  // -----------------------------------------------
  // MODE VEG
  // -----------------------------------------------

  if (
    id === "mode_veg"
  ) {

    session.mode =
      "VEG";

    await sendCategoryList(
      to,
      "VEG",
      0
    );

    return;
  }

  // -----------------------------------------------
  // MODE NON-VEG
  // -----------------------------------------------

  if (
    id === "mode_nonveg"
  ) {

    session.mode =
      "NON-VEG";

    await sendCategoryList(
      to,
      "NON-VEG",
      0
    );

    return;
  }

  // -----------------------------------------------
  // MODE BOTH
  // -----------------------------------------------

  if (
    id === "mode_both"
  ) {

    session.mode =
      "BOTH";

    await sendBothCategoryList(
      to,
      0
    );

    return;
  }

  // -----------------------------------------------
  // VARIANT HALF
  // -----------------------------------------------

  if (
    id === "variant_half"
  ) {

    session.variant =
      "HALF";

    await sendAddOnOptions(
      to
    );

    return;
  }

  // -----------------------------------------------
  // VARIANT FULL
  // -----------------------------------------------

  if (
    id === "variant_full"
  ) {

    session.variant =
      "FULL";

    await sendAddOnOptions(
      to
    );

    return;
  }

  // -----------------------------------------------
  // BONELESS YES
  // -----------------------------------------------

  if (
    id === "boneless_yes"
  ) {

    session.boneless =
      true;

    await sendQuantityScreen(
      to
    );

    return;
  }

  // -----------------------------------------------
  // BONELESS NO
  // -----------------------------------------------

  if (
    id === "boneless_no"
  ) {

    session.boneless =
      false;

    await sendQuantityScreen(
      to
    );

    return;
  }

  // -----------------------------------------------
  // EXTRA CHEESE YES
  // -----------------------------------------------

  if (
    id === "cheese_yes"
  ) {

    session.extraCheese =
      true;

    await sendQuantityScreen(
      to
    );

    return;
  }

  // -----------------------------------------------
  // EXTRA CHEESE NO
  // -----------------------------------------------

  if (
    id === "cheese_no"
  ) {

    session.extraCheese =
      false;

    await sendQuantityScreen(
      to
    );

    return;
  }

  // -----------------------------------------------
  // ADD TO CART
  // -----------------------------------------------

  if (
    id === "add_cart"
  ) {

    addCurrentItemToCart(
      session
    );

    await sendText(
      to,
      "✅ Item added to your cart."
    );

    await sendCart(
      to
    );

    return;
  }

  // -----------------------------------------------
  // ADD MORE
  // -----------------------------------------------

  if (
    id === "add_more"
  ) {

    if (
      session.mode === "BOTH"
    ) {

      await sendBothCategoryList(
        to,
        0
      );

    } else {

      await sendCategoryList(
        to,
        session.mode,
        0
      );

    }

    return;
  }

  // -----------------------------------------------
  // CHECKOUT
  // -----------------------------------------------

  if (
    id === "checkout"
  ) {

    await startCheckout(
      to
    );

    return;
  }

  // -----------------------------------------------
  // REMOVE MODE
  // -----------------------------------------------

  if (
    id === "remove_mode"
  ) {

    await sendRemoveList(
      to
    );

    return;
  }

  // -----------------------------------------------
  // SHARE LOCATION
  // -----------------------------------------------

  if (
    id === "share_location"
  ) {

    await sendText(
      to,
      "Please use WhatsApp's attachment/location option to share your current location."
    );

    return;
  }

  // -----------------------------------------------
  // COD
  // -----------------------------------------------

  if (
    id === "payment_cod"
  ) {

    await confirmCOD(
      to
    );

    return;
  }

  // -----------------------------------------------
  // ONLINE PAYMENT
  // -----------------------------------------------

  if (
    id === "payment_online"
  ) {

    await sendText(
      to,
      "Online payment will be connected with Razorpay API."
    );

    return;
  }

  console.log(
    "Unknown button id:",
    id
  );
}

// =====================================================
// ERROR HANDLER
// =====================================================

process.on(
  "uncaughtException",
  error => {

    console.error(
      "Uncaught Exception:",
      error
    );

  }
);

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "Unhandled Rejection:",
      error
    );

  }
);
// =====================================================
// END OF TREAT RESTAURANT BOT
// =====================================================

// Keep this file as index.js
// Start command:
// npm start

// Environment variables required on hosting:
//
// WHATSAPP_VERIFY_TOKEN
// WHATSAPP_ACCESS_TOKEN
// WHATSAPP_PHONE_NUMBER_ID

// Restaurant:
// TREAT RESTAURANT
//
// Opening:
// 10:30 AM - 10:30 PM
//
// Minimum food order:
// ₹300
//
// Packing:
// 7%
//
// Delivery:
// 0 - 2.5 km  = ₹30
// >2.5 - 5 km = ₹50
// >5 - 7 km   = ₹80
// >7 - 10 km  = ₹100
// >10 km      = Not Available

console.log(
  "TREAT RESTAURANT WhatsApp Bot loaded successfully."
);
