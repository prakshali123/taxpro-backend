    const express = require("express");
const { v4: uuid } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

const VALID_STATUSES  = ["pending", "in-progress", "replied", "closed", "overdue"];
const VALID_PRIORITIES = ["critical", "high", "medium", "low"];

// ── GET /api/notices ───────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { status, priority, client_id } = req.query;

  let query = `
    SELECT n.*, c.name AS client_name, c.gstin
    FROM notices n
    JOIN clients c ON n.client_id = c.id
    WHERE n.user_id = ?
  `;
  const params = [req.user.id];

  if (status)    { query += " AND n.status = ?";    params.push(status);    }
  if (priority)  { query += " AND n.priority = ?";  params.push(priority);  }
  if (client_id) { query += " AND n.client_id = ?"; params.push(client_id); }

  query += " ORDER BY n.due_date ASC";

  const notices = db.prepare(query).all(...params);
  res.json({ success: true, count: notices.length, notices });
});

// ── GET /api/notices/:id ───────────────────────────────────────────────────
router.get("/:id", (req, res) => {
  const notice = db.prepare(`
    SELECT n.*, c.name AS client_name, c.gstin
    FROM notices n JOIN clients c ON n.client_id = c.id
    WHERE n.id = ? AND n.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!notice) return res.status(404).json({ success: false, message: "Notice not found." });
  res.json({ success: true, notice });
});

// ── POST /api/notices ──────────────────────────────────────────────────────
router.post("/", [
  body("client_id").notEmpty().withMessage("Client is required"),
  body("ref_no").trim().notEmpty().withMessage("Reference number is required"),
  body("type").trim().notEmpty().withMessage("Notice type is required"),
  body("issued_date").isISO8601().withMessage("Valid issued date required"),
  body("due_date").isISO8601().withMessage("Valid due date required"),
  body("amount").isNumeric().withMessage("Amount must be a number"),
  body("priority").isIn(VALID_PRIORITIES).withMessage("Invalid priority"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { client_id, ref_no, type, issued_date, due_date, amount, priority, description } = req.body;

  // Verify client belongs to this user
  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(client_id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  // Auto-set overdue if due date has passed
  const today = new Date().toISOString().split("T")[0];
  const status = new Date(due_date) < new Date(today) ? "overdue" : "pending";

  const id = uuid();
  db.prepare(`
    INSERT INTO notices (id, user_id, client_id, ref_no, type, issued_date, due_date, amount, status, priority, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, client_id, ref_no, type, issued_date, due_date, amount, status, priority, description || null);

  const notice = db.prepare("SELECT * FROM notices WHERE id=?").get(id);
  res.status(201).json({ success: true, message: "Notice added.", notice });
});

// ── PUT /api/notices/:id ───────────────────────────────────────────────────
router.put("/:id", [
  body("status").isIn(VALID_STATUSES).withMessage("Invalid status"),
  body("priority").isIn(VALID_PRIORITIES).withMessage("Invalid priority"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const notice = db.prepare("SELECT id FROM notices WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found." });

  const { type, issued_date, due_date, amount, status, priority, description, reply_text } = req.body;

  db.prepare(`
    UPDATE notices SET type=?, issued_date=?, due_date=?, amount=?, status=?, priority=?,
    description=?, reply_text=?, updated_at=datetime('now') WHERE id=?
  `).run(type, issued_date, due_date, amount, status, priority, description || null, reply_text || null, req.params.id);

  const updated = db.prepare("SELECT * FROM notices WHERE id=?").get(req.params.id);
  res.json({ success: true, message: "Notice updated.", notice: updated });
});

// ── PATCH /api/notices/:id/status ─────────────────────────────────────────
router.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });

  const notice = db.prepare("SELECT id FROM notices WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found." });

  db.prepare("UPDATE notices SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.json({ success: true, message: "Status updated." });
});

// ── DELETE /api/notices/:id ────────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const notice = db.prepare("SELECT id FROM notices WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found." });

  db.prepare("DELETE FROM notices WHERE id=?").run(req.params.id);
  res.json({ success: true, message: "Notice deleted." });
});

module.exports = router;

    

