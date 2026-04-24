    const express = require("express");
const { v4: uuid } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const auth = require("../middleware/auth");

const router = express.Router();
// All routes require authentication
router.use(auth);

const VALID_STATUSES = ["compliant", "pending", "notice", "overdue"];
const VALID_TYPES    = ["Manufacturer", "Trader", "Exporter", "Importer", "Service", "Composition"];

// ── GET /api/clients ───────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const { search, status, type } = req.query;
  let query = "SELECT * FROM clients WHERE user_id = ?";
  const params = [req.user.id];

  if (search) {
    query += " AND (name LIKE ? OR gstin LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) { query += " AND status = ?"; params.push(status); }
  if (type)   { query += " AND type = ?";   params.push(type);   }

  query += " ORDER BY name ASC";

  const clients = db.prepare(query).all(...params);

  // Attach notice count to each client
  const withCounts = clients.map(c => {
    const noticeCount = db.prepare("SELECT COUNT(*) as cnt FROM notices WHERE client_id=? AND status != 'closed'").get(c.id);
    return { ...c, notice_count: noticeCount.cnt };
  });

  res.json({ success: true, count: clients.length, clients: withCounts });
});

// ── GET /api/clients/:id ───────────────────────────────────────────────────
router.get("/:id", (req, res) => {
  const client = db.prepare("SELECT * FROM clients WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const notices = db.prepare("SELECT * FROM notices WHERE client_id=? ORDER BY due_date ASC").all(client.id);
  const returns = db.prepare("SELECT * FROM returns WHERE client_id=? ORDER BY period DESC").all(client.id);

  res.json({ success: true, client: { ...client, notices, returns } });
});

// ── POST /api/clients ──────────────────────────────────────────────────────
router.post("/", [
  body("name").trim().notEmpty().withMessage("Client name is required"),
  body("gstin").trim().isLength({ min: 15, max: 15 }).withMessage("GSTIN must be 15 characters"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("type").isIn(VALID_TYPES).withMessage("Invalid business type"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, gstin, state, type, turnover, notes } = req.body;

  // Check GSTIN uniqueness for this user
  const exists = db.prepare("SELECT id FROM clients WHERE user_id=? AND gstin=?").get(req.user.id, gstin.toUpperCase());
  if (exists) return res.status(409).json({ success: false, message: "A client with this GSTIN already exists." });

  const id = uuid();
  db.prepare(`
    INSERT INTO clients (id, user_id, name, gstin, state, type, turnover, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, name, gstin.toUpperCase(), state, type, turnover || null, notes || null);

  const client = db.prepare("SELECT * FROM clients WHERE id=?").get(id);
  res.status(201).json({ success: true, message: "Client added successfully.", client });
});

// ── PUT /api/clients/:id ───────────────────────────────────────────────────
router.put("/:id", [
  body("name").trim().notEmpty().withMessage("Client name is required"),
  body("state").trim().notEmpty().withMessage("State is required"),
  body("type").isIn(VALID_TYPES).withMessage("Invalid business type"),
  body("status").isIn(VALID_STATUSES).withMessage("Invalid status"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  const { name, state, type, status, turnover, notes } = req.body;

  db.prepare(`
    UPDATE clients SET name=?, state=?, type=?, status=?, turnover=?, notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(name, state, type, status, turnover || null, notes || null, req.params.id);

  const updated = db.prepare("SELECT * FROM clients WHERE id=?").get(req.params.id);
  res.json({ success: true, message: "Client updated.", client: updated });
});

// ── DELETE /api/clients/:id ────────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const client = db.prepare("SELECT id FROM clients WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!client) return res.status(404).json({ success: false, message: "Client not found." });

  db.prepare("DELETE FROM clients WHERE id=?").run(req.params.id);
  res.json({ success: true, message: "Client deleted." });
});

module.exports = router;

    


