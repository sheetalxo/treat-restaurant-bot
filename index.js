const http = require("http");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// RENDER HEALTH CHECK
// --------------------------------------------------

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("TREAT RESTAURANT BOT IS RUNNING");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server running on port ${PORT}`);
});

// --------------------------------------------------
// RESTAURANT CATEGORIES
// --------------------------------------------------

const VEG_CATEGORIES = [
  "MOMOS",
  "NOODLES",
  "CHINESE SNACKS",
  "TANDOORI SNACKS",
  "MAIN COURSE",
  "RICE",
  "BURGERS",
  "PIZZA",
  "PASTA",
  "ROLLS",
  "SOUPS",
  "MOCKTAILS",
  "SHAKES",
  "COFFEE & DESSERTS"
];

const NON_VEG_CATEGORIES = [
  "MOMOS",
  "CHICKEN SNACKS",
  "NOODLES",
  "MAIN COURSE",
  "RICE",
  "SOUPS",
  "BREADS",
  "TANDOORI",
  "ROLLS"
];

// --------------------------------------------------
// SEND PREFERENCE BUTTONS
// --------------------------------------------------

async function sendPreferenceButtons(sock, jid) {
  await sock.sendMessage(jid, {
    text: "Hey! Welcome to TREAT RESTAURANT\n\nChoose your preference:",
    footer: "TREAT RESTAURANT",
    buttons: [
      {
        buttonId: "veg",
        buttonText: {
          displayText: "VEG"
        },
        type: 1
      },
      {
        buttonId: "nonveg",
        buttonText: {
          displayText: "NON-VEG"
        },
        type: 1
      }
    ],
    headerType: 1
  });
}

// --------------------------------------------------
// SEND CATEGORY LIST
// --------------------------------------------------

async function sendCategoryList(sock, jid, type) {
  const categories =
    type === "veg"
      ? VEG_CATEGORIES
      : NON_VEG_CATEGORIES;

  const rows = categories.map((category) => ({
    title: category,
    rowId: `${type}_category_${category
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")}`
  }));

  rows.push({
    title: "BACK",
    rowId: "back_to_preference"
  });

  await sock.sendMessage(jid, {
    text:
      `Great! You selected ${type === "veg" ? "VEG" : "NON-VEG"}.\n\n` +
      "Choose a category:",
    footer: "TREAT RESTAURANT",
    title: "MENU",
    buttonText: "VIEW CATEGORIES",
    sections: [
      {
        title:
          type === "veg"
            ? "VEG MENU"
            : "NON-VEG MENU",
        rows
      }
    ]
  });
}

// --------------------------------------------------
// SEND SIMPLE TEXT
// --------------------------------------------------

async function sendText(sock, jid, text) {
  await sock.sendMessage(jid, {
    text
  });
}

// --------------------------------------------------
// WHATSAPP BOT
// --------------------------------------------------

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  // Save credentials
  sock.ev.on("creds.update", saveCreds);

  let pairingCodeRequested = false;

  // ------------------------------------------------
  // CONNECTION UPDATE
  // ------------------------------------------------

  sock.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect,
      qr
    } = update;

    // ----------------------------------------------
    // PAIRING CODE
    // ----------------------------------------------

    if (
      !state.creds.registered &&
      !pairingCodeRequested &&
      (connection === "connecting" || !!qr)
    ) {
      pairingCodeRequested = true;

      try {
        const phoneNumber =
          process.env.WHATSAPP_PHONE_NUMBER;

        if (!phoneNumber) {
          throw new Error(
            "WHATSAPP_PHONE_NUMBER is missing in Render."
          );
        }

        const cleanPhoneNumber =
          phoneNumber.replace(/\D/g, "");

        console.log(
          "WhatsApp is connecting..."
        );

        await new Promise((resolve) => {
          setTimeout(resolve, 3000);
        });

        console.log(
          "Requesting WhatsApp pairing code..."
        );

        const code =
          await sock.requestPairingCode(
            cleanPhoneNumber
          );

        console.log("");
        console.log("================================");
        console.log(" WHATSAPP PAIRING CODE");
        console.log("================================");
        console.log(code);
        console.log("================================");
        console.log("");

      } catch (error) {
        console.error(
          "PAIRING CODE ERROR:",
          error
        );

        pairingCodeRequested = false;
      }
    }

    // ----------------------------------------------
    // CONNECTED
    // ----------------------------------------------

    if (connection === "open") {
      console.log("");
      console.log("================================");
      console.log(
        " TREAT RESTAURANT BOT CONNECTED"
      );
      console.log("================================");
      console.log("");
    }

    // ----------------------------------------------
    // CONNECTION CLOSED
    // ----------------------------------------------

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        new Boom(
          lastDisconnect?.error
        )?.output?.statusCode;

      console.log(
        `WhatsApp connection closed. Status: ${statusCode}`
      );

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log(
          "Restarting WhatsApp connection in 5 seconds..."
        );

        setTimeout(() => {
          startBot();
        }, 5000);
      } else {
        console.log(
          "WhatsApp logged out. Fresh login required."
        );
      }
    }
  });

  // ------------------------------------------------
  // INCOMING MESSAGES
  // ------------------------------------------------

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {
      try {
        const message = messages[0];

        if (!message?.message) return;

        // Ignore own messages
        if (message.key.fromMe) return;

        const jid =
          message.key.remoteJid;

        // Ignore status
        if (jid === "status@broadcast") return;

        // ------------------------------------------
        // NORMAL TEXT
        // ------------------------------------------

        const text =
          message.message.conversation ||
          message.message.extendedTextMessage?.text ||
          "";

        const userMessage =
          text.trim().toLowerCase();

        // ------------------------------------------
        // BUTTON RESPONSE
        // ------------------------------------------

        const buttonId =
          message.message.buttonsResponseMessage
            ?.selectedButtonId ||
          message.message.templateButtonReplyMessage
            ?.selectedId ||
          "";

        // ------------------------------------------
        // LIST RESPONSE
        // ------------------------------------------

        const listId =
          message.message.listResponseMessage
            ?.singleSelectReply?.selectedRowId ||
          "";

        // ------------------------------------------
        // FINAL USER ACTION
        // ------------------------------------------

        const action =
          buttonId ||
          listId ||
          userMessage;

        console.log(
          `User action: ${action}`
        );

        // ------------------------------------------
        // HI / HELLO
        // ------------------------------------------

        if (
          userMessage === "hi" ||
          userMessage === "hello" ||
          userMessage === "hey" ||
          userMessage === "start"
        ) {
          await sendPreferenceButtons(
            sock,
            jid
          );

          return;
        }

        // ------------------------------------------
        // VEG BUTTON
        // ------------------------------------------

        if (action === "veg") {
          await sendCategoryList(
            sock,
            jid,
            "veg"
          );

          return;
        }

        // ------------------------------------------
        // NON-VEG BUTTON
        // ------------------------------------------

        if (action === "nonveg") {
          await sendCategoryList(
            sock,
            jid,
            "nonveg"
          );

          return;
        }

        // ------------------------------------------
        // BACK TO PREFERENCE
        // ------------------------------------------

        if (
          action === "back_to_preference"
        ) {
          await sendPreferenceButtons(
            sock,
            jid
          );

          return;
        }

        // ------------------------------------------
        // CATEGORY SELECTED
        // ------------------------------------------

        if (
          action.includes("_category_")
        ) {
          const category =
            action
              .split("_category_")[1]
              ?.replace(/_/g, " ")
              .toUpperCase();

          await sendText(
            sock,
            jid,
            `You selected ${category}.\n\n` +
            "Items for this category will appear here next."
          );

          return;
        }

        // ------------------------------------------
        // FALLBACK
        // ------------------------------------------

        if (userMessage) {
          await sendPreferenceButtons(
            sock,
            jid
          );
        }

      } catch (error) {
        console.error(
          "Message handling error:",
          error
        );
      }
    }
  );
}

// --------------------------------------------------
// START BOT
// --------------------------------------------------

startBot().catch((error) => {
  console.error(
    "Failed to start bot:",
    error
  );
});
