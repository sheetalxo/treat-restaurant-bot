const http = require("http");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain"
  });

  res.end("TREAT RESTAURANT BOT IS RUNNING");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTP server running on port ${PORT}`);
});

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Scan this QR code with WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("TREAT RESTAURANT BOT CONNECTED");
    }

    if (connection === "close") {
      const statusCode =
        new Boom(lastDisconnect?.error)?.output?.statusCode;

      const shouldReconnect =
        statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        console.log("WhatsApp connection closed. Reconnecting...");
        startBot();
      } else {
        console.log("WhatsApp logged out. Fresh login required.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];

    if (!message?.message) return;
    if (message.key.fromMe) return;

    const jid = message.key.remoteJid;

    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    if (text.trim().toLowerCase() === "hi") {
      await sock.sendMessage(jid, {
        text: "Hey! Choose your preference\n\nVEG\nNON-VEG"
      });
    }
  });
}

startBot();
