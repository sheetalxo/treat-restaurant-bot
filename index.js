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
      lastDisconnect,
      qr
    } = update;

    // ----------------------------------------------
    // REQUEST PAIRING CODE
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

        // Make sure number contains digits only.
        // Example: 919876543210
        const cleanPhoneNumber =
          phoneNumber.replace(/\D/g, "");

        console.log(
          "WhatsApp is connecting..."
        );

        console.log(
          "Waiting before requesting pairing code..."
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

        console.log(
          "On your phone:"
        );

        console.log(
          "WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number instead"
        );

      } catch (error) {
        console.error(
          "PAIRING CODE ERROR:",
          error
        );

        // Allow another attempt only if the socket
        // is still alive and connecting.
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
  // INCOMING WHATSAPP MESSAGES
  // ------------------------------------------------

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {
      try {
        const message = messages[0];

        if (!message?.message) return;

        // Ignore messages sent by the bot itself
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
        // TEST COMMAND
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

startBot().catch((error) => {
  console.error(
    "Failed to start bot:",
    error
  );
});
