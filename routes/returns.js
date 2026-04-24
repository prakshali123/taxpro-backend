    const express = require("express");
const { v4: uuid } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

const VALID_STATUSES = ["filed", "pending", "not-filed"];

// ── GET /api/returns ───────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { period, client_id } = req.query;

  let query = `
    SELECT r.*, c.name AS client_name, c.gstin
    FROM returns r
    JOIN clients c ON r.client_id = c.id
    WHERE r.user_id = ?
  `;
  const params = [req.user.id];

  if (period)    { query += " AND r.period = ?";    params.push(period);    }
  if (client_id) { query += " AND r.client_id = ?"; params.push(client_id); }

  query += " ORDER BY c.name ASC, r.period DESC";

  const returns = db.prepare(query).all(...params);
  res.json({ success: true, count: returns.length, returns });
});

// ── GET /api/returns/summary ───────────────────────────────────────────────
router.get("/summary", (req, res) => {
  const { period } = req.query;
  if (!period) return res.status(400).json({ success: false, message: "Period is required." });

  const count = (field, status) =>
    db.prepare(`SELECT COUNT(*) as cnt FROM returns WHERE user_id=? AND period=? AND ${field}=?`).get(req.user.id, period, status).cnt;

  res.json({
    success: true,
    period,
    summary: {
      gstr1:  { filed: count("gstr1_status","filed"),  pending: count("gstr1_status","pending"),  not_filed: count("gstr1_status","not-filed")  },
      gstr3b: { filed: count("gstr3b_status","filed"), pending: count("gstr3b_status","pending"), not_filed: count("gstr3b_status","not-filed") },
      gstr9:  { filed: count("gstr9_status","filed"),  pending: count("gstr9_status","pending"),  not_filed: count("gstr9_status","not-filed")  },
    }
  });
});

// ── GET /api/returns/:id ───────────────────────────────────────────────────
router.get("/:id", (req, res) => {
  const ret = db.prepare(`
    SELECT r.*, c.name AS client_name, c.gstin
    FROM returns r JOIN clients c ON r.client_id=c.id
    WHERE r.id=? AND r.user_id=?
  `).get(req.params.id, req.user.id);

  if (!ret) return res.status(404).json({ success: false, message: "Record not found." });
  res.json({ success: true, return: ret });
});

// ── POST /api/returns ──────────────────────────────────────────────────────
router.post("/", [
  body("client_id").notEmpty().withMessage("Client is required"),
  body("period").trim().notEmpty().withMessage("Period is required (e.g. FY 2024-25)"),
  body("gstr1_status").isIn(VALID_STATUSES).withMessage("Invalid GSTR-1 status"),
  body("gstr3b_status").isIn(VALID_STATUSES).withMessage("Invalid GSTR-3B status"),
  body("gstr9_status").isIn(VALID_STATUSES).withMessage("Invalid GSTR-9 status"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { client_id, period, gstr1_status, gstr3b_status, gstr9_status, gstr1_date, gstr3b_date, gstr9_date, notes } = req.body;

  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(client_id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const existing = db.prepare("SELECT id FROM returns WHERE user_id=? AND client_id=? AND period=?").get(req.user.id, client_id, period);
  if (existing) return res.status(409).json({ success: false, message: "Return record for this client and period already exists." });

  const id = uuid();
  db.prepare(`
    INSERT INTO returns (id, user_id, client_id, period, gstr1_status, gstr3b_status, gstr9_status, gstr1_date, gstr3b_date, gstr9_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, client_id, period, gstr1_status, gstr3b_status, gstr9_status, gstr1_date||null, gstr3b_date||null, gstr9_date||null, notes||null);

  const rec = db.prepare("SELECT * FROM returns WHERE id=?").get(id);
  res.status(201).json({ success: true, message: "Return record created.", return: rec });
});

// ── PUT /api/returns/:id ───────────────────────────────────────────────────
router.put("/:id", [
  body("gstr1_status").isIn(VALID_STATUSES).withMessage("Invalid GSTR-1 status"),
  body("gstr3b_status").isIn(VALID_STATUSES).withMessage("Invalid GSTR-3B status"),
  body("gstr9_status").isIn(VALID_STATUSES).withMessage("Invalid GSTR-9 status"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const rec = db.prepare("SELECT id FROM returns WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!rec) return res.status(404).json({ success: false, message: "Return record not found." });

  const { gstr1_status, gstr3b_status, gstr9_status, gstr1_date, gstr3b_date, gstr9_date, notes } = req.body;

  db.prepare(`
    UPDATE returns SET gstr1_status=?, gstr3b_status=?, gstr9_status=?,
    gstr1_date=?, gstr3b_date=?, gstr9_date=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(gstr1_status, gstr3b_status, gstr9_status, gstr1_date||null, gstr3b_date||null, gstr9_date||null, notes||null, req.params.id);

  const updated = db.prepare("SELECT * FROM returns WHERE id=?").get(req.params.id);
  res.json({ success: true, message: "Return updated.", return: updated });
});

// ── DELETE /api/returns/:id ────────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const rec = db.prepare("SELECT id FROM returns WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!rec) return res.status(404).json({ success: false, message: "Record not found." });

  db.prepare("DELETE FROM returns WHERE id=?").run(req.params.id);
  res.json({ success: true, message: "Return record deleted." });
});

module.exports = router;

    

