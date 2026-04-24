    const express = require("express");
const { v4: uuid } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

// ── GET /api/reconciliation ────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { client_id, period, status } = req.query;
  if (!client_id || !period) {
    return res.status(400).json({ success: false, message: "client_id and period are required." });
  }

  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(client_id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  let query = "SELECT * FROM reconciliation WHERE user_id=? AND client_id=? AND period=?";
  const params = [req.user.id, client_id, period];
  if (status) { query += " AND status=?"; params.push(status); }
  query += " ORDER BY vendor_name ASC";

  const rows = db.prepare(query).all(...params);

  // Summary stats
  const matched   = rows.filter(r => r.status === "matched").length;
  const mismatch  = rows.filter(r => r.status === "mismatch").length;
  const missing   = rows.filter(r => r.status === "missing").length;
  const totalRisk = rows.reduce((a, r) => a + r.difference, 0);

  res.json({ success: true, count: rows.length, summary: { matched, mismatch, missing, total_itc_risk: totalRisk }, rows });
});

// ── POST /api/reconciliation ───────────────────────────────────────────────
router.post("/", [
  body("client_id").notEmpty().withMessage("Client is required"),
  body("period").trim().notEmpty().withMessage("Period is required"),
  body("vendor_name").trim().notEmpty().withMessage("Vendor name is required"),
  body("vendor_gstin").trim().isLength({ min:15, max:15 }).withMessage("Vendor GSTIN must be 15 characters"),
  body("books_amount").isNumeric().withMessage("Books amount must be numeric"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { client_id, period, vendor_name, vendor_gstin, invoice_count, gstr2a_amount, gstr2b_amount, books_amount, remarks } = req.body;

  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(client_id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const g2a = parseFloat(gstr2a_amount) || 0;
  const g2b = parseFloat(gstr2b_amount) || 0;
  const bks = parseFloat(books_amount)  || 0;
  const diff = g2b - bks;

  let status = "matched";
  if (g2b === 0 && bks > 0) status = "missing";
  else if (Math.abs(diff) > 0) status = "mismatch";

  const id = uuid();
  db.prepare(`
    INSERT INTO reconciliation (id, user_id, client_id, period, vendor_name, vendor_gstin, invoice_count, gstr2a_amount, gstr2b_amount, books_amount, difference, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, client_id, period, vendor_name, vendor_gstin.toUpperCase(), invoice_count||0, g2a, g2b, bks, diff, status, remarks||null);

  const row = db.prepare("SELECT * FROM reconciliation WHERE id=?").get(id);
  res.status(201).json({ success: true, message: "Reconciliation entry added.", row });
});

// ── POST /api/reconciliation/bulk ─────────────────────────────────────────
// Upload multiple reconciliation entries at once
router.post("/bulk", (req, res) => {
  const { client_id, period, entries } = req.body;
  if (!client_id || !period || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, message: "client_id, period, and entries array are required." });
  }

  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(client_id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const insert = db.prepare(`
    INSERT INTO reconciliation (id, user_id, client_id, period, vendor_name, vendor_gstin, invoice_count, gstr2a_amount, gstr2b_amount, books_amount, difference, status, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items) => {
    let inserted = 0;
    for (const e of items) {
      const g2a = parseFloat(e.gstr2a_amount) || 0;
      const g2b = parseFloat(e.gstr2b_amount) || 0;
      const bks = parseFloat(e.books_amount)  || 0;
      const diff = g2b - bks;
      let status = "matched";
      if (g2b === 0 && bks > 0) status = "missing";
      else if (Math.abs(diff) > 0) status = "mismatch";

      insert.run(uuid(), req.user.id, client_id, period, e.vendor_name, (e.vendor_gstin||"").toUpperCase(), e.invoice_count||0, g2a, g2b, bks, diff, status, e.remarks||null);
      inserted++;
    }
    return inserted;
  });

  const count = insertMany(entries);
  res.status(201).json({ success: true, message: `${count} entries added.` });
});

// ── PUT /api/reconciliation/:id ────────────────────────────────────────────
router.put("/:id", (req, res) => {
  const row = db.prepare("SELECT id FROM reconciliation WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ success: false, message: "Entry not found." });

  const { gstr2a_amount, gstr2b_amount, books_amount, invoice_count, remarks } = req.body;
  const g2a = parseFloat(gstr2a_amount) || 0;
  const g2b = parseFloat(gstr2b_amount) || 0;
  const bks = parseFloat(books_amount)  || 0;
  const diff = g2b - bks;

  let status = "matched";
  if (g2b === 0 && bks > 0) status = "missing";
  else if (Math.abs(diff) > 0) status = "mismatch";

  db.prepare(`
    UPDATE reconciliation SET gstr2a_amount=?, gstr2b_amount=?, books_amount=?, difference=?, invoice_count=?, status=?, remarks=?, updated_at=datetime('now')
    WHERE id=?
  `).run(g2a, g2b, bks, diff, invoice_count||0, status, remarks||null, req.params.id);

  const updated = db.prepare("SELECT * FROM reconciliation WHERE id=?").get(req.params.id);
  res.json({ success: true, message: "Entry updated.", row: updated });
});

// ── DELETE /api/reconciliation/:id ────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const row = db.prepare("SELECT id FROM reconciliation WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ success: false, message: "Entry not found." });

  db.prepare("DELETE FROM reconciliation WHERE id=?").run(req.params.id);
  res.json({ success: true, message: "Entry deleted." });
});

// ── DELETE /api/reconciliation/clear ──────────────────────────────────────
router.delete("/clear/:client_id/:period", (req, res) => {
  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(req.params.client_id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const { changes } = db.prepare("DELETE FROM reconciliation WHERE user_id=? AND client_id=? AND period=?").run(req.user.id, req.params.client_id, req.params.period);
  res.json({ success: true, message: `${changes} entries deleted.` });
});

module.exports = router;

    

