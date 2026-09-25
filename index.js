const http = require("http");
const qrcode = require("qrcode-terminal");

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
    auth: state
  });

  // Save WhatsApp authentication credentials
  sock.ev.on("creds.update", saveCreds);

  // WhatsApp connection updates
  sock.ev.on("connection.update", async (update) => {
    const {
      connection,
      lastDisconnect,
      qr
    } = update;

    // Show QR code
    if (qr) {
      console.log("Scan this QR code with WhatsApp:");
      qrcode.generate(qr, {
        small: true
      });
    }

    // Connected
    if (connection === "open") {
      console.log("================================");
      console.log("TREAT RESTAURANT BOT CONNECTED");
      console.log("================================");
    }

    // Connection closed
    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode ||
        new Boom(lastDisconnect?.error)?.output?.statusCode;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log(
          "WhatsApp connection closed. Reconnecting..."
        );

        startBot();
      } else {
        console.log(
          "WhatsApp logged out. Fresh login required."
        );
      }
    }
  });

  // --------------------------------------------------
  // Incoming WhatsApp Messages
  // --------------------------------------------------

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const message = messages[0];

      if (!message?.message) return;

      // Ignore messages sent by the bot itself
      if (message.key.fromMe) return;

      const jid = message.key.remoteJid;

      // Ignore WhatsApp status updates
      if (jid === "status@broadcast") return;

      const text =
        message.message.conversation ||
        message.message.extendedTextMessage?.text ||
        "";

      const userMessage = text.trim().toLowerCase();

      console.log(
        `Message received: ${userMessage}`
      );

      // ------------------------------------------------
      // TEST COMMAND
      // ------------------------------------------------

      if (userMessage === "hi") {
        await sock.sendMessage(jid, {
          text:
            "Hey! Welcome to TREAT RESTAURANT\n\n" +
            "Choose your preference:\n\n" +
            "VEG\n" +
            "NON-VEG"
        });

        console.log("Welcome message sent.");
      }

    } catch (error) {
      console.error(
        "Message handling error:",
        error
      );
    }
  });
}

// --------------------------------------------------
// Start Bot
// --------------------------------------------------

startBot().catch((error) => {
  console.error(
    "Failed to start WhatsApp bot:",
    error
  );
});
