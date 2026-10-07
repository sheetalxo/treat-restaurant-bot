// Run AFTER creating the table:  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node print-queue.test.js
const db = require("./db");
(async () => {
  if (!db.enabled) return console.log("Supabase env vars missing");
  const job = await db.createPrintJob({ orderId: "TEST-1", kind: "kot", payload: { items: ["Test item x1"] } });
  console.log("created:", job?.id, job?.status);
  console.log("pending count:", (await db.getPendingPrintJobs()).length);
  const [a, b] = await Promise.all([db.claimPrintJob(job.id, "w1"), db.claimPrintJob(job.id, "w2")]);
  console.log("claim race (exactly one should win):", !!a, !!b);
  console.log("printed:", (await db.updatePrintJob(job.id, { status: "printed" }))?.status);
})();
