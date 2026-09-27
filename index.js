const express = require("express");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Render Environment Variables
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Health check
app.get("/", (req, res) => {
  res.status(200).send("TREAT RESTAURANT WhatsApp Bot is running");
});

// Meta webhook verification
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

// Receive WhatsApp messages
app.post("/webhook", async (req, res) => {
  try {
    console.log("Incoming WhatsApp webhook:");
    console.log(JSON.stringify(req.body, null, 2));

    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    // Ignore status updates and other events
    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;

    // Normal text messages
    if (message.type === "text") {
      const text = message.text?.body?.trim().toLowerCase();

      if (
        text === "hi" ||
        text === "hello" ||
        text === "hey" ||
        text === "start"
      ) {
        await sendWelcomeMessage(from);
      }
    }

    // Button responses
    if (message.type === "interactive") {
      const buttonId =
        message.interactive?.button_reply?.id;

      if (buttonId === "veg") {
        await sendCategoryMessage(from, "VEG");
      }

      if (buttonId === "non_veg") {
        await sendCategoryMessage(from, "NON-VEG");
      }
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    return res.sendStatus(500);
  }
});

// Send VEG / NON-VEG welcome buttons
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
          "Hey! Welcome to TREAT RESTAURANT 🍽️\n\nChoose your preference:"
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

// Temporary category response
async function sendCategoryMessage(to, type) {
  await sendWhatsAppMessage(to, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      body:
        `You selected ${type}.\n\n` +
        `Category menu will be added next.`
    }
  });
}

// Common WhatsApp API sender
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

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `TREAT RESTAURANT bot running on port ${PORT}`
  );
});
