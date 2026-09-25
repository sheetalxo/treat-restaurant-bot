const http = require("http");
const QRCode = require("qrcode");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  proto,
  generateWAMessageFromContent
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 10000;

let latestQR = null;

// ==================================================
// RENDER SERVER
// ==================================================

const server = http.createServer(async (req, res) => {

  if (req.url === "/" || req.url === "/health") {

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>TREAT RESTAURANT</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #111;
            color: white;
            font-family: Arial;
            text-align: center;
          }

          .box {
            padding: 30px;
          }

          a {
            display: inline-block;
            margin-top: 20px;
            padding: 14px 25px;
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

          <a href="/qr">OPEN WHATSAPP QR</a>
        </div>
      </body>
      </html>
    `);

    return;
  }

  // ==================================================
  // QR PAGE
  // ==================================================

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
        </head>

        <body style="
          margin:0;
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#111;
          color:white;
          font-family:Arial;
          text-align:center;
        ">

          <div>
            <h2>Generating WhatsApp QR...</h2>
            <p>Please wait...</p>
          </div>

        </body>
        </html>
      `);

      return;
    }

    try {

      const qrImage = await QRCode.toDataURL(
        latestQR,
        {
          width: 350,
          margin: 2
        }
      );

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

          <title>TREAT RESTAURANT QR</title>

          <style>

            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #111;
              color: white;
              font-family: Arial;
              text-align: center;
            }

            .card {
              background: #1c1c1c;
              padding: 25px;
              border-radius: 18px;
              max-width: 420px;
              width: 90%;
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
              display: block;
            }

            .steps {
              text-align: left;
              margin-top: 20px;
              line-height: 1.7;
              color: #ddd;
            }

          </style>

        </head>

        <body>

          <div class="card">

            <h1>TREAT RESTAURANT</h1>

            <p>Scan to connect WhatsApp</p>

            <div class="qr">
              <img src="${qrImage}">
            </div>

            <div class="steps">

              <b>Phone:</b>

              <br>

              1. Open WhatsApp

              <br>

              2. Settings

              <br>

              3. Linked Devices

              <br>

              4. Link a Device

              <br>

              5. Scan this QR

            </div>

          </div>

        </body>

        </html>
      `);

      return;

    } catch (error) {

      console.error("QR ERROR:", error);

      res.writeHead(500);
      res.end("QR generation error");

      return;
    }
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server running on port ${PORT}`);
});

// ==================================================
// CATEGORIES
// ==================================================

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

// ==================================================
// MODERN WHATSAPP QUICK REPLY BUTTONS
// ==================================================

async function sendPreferenceButtons(sock, jid) {

  const message = generateWAMessageFromContent(
    jid,

    {
      viewOnceMessage: {
        message: {

          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },

          interactiveMessage:
            proto.Message.InteractiveMessage.create({

              body:
                proto.Message.InteractiveMessage.Body.create({
                  text:
                    "Hey! Welcome to TREAT RESTAURANT\n\n" +
                    "Choose your preference:"
                }),

              footer:
                proto.Message.InteractiveMessage.Footer.create({
                  text: "TREAT RESTAURANT"
                }),

              nativeFlowMessage:
                proto.Message.InteractiveMessage
                  .NativeFlowMessage.create({

                    buttons: [

                      {
                        name: "quick_reply",

                        buttonParamsJson:
                          JSON.stringify({
                            display_text: "VEG",
                            id: "veg"
                          })
                      },

                      {
                        name: "quick_reply",

                        buttonParamsJson:
                          JSON.stringify({
                            display_text: "NON-VEG",
                            id: "nonveg"
                          })
                      }

                    ],

                    messageParamsJson: ""
                  })

            })

        }
      }
    },

    {}
  );

  await sock.relayMessage(
    jid,
    message.message,
    {
      messageId: message.key.id
    }
  );
}

// ==================================================
// CATEGORY LIST
// ==================================================

async function sendCategoryList(sock, jid, type) {

  const categories =
    type === "veg"
      ? VEG_CATEGORIES
      : NON_VEG_CATEGORIES;

  const rows = categories.map((category) => ({
    header: "",
    title: category,
    description: "",
    id:
      `${type}_category_` +
      category
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
  }));

  rows.push({
    header: "",
    title: "BACK",
    description: "",
    id: "back_to_preference"
  });

  const params = {

    title: "VIEW CATEGORIES",

    sections: [
      {
        title:
          type === "veg"
            ? "VEG MENU"
            : "NON-VEG MENU",

        rows
      }
    ]

  };

  const message = generateWAMessageFromContent(
    jid,

    {
      viewOnceMessage: {
        message: {

          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },

          interactiveMessage:
            proto.Message.InteractiveMessage.create({

              body:
                proto.Message.InteractiveMessage.Body.create({
                  text:
                    `Great! You selected ${
                      type === "veg"
                        ? "VEG"
                        : "NON-VEG"
                    }.\n\nChoose a category:`
                }),

              footer:
                proto.Message.InteractiveMessage.Footer.create({
                  text: "TREAT RESTAURANT"
                }),

              nativeFlowMessage:
                proto.Message.InteractiveMessage
                  .NativeFlowMessage.create({

                    buttons: [

                      {
                        name: "single_select",

                        buttonParamsJson:
                          JSON.stringify(params)
                      }

                    ],

                    messageParamsJson: ""
                  })

            })

        }
      }
    },

    {}
  );

  await sock.relayMessage(
    jid,
    message.message,
    {
      messageId: message.key.id
    }
  );
}

// ==================================================
// SIMPLE TEXT
// ==================================================

async function sendText(sock, jid, text) {

  await sock.sendMessage(jid, {
    text
  });

}

// ==================================================
// BOT
// ==================================================

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

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  // ==================================================
  // CONNECTION
  // ==================================================

  sock.ev.on(
    "connection.update",
    async (update) => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      // ----------------------------------------------
      // QR
      // ----------------------------------------------

      if (qr) {

        latestQR = qr;

        console.log("");
        console.log(
          "======================================"
        );

        console.log(
          " WHATSAPP QR GENERATED"
        );

        console.log(
          " OPEN /qr ON RENDER"
        );

        console.log(
          "======================================"
        );

      }

      // ----------------------------------------------
      // CONNECTED
      // ----------------------------------------------

      if (connection === "open") {

        latestQR = null;

        console.log("");
        console.log(
          "======================================"
        );

        console.log(
          " TREAT RESTAURANT BOT CONNECTED"
        );

        console.log(
          "======================================"
        );

      }

      // ----------------------------------------------
      // CLOSED
      // ----------------------------------------------

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
            "Restarting in 5 seconds..."
          );

          setTimeout(() => {
            startBot();
          }, 5000);

        } else {

          console.log(
            "WhatsApp logged out."
          );

        }

      }

    }
  );

  // ==================================================
  // MESSAGES
  // ==================================================

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {

      try {

        const message = messages[0];

        if (!message?.message) {
          return;
        }

        if (message.key.fromMe) {
          return;
        }

        const jid =
          message.key.remoteJid;

        if (jid === "status@broadcast") {
          return;
        }

        // ------------------------------------------
        // TEXT
        // ------------------------------------------

        const text =
          message.message.conversation ||
          message.message.extendedTextMessage?.text ||
          "";

        const userMessage =
          text.trim().toLowerCase();

        // ------------------------------------------
        // OLD BUTTON RESPONSE
        // ------------------------------------------

        const oldButtonId =
          message.message.buttonsResponseMessage
            ?.selectedButtonId ||
          message.message.templateButtonReplyMessage
            ?.selectedId ||
          "";

        // ------------------------------------------
        // OLD LIST RESPONSE
        // ------------------------------------------

        const oldListId =
          message.message.listResponseMessage
            ?.singleSelectReply
            ?.selectedRowId ||
          "";

        // ------------------------------------------
        // MODERN NATIVE FLOW RESPONSE
        // ------------------------------------------

        let modernButtonId = "";

        const nativeFlowResponse =
          message.message
            .interactiveResponseMessage
            ?.nativeFlowResponseMessage;

        if (nativeFlowResponse?.paramsJson) {

          try {

            const params =
              JSON.parse(
                nativeFlowResponse.paramsJson
              );

            modernButtonId =
              params.id ||
              params.selected_id ||
              params.row_id ||
              "";

          } catch (error) {

            console.log(
              "Could not parse interactive response"
            );

          }

        }

        // ------------------------------------------
        // FINAL ACTION
        // ------------------------------------------

        const action =
          modernButtonId ||
          oldButtonId ||
          oldListId ||
          userMessage;

        console.log(
          `User action: ${action}`
        );

        // ------------------------------------------
        // HI
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
        // NON VEG
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
        // CATEGORY
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

// ==================================================
// START
// ==================================================

startBot().catch((error) => {

  console.error(
    "Failed to start bot:",
    error
  );

});
