const http = require("http");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// Render Health Check Server
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
// WhatsApp Bot
// --------------------------------------------------

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  // Save WhatsApp credentials
  sock.ev.on("creds.update", saveCreds);

  let pairingCodeRequested = false;

  // ------------------------------------------------
  // CONNECTION UPDATE
  // ------------------------------------------------

  sock.ev.on("connection.update", async (update) => {

    const {
      connection,
      lastDisconnect
    } = update;

    // ----------------------------------------------
    // REQUEST PAIRING CODE
    // ----------------------------------------------

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      !pairingCodeRequested
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

        console.log(
          "Requesting WhatsApp pairing code..."
        );

        // Small delay before requesting code
        await new Promise(resolve =>
          setTimeout(resolve, 1500)
        );

        const code =
          await sock.requestPairingCode(
            phoneNumber
          );

        console.log("");
        console.log("================================");
        console.log(" WHATSAPP PAIRING CODE");
        console.log("================================");
        console.log(code);
        console.log("================================");
        console.log("");

        console.log(
          "On phone: WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number instead"
        );

      } catch (error) {

        console.error(
          "Pairing code error:",
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

      // WhatsApp sometimes requires a fresh socket
      // after pairing/restart.
      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      console.log(
        `WhatsApp connection closed. Status: ${statusCode}`
      );

      if (shouldReconnect) {

        console.log(
          "Restarting WhatsApp connection..."
        );

        setTimeout(() => {
          startBot();
        }, 3000);

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

        // Ignore bot's own messages
        if (message.key.fromMe) return;

        const jid =
          message.key.remoteJid;

        // Ignore WhatsApp status
        if (jid === "status@broadcast") return;

        const text =
          message.message.conversation ||
          message.message.extendedTextMessage?.text ||
          "";

        const userMessage =
          text.trim().toLowerCase();

        console.log(
          `Message received: ${userMessage}`
        );

        // ------------------------------------------
        // TEST: HI
        // ------------------------------------------

        if (userMessage === "hi") {

          await sock.sendMessage(jid, {
            text:
              "Hey! Welcome to TREAT RESTAURANT\n\n" +
              "Choose your preference:\n\n" +
              "VEG\n" +
              "NON-VEG"
          });

          console.log(
            "Welcome message sent."
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

startBot().catch(error => {

  console.error(
    "Failed to start bot:",
    error
  );

});
