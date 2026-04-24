    const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const { body, validationResult } = require("express-validator");
const db = require("../config/database");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post("/register", [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("firm_name").trim().notEmpty().withMessage("Firm name is required"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, password, firm_name, frn } = req.body;

  try {
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const id = uuid();

    db.prepare(`
      INSERT INTO users (id, name, email, password, firm_name, frn)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, email, hashedPassword, firm_name, frn || null);

    const token = jwt.sign(
      { id, name, email, firm_name, role: "ca" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      token,
      user: { id, name, email, firm_name, frn, role: "ca" }
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error during registration." });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post("/login", [
  body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
  body("password").notEmpty().withMessage("Password is required"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, firm_name: user.firm_name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      success: true,
      message: "Login successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email, firm_name: user.firm_name, frn: user.frn, role: user.role }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get("/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, name, email, firm_name, frn, role, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  res.json({ success: true, user });
});

// ── PUT /api/auth/profile ──────────────────────────────────────────────────
router.put("/profile", authMiddleware, [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("firm_name").trim().notEmpty().withMessage("Firm name is required"),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, firm_name, frn } = req.body;
  db.prepare("UPDATE users SET name=?, firm_name=?, frn=? WHERE id=?").run(name, firm_name, frn || null, req.user.id);
  res.json({ success: true, message: "Profile updated." });
});

// ── POST /api/auth/change-password ────────────────────────────────────────
router.post("/change-password", authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, message: "Invalid password data." });
  }

  const user = db.prepare("SELECT password FROM users WHERE id=?").get(req.user.id);
  const isMatch = await bcrypt.compare(current_password, user.password);
  if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect." });

  const hashed = await bcrypt.hash(new_password, 12);
  db.prepare("UPDATE users SET password=? WHERE id=?").run(hashed, req.user.id);
  res.json({ success: true, message: "Password changed successfully." });
});

module.exports = router;

    

