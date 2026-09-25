const http = require("http");
const QRCode = require("qrcode");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// QR CODE STORAGE
// --------------------------------------------------

let latestQR = null;

// --------------------------------------------------
// RENDER WEB SERVER
// --------------------------------------------------

const server = http.createServer(async (req, res) => {

  // Health check
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>TREAT RESTAURANT BOT</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #111;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
          }

          .box {
            padding: 30px;
          }

          h1 {
            margin-bottom: 10px;
          }

          p {
            color: #aaa;
          }

          a {
            display: inline-block;
            margin-top: 20px;
            padding: 14px 22px;
            background: #25D366;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          }
        </style>
      </head>

      <body>
        <div class="box">
          <h1>TREAT RESTAURANT</h1>
          <p>WhatsApp Ordering Bot</p>

          <a href="/qr">
            OPEN WHATSAPP QR
          </a>
        </div>
      </body>
      </html>
    `);

    return;
  }

  // --------------------------------------------------
  // QR PAGE
  // --------------------------------------------------

  if (req.url === "/qr") {

    if (!latestQR) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="3">
          <title>WhatsApp QR</title>

          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #111;
              color: white;
              font-family: Arial, sans-serif;
              text-align: center;
            }

            .box {
              padding: 30px;
            }

            .loader {
              width: 40px;
              height: 40px;
              border: 4px solid #333;
              border-top: 4px solid #25D366;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 25px auto;
            }

            @keyframes spin {
              100% {
                transform: rotate(360deg);
              }
            }

            p {
              color: #aaa;
            }
          </style>
        </head>

        <body>
          <div class="box">
            <h2>Generating WhatsApp QR...</h2>
            <div class="loader"></div>
            <p>Please wait...</p>
          </div>
        </body>
        </html>
      `);

      return;
    }

    try {

      const qrDataURL = await QRCode.toDataURL(latestQR, {
        width: 320,
        margin: 2
      });

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });

      res.end(`
        <!DOCTYPE html>
        <html>

        <head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          >

          <meta http-equiv="refresh" content="15">

          <title>TREAT RESTAURANT - WhatsApp QR</title>

          <style>

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #111;
              font-family: Arial, sans-serif;
              color: white;
              text-align: center;
            }

            .container {
              width: 100%;
              max-width: 450px;
              padding: 25px;
            }

            .card {
              background: #1b1b1b;
              border-radius: 18px;
              padding: 25px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            }

            h1 {
              margin: 0 0 8px;
              font-size: 25px;
            }

            .subtitle {
              color: #aaa;
              margin-bottom: 22px;
            }

            .qr {
              background: white;
              padding: 15px;
              border-radius: 12px;
              display: inline-block;
            }

            .qr img {
              width: 320px;
              max-width: 75vw;
              height: auto;
              display: block;
            }

            .steps {
              margin-top: 25px;
              text-align: left;
              line-height: 1.6;
              color: #ddd;
            }

            .steps strong {
              color: #25D366;
            }

            .warning {
              margin-top: 18px;
              font-size: 13px;
              color: #888;
            }

          </style>
        </head>

        <body>

          <div class="container">

            <div class="card">

              <h1>TREAT RESTAURANT</h1>

              <div class="subtitle">
                WhatsApp Bot Connection
              </div>

              <div class="qr">
                <img src="${qrDataURL}" alt="WhatsApp QR Code">
              </div>

              <div class="steps">

                <strong>Scan this QR from your phone:</strong>

                <br><br>

                1. Open WhatsApp<br>

                2. Go to <b>Settings</b><br>

                3. Open <b>Linked Devices</b><br>

                4. Tap <b>Link a Device</b><br>

                5. Scan the QR code above

              </div>

              <div class="warning">
                QR automatically refreshes when WhatsApp generates a new one.
              </div>

            </div>

          </div>

        </body>

        </html>
      `);

      return;

    } catch (error) {

      console.error("QR PAGE ERROR:", error);

      res.writeHead(500, {
        "Content-Type": "text/plain"
      });

      res.end("Unable to generate QR");

      return;
    }
  }

  // 404
  res.writeHead(404, {
    "Content-Type": "text/plain"
  });

  res.end("Not Found");
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

    text:
      "Hey! Welcome to TREAT RESTAURANT\n\n" +
      "Choose your preference:",

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

    rowId:
      `${type}_category_` +
      category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")

  }));

  rows.push({
    title: "BACK",
    rowId: "back_to_preference"
  });

  await sock.sendMessage(jid, {

    text:
      `Great! You selected ${
        type === "veg"
          ? "VEG"
          : "NON-VEG"
      }.\n\nChoose a category:`,

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

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(
    "auth_info_baileys"
  );

  const sock = makeWASocket({

    auth: state,

    printQRInTerminal: false

  });

  // ------------------------------------------------
  // SAVE CREDENTIALS
  // ------------------------------------------------

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  // ------------------------------------------------
  // CONNECTION UPDATE
  // ------------------------------------------------

  sock.ev.on(
    "connection.update",
    async (update) => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      // --------------------------------------------
      // NEW QR CODE
      // --------------------------------------------

      if (qr) {

        latestQR = qr;

        console.log("");
        console.log(
          "================================"
        );

        console.log(
          " NEW WHATSAPP QR CODE GENERATED"
        );

        console.log(
          "Open /qr on your Render URL"
        );

        console.log(
          "================================"
        );

        console.log("");

      }

      // --------------------------------------------
      // CONNECTED
      // --------------------------------------------

      if (connection === "open") {

        latestQR = null;

        console.log("");
        console.log(
          "================================"
        );

        console.log(
          " TREAT RESTAURANT BOT CONNECTED"
        );

        console.log(
          "================================"
        );

        console.log("");

      }

      // --------------------------------------------
      // CONNECTION CLOSED
      // --------------------------------------------

      if (connection === "close") {

        latestQR = null;

        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode;

        console.log(
          `WhatsApp connection closed. Status: ${statusCode}`
        );

        const shouldReconnect =
          statusCode !==
          DisconnectReason.loggedOut;

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

    }
  );

  // --------------------------------------------------
  // INCOMING MESSAGES
  // --------------------------------------------------

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {

      try {

        const message = messages[0];

        if (!message?.message) {
          return;
        }

        // Ignore own messages
        if (message.key.fromMe) {
          return;
        }

        const jid =
          message.key.remoteJid;

        // Ignore status
        if (
          jid === "status@broadcast"
        ) {
          return;
        }

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
        // VEG
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
        // NON-VEG
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
        // BACK
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
