    const express = require("express");
const db = require("../config/database");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

// ── GET /api/dashboard ─────────────────────────────────────────────────────
router.get("/", (req, res) => {
  const uid = req.user.id;
  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0];

  // Client counts
  const totalClients    = db.prepare("SELECT COUNT(*) as c FROM clients WHERE user_id=?").get(uid).c;
  const compliantCount  = db.prepare("SELECT COUNT(*) as c FROM clients WHERE user_id=? AND status='compliant'").get(uid).c;
  const pendingCount    = db.prepare("SELECT COUNT(*) as c FROM clients WHERE user_id=? AND status='pending'").get(uid).c;
  const overdueCount    = db.prepare("SELECT COUNT(*) as c FROM clients WHERE user_id=? AND status='overdue'").get(uid).c;

  // Notice counts
  const openNotices     = db.prepare("SELECT COUNT(*) as c FROM notices WHERE user_id=? AND status NOT IN ('closed','replied')").get(uid).c;
  const overdueNotices  = db.prepare("SELECT COUNT(*) as c FROM notices WHERE user_id=? AND status='overdue'").get(uid).c;
  const dueSoon         = db.prepare("SELECT COUNT(*) as c FROM notices WHERE user_id=? AND due_date BETWEEN ? AND ? AND status NOT IN ('closed','replied')").get(uid, today, in30Days).c;

  // Upcoming due notices (next 30 days)
  const upcomingNotices = db.prepare(`
    SELECT n.*, c.name AS client_name
    FROM notices n JOIN clients c ON n.client_id=c.id
    WHERE n.user_id=? AND n.due_date BETWEEN ? AND ? AND n.status NOT IN ('closed','replied')
    ORDER BY n.due_date ASC LIMIT 5
  `).all(uid, today, in30Days);

  // Recent clients
  const recentClients = db.prepare("SELECT * FROM clients WHERE user_id=? ORDER BY created_at DESC LIMIT 5").all(uid);

  // Returns summary (last period with data)
  const latestPeriod = db.prepare("SELECT period FROM returns WHERE user_id=? ORDER BY period DESC LIMIT 1").get(uid);
  let returnsSummary = null;
  if (latestPeriod) {
    const p = latestPeriod.period;
    const count = (field, status) =>
      db.prepare(`SELECT COUNT(*) as c FROM returns WHERE user_id=? AND period=? AND ${field}=?`).get(uid, p, status).c;
    returnsSummary = {
      period: p,
      gstr1:  { filed: count("gstr1_status","filed"),  pending: count("gstr1_status","pending"),  not_filed: count("gstr1_status","not-filed")  },
      gstr3b: { filed: count("gstr3b_status","filed"), pending: count("gstr3b_status","pending"), not_filed: count("gstr3b_status","not-filed") },
      gstr9:  { filed: count("gstr9_status","filed"),  pending: count("gstr9_status","pending"),  not_filed: count("gstr9_status","not-filed")  },
    };
  }

  // Top ITC risk clients
  const itcRisk = db.prepare(`
    SELECT r.client_id, c.name AS client_name, c.gstin,
           SUM(r.difference) AS total_risk,
           COUNT(CASE WHEN r.status='mismatch' THEN 1 END) AS mismatches,
           COUNT(CASE WHEN r.status='missing'  THEN 1 END) AS missing
    FROM reconciliation r JOIN clients c ON r.client_id=c.id
    WHERE r.user_id=?
    GROUP BY r.client_id
    ORDER BY ABS(total_risk) DESC LIMIT 5
  `).all(uid);

  res.json({
    success: true,
    dashboard: {
      clients: { total: totalClients, compliant: compliantCount, pending: pendingCount, overdue: overdueCount },
      notices: { open: openNotices, overdue: overdueNotices, due_in_30_days: dueSoon },
      upcoming_notices: upcomingNotices,
      recent_clients: recentClients,
      returns_summary: returnsSummary,
      itc_risk: itcRisk,
    }
  });
});

module.exports = router;

    

