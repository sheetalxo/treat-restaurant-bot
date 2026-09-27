const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// ======================================================
// TREAT RESTAURANT MENU
// ======================================================

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
  }
};

// ======================================================
// CUSTOMER SESSIONS / CARTS
// ======================================================

const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      type: null,
      category: null,
      item: null,
      variant: null,
      quantity: 1,
      cart: []
    };
  }

  return sessions[phone];
}

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.status(200).send("TREAT RESTAURANT WhatsApp Bot is running");
});

// ======================================================
// META WEBHOOK VERIFICATION
// ======================================================

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
});

// ======================================================
// RECEIVE WHATSAPP MESSAGES
// ======================================================

app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming WhatsApp webhook:");
    console.log(JSON.stringify(req.body, null, 2));

    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const session = getSession(from);

    // ---------------- TEXT ----------------

    if (message.type === "text") {
      const text = message.text?.body?.trim().toLowerCase();

      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey" ||
        text === "start"
      ) {
        session.type = null;
        session.category = null;
        session.item = null;
        session.variant = null;
        session.quantity = 1;

        await sendWelcomeMessage(from);
      }

      return res.sendStatus(200);
    }

    // ---------------- INTERACTIVE ----------------

    if (message.type === "interactive") {

      // BUTTON
      if (message.interactive?.type === "button_reply") {
        const id = message.interactive.button_reply.id;

        await handleButton(from, id);

        return res.sendStatus(200);
      }

      // LIST
      if (message.interactive?.type === "list_reply") {
        const id = message.interactive.list_reply.id;

        await handleList(from, id);

        return res.sendStatus(200);
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
  }
});

// ======================================================
// BUTTON HANDLER
// ======================================================

async function handleButton(to, id) {
  const session = getSession(to);

  // VEG / NON VEG
  if (id === "veg") {
    session.type = "VEG";
    session.category = null;
    await sendCategoryList(to, "VEG", 0);
    return;
  }

  if (id === "non_veg") {
    session.type = "NON-VEG";
    session.category = null;
    await sendCategoryList(to, "NON-VEG", 0);
    return;
  }

  // Back to food category
  if (id === "back_categories") {
    await sendCategoryList(to, session.type, 0);
    return;
  }

  // Back to main VEG/NON-VEG
  if (id === "back_main") {
    session.type = null;
    session.category = null;
    await sendWelcomeMessage(to);
    return;
  }

  // Add quantity
  if (id === "qty_plus") {
    session.quantity += 1;
    await sendQuantityScreen(to);
    return;
  }

  // Reduce quantity
  if (id === "qty_minus") {
    if (session.quantity > 1) {
      session.quantity -= 1;
    }

    await sendQuantityScreen(to);
    return;
  }

  // Add item
  if (id === "add_cart") {
    addCurrentItemToCart(session);

    await sendCart(to);
    return;
  }

  // Add more
  if (id === "add_more") {
    await sendCategoryList(to, session.type, 0);
    return;
  }

  // View cart
  if (id === "view_cart") {
    await sendCart(to);
    return;
  }

  // Remove mode
  if (id === "remove_mode") {
    await sendRemoveList(to);
    return;
  }

  // Empty cart
  if (id === "empty_cart") {
    session.cart = [];
    await sendCategoryList(to, session.type, 0);
    return;
  }
}

// ======================================================
// LIST HANDLER
// ======================================================

async function handleList(to, id) {
  const session = getSession(to);

  // CATEGORY
  if (id.startsWith("cat:")) {
    const category = id.replace("cat:", "");

    session.category = category;

    await sendItemList(to, session.type, category, 0);
    return;
  }

  // NEXT CATEGORY PAGE
  if (id.startsWith("catpage:")) {
    const page = Number(id.replace("catpage:", ""));

    await sendCategoryList(to, session.type, page);
    return;
  }

  // ITEM
  if (id.startsWith("item:")) {
    const index = Number(id.split(":")[1]);

    const items = MENU[session.type][session.category];

    if (!items[index]) return;

    session.item = items[index];
    session.variant = null;
    session.quantity = 1;

    const price = session.item[1];

    // Half / Full item
    if (typeof price === "object") {
      await sendVariantButtons(to);
    } else {
      await sendQuantityScreen(to);
    }

    return;
  }

  // NEXT ITEM PAGE
  if (id.startsWith("itempage:")) {
    const page = Number(id.replace("itempage:", ""));

    await sendItemList(
      to,
      session.type,
      session.category,
      page
    );

    return;
  }

  // HALF
  if (id === "variant_half") {
    session.variant = "HALF";
    session.quantity = 1;

    await sendQuantityScreen(to);
    return;
  }

  // FULL
  if (id === "variant_full") {
    session.variant = "FULL";
    session.quantity = 1;

    await sendQuantityScreen(to);
    return;
  }

  // REMOVE ITEM
  if (id.startsWith("remove:")) {
    const index = Number(id.replace("remove:", ""));

    if (session.cart[index]) {
      session.cart.splice(index, 1);
    }

    await sendCart(to);
    return;
  }
}

// ======================================================
// WELCOME
// ======================================================

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
              id: "veg",
              title: "VEG"
            }
          },
          {
            type: "reply",
            reply: {
              id: "non_veg",
              title: "NON-VEG"
            }
          }
        ]
      }
    }
  });
}

// ======================================================
// CATEGORY LIST
// ======================================================

async function sendCategoryList(to, type, page = 0) {

  const categories = Object.keys(MENU[type]);

  const PAGE_SIZE = 9;

  const start = page * PAGE_SIZE;

  let rows = categories
    .slice(start, start + PAGE_SIZE)
    .map((category) => ({
      id: `cat:${category}`,
      title: category.substring(0, 24),
      description: `View ${category}`
    }));

  const nextPage = start + PAGE_SIZE < categories.length;

  if (nextPage) {
    rows.push({
      id: `catpage:${page + 1}`,
      title: "MORE CATEGORIES",
      description: "View more categories"
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
          `🍽️ ${type} MENU\n\n` +
          "Choose a category:"
      },

      action: {
        button: "VIEW CATEGORIES",

        sections: [
          {
            title: `${type} CATEGORIES`,
            rows
          }
        ]
      }
    }
  });
}

// ======================================================
// ITEM LIST
// ======================================================

async function sendItemList(to, type, category, page = 0) {

  const items = MENU[type][category];

  const PAGE_SIZE = 9;

  const start = page * PAGE_SIZE;

  let rows = items
    .slice(start, start + PAGE_SIZE)
    .map((item, index) => {

      const actualIndex = start + index;

      let description = "";

      if (typeof item[1] === "object") {
        description =
          `Half ₹${item[1].half} | Full ₹${item[1].full}`;
      } else {
        description = `₹${item[1]}`;
      }

      return {
        id: `item:${actualIndex}`,
        title: item[0].substring(0, 24),
        description: description.substring(0, 72)
      };
    });

  const nextPage = start + PAGE_SIZE < items.length;

  if (nextPage) {
    rows.push({
      id: `itempage:${page + 1}`,
      title: "MORE ITEMS",
      description: "View more food items"
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
          "Select an item:"
      },

      action: {
        button: "VIEW FOOD",

        sections: [
          {
            title: category,
            rows
          }
        ]
      }
    }
  });
}

// ======================================================
// HALF / FULL
// ======================================================

async function sendVariantButtons(to) {

  const session = getSession(to);

  const item = session.item;

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
          `Choose plate size:`
      },

      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "variant_half",
              title: `HALF ₹${item[1].half}`
            }
          },
          {
            type: "reply",
            reply: {
              id: "variant_full",
              title: `FULL ₹${item[1].full}`
            }
          }
        ]
      }
    }
  });
}

// ======================================================
// QUANTITY
// ======================================================

async function sendQuantityScreen(to) {

  const session = getSession(to);

  const item = session.item;

  let price;

  if (typeof item[1] === "object") {

    price =
      session.variant === "HALF"
        ? item[1].half
        : item[1].full;

  } else {

    price = item[1];

  }

  const total = price * session.quantity;

  let variantText = "";

  if (session.variant) {
    variantText = `\nSize: ${session.variant}`;
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
          `🍽️ ${item[0]}` +
          variantText +
          `\n\nPrice: ₹${price}` +
          `\nQuantity: ${session.quantity}` +
          `\nItem Total: ₹${total}` +
          `\n\nChoose quantity:`
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
          },
          {
            type: "reply",
            reply: {
              id: "add_cart",
              title: "ADD TO CART"
            }
          }
        ]
      }
    }
  });
}

// ======================================================
// ADD CURRENT ITEM TO CART
// ======================================================

function addCurrentItemToCart(session) {

  const item = session.item;

  let price;

  let variant = null;

  if (typeof item[1] === "object") {

    variant = session.variant;

    price =
      variant === "HALF"
        ? item[1].half
        : item[1].full;

  } else {

    price = item[1];

  }

  session.cart.push({
    name: item[0],
    variant,
    price,
    quantity: session.quantity
  });

  session.item = null;
  session.variant = null;
  session.quantity = 1;
}

// ======================================================
// CART
// ======================================================

async function sendCart(to) {

  const session = getSession(to);

  if (session.cart.length === 0) {

    await sendWhatsAppMessage(to, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",

      interactive: {
        type: "button",

        body: {
          text:
            "🛒 Your cart is empty.\n\n" +
            "Would you like to view the menu?"
        },

        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "add_more",
                title: "VIEW MENU"
              }
            },
            {
              type: "reply",
              reply: {
                id: "back_main",
                title: "BACK"
              }
            }
          ]
        }
      }
    });

    return;
  }

  let subtotal = 0;

  let cartText = "🛒 YOUR CART\n\n";

  session.cart.forEach((item, index) => {

    const itemTotal = item.price * item.quantity;

    subtotal += itemTotal;

    const variant =
      item.variant
        ? ` (${item.variant})`
        : "";

    cartText +=
      `${index + 1}. ${item.name}${variant}\n` +
      `   ₹${item.price} × ${item.quantity} = ₹${itemTotal}\n\n`;
  });

  cartText += `Subtotal: ₹${subtotal}`;

  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",

    interactive: {
      type: "button",

      body: {
        text: cartText
      },

      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "add_more",
              title: "ADD MORE"
            }
          },
          {
            type: "reply",
            reply: {
              id: "remove_mode",
              title: "REMOVE"
            }
          },
          {
            type: "reply",
            reply: {
              id: "view_cart",
              title: "VIEW CART"
            }
          }
        ]
      }
    }
  });

  // Checkout button separately because WhatsApp allows only 3 buttons
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",

    interactive: {
      type: "button",

      body: {
        text:
          "Ready to continue with your order?"
      },

      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "checkout",
              title: "CHECKOUT"
            }
          },
          {
            type: "reply",
            reply: {
              id: "back_categories",
              title: "BACK TO MENU"
            }
          }
        ]
      }
    }
  });
}

// ======================================================
// REMOVE ITEM LIST
// ======================================================

async function sendRemoveList(to) {

  const session = getSession(to);

  if (session.cart.length === 0) {
    await sendCart(to);
    return;
  }

  const rows = session.cart.slice(0, 10).map((item, index) => {

    const variant =
      item.variant
        ? ` (${item.variant})`
        : "";

    return {
      id: `remove:${index}`,
      title: `${index + 1}. ${item.name}`.substring(0, 24),
      description:
        `${variant} × ${item.quantity} — ₹${item.price * item.quantity}`
    };
  });

  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",

    interactive: {
      type: "list",

      body: {
        text:
          "🗑️ REMOVE ITEM\n\n" +
          "Select the item you want to remove:"
      },

      action: {
        button: "REMOVE ITEM",

        sections: [
          {
            title: "YOUR CART",
            rows
          }
        ]
      }
    }
  });
}

// ======================================================
// WHATSAPP API SENDER
// ======================================================

async function sendWhatsAppMessage(to, message) {

  const url =
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {

    method: "POST",

    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },

    body: JSON.stringify(message)

  });

  const data = await response.json();

  console.log("WhatsApp API response:");
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok) {

    throw new Error(
      `WhatsApp API error: ${JSON.stringify(data)}`
    );

  }

  return data;
}

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `TREAT RESTAURANT bot running on port ${PORT}`
  );

});
