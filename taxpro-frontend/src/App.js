import { useState, useRef, useEffect, useCallback } from "react";

const API = "http://localhost:5000/api";

// ── API Helper ─────────────────────────────────────────────────────────────
const api = async (path, method = "GET", body = null, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  app:       { display:"flex", minHeight:"100vh", fontFamily:"'Inter',sans-serif", fontSize:13, background:"#0D1117", color:"#C9D1D9" },
  sidebar:   { width:210, minWidth:210, background:"#161B22", borderRight:"1px solid #21262D", display:"flex", flexDirection:"column" },
  main:      { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  topbar:    { padding:"12px 20px", background:"#161B22", borderBottom:"1px solid #21262D", display:"flex", alignItems:"center", justifyContent:"space-between" },
  content:   { flex:1, overflowY:"auto", padding:18, background:"#0D1117" },
  card:      { background:"#161B22", border:"1px solid #21262D", borderRadius:10, padding:16, marginBottom:12 },
  cardTitle: { fontSize:13, fontWeight:600, color:"#E6EDF3", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" },
  kpiGrid:   { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 },
  kpi:       { background:"#161B22", border:"1px solid #21262D", borderRadius:10, padding:"14px 16px" },
  kpiLabel:  { fontSize:10, color:"#8B949E", textTransform:"uppercase", letterSpacing:0.6, marginBottom:6 },
  kpiVal:    { fontSize:26, fontWeight:700, lineHeight:1, color:"#E6EDF3" },
  kpiSub:    { fontSize:11, marginTop:4, color:"#8B949E" },
  tbl:       { width:"100%", borderCollapse:"collapse", fontSize:12 },
  th:        { textAlign:"left", padding:"8px 10px", color:"#8B949E", borderBottom:"1px solid #21262D", fontWeight:500, fontSize:11, letterSpacing:0.4 },
  td:        { padding:"8px 10px", borderBottom:"1px solid #21262D", color:"#C9D1D9", verticalAlign:"middle" },
  tdLast:    { padding:"8px 10px", color:"#C9D1D9", verticalAlign:"middle" },
  mono:      { fontFamily:"monospace", fontSize:11, color:"#8B949E" },
  twoCol:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
  input:     { padding:"9px 12px", borderRadius:8, border:"1px solid #30363D", background:"#0D1117", color:"#C9D1D9", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  select:    { padding:"7px 10px", borderRadius:8, border:"1px solid #30363D", background:"#161B22", color:"#C9D1D9", fontSize:12, fontFamily:"inherit" },
  btn:       { padding:"9px 18px", borderRadius:8, border:"none", background:"#1F6FEB", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"inherit" },
  btnGhost:  { padding:"7px 14px", borderRadius:8, border:"1px solid #30363D", background:"transparent", color:"#8B949E", cursor:"pointer", fontSize:12, fontFamily:"inherit" },
  btnDanger: { padding:"7px 14px", borderRadius:8, border:"1px solid #6e1c1c", background:"transparent", color:"#f85149", cursor:"pointer", fontSize:12, fontFamily:"inherit" },
  label:     { fontSize:12, color:"#8B949E", display:"block", marginBottom:5 },
  formGroup: { marginBottom:14 },
  aiWrap:    { display:"flex", flexDirection:"column", height:"calc(100vh - 100px)" },
  aiMsgs:    { flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10 },
  bubbleUser:{ background:"#1F6FEB", color:"#fff", padding:"9px 13px", borderRadius:"16px 16px 4px 16px", maxWidth:"78%", marginLeft:"auto", lineHeight:1.6, whiteSpace:"pre-wrap" },
  bubbleBot: { background:"#21262D", border:"1px solid #30363D", color:"#C9D1D9", padding:"9px 13px", borderRadius:"16px 16px 16px 4px", maxWidth:"84%", lineHeight:1.6, whiteSpace:"pre-wrap" },
};

const badge = (txt, color) => {
  const map = {
    green:  { bg:"#0d2818", color:"#3fb950", border:"#238636" },
    amber:  { bg:"#2d1b00", color:"#e3b341", border:"#9e6a03" },
    red:    { bg:"#2d0e0e", color:"#f85149", border:"#6e1c1c" },
    blue:   { bg:"#0c1d2e", color:"#58a6ff", border:"#1f4872" },
    gray:   { bg:"#21262D", color:"#8b949e", border:"#30363D" },
  };
  const c = map[color] || map.gray;
  return <span style={{ background:c.bg, color:c.color, border:`1px solid ${c.border}`, padding:"2px 8px", borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{txt}</span>;
};

const StatusBadge = ({ s }) => {
  const m = { compliant:["Compliant","green"], pending:["Pending","amber"], notice:["Notice","red"], overdue:["Overdue","red"] };
  const [l,c] = m[s]||[s,"gray"]; return badge(l,c);
};
const ReturnPill = ({ s }) => {
  const m = { filed:["Filed","green"], pending:["Pending","amber"], "not-filed":["Not Filed","red"] };
  const [l,c] = m[s]||[s,"gray"]; return badge(l,c);
};
const PrioBadge = ({ p }) => {
  const m = { critical:["Critical","red"], high:["High","amber"], medium:["Medium","blue"], low:["Low","gray"] };
  const [l,c] = m[p]||[p,"gray"]; return badge(l,c);
};

const Spinner = () => (
  <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:40 }}>
    <div style={{ width:28, height:28, border:"3px solid #21262D", borderTop:"3px solid #1F6FEB", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const Toast = ({ msg, type, onClose }) => (
  <div style={{ position:"fixed", bottom:24, right:24, zIndex:999, background:type==="error"?"#2d0e0e":"#0d2818", border:`1px solid ${type==="error"?"#6e1c1c":"#238636"}`, color:type==="error"?"#f85149":"#3fb950", padding:"12px 18px", borderRadius:10, fontSize:13, maxWidth:320, display:"flex", alignItems:"center", gap:10 }}>
    <span>{msg}</span>
    <button onClick={onClose} style={{ background:"none", border:"none", color:"inherit", cursor:"pointer", fontSize:16, marginLeft:"auto" }}>x</button>
  </div>
);

const Modal = ({ title, onClose, children }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
    <div style={{ background:"#161B22", border:"1px solid #30363D", borderRadius:12, padding:24, width:"min(500px,90vw)", maxHeight:"85vh", overflowY:"auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
        <span style={{ fontSize:15, fontWeight:600, color:"#E6EDF3" }}>{title}</span>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#8B949E", cursor:"pointer", fontSize:20 }}>x</button>
      </div>
      {children}
    </div>
  </div>
);

// ── Auth Screen ────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ name:"", email:"", password:"", firm_name:"", frn:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const endpoint = tab === "login" ? "/auth/login" : "/auth/register";
      const body = tab === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password, firm_name: form.firm_name, frn: form.frn };
      const data = await api(endpoint, "POST", body);
      localStorage.setItem("taxpro_token", data.token);
      localStorage.setItem("taxpro_user", JSON.stringify(data.user));
      onAuth(data.user, data.token);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0D1117", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif" }}>
      <div style={{ width:"min(420px,90vw)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:800, color:"#E6EDF3", letterSpacing:-0.5 }}>TaxPro GST</div>
          <div style={{ fontSize:13, color:"#8B949E", marginTop:6 }}>CA Practice Suite — India's GST Platform</div>
        </div>
        <div style={{ background:"#161B22", border:"1px solid #21262D", borderRadius:12, padding:28 }}>
          <div style={{ display:"flex", gap:4, marginBottom:22, background:"#0D1117", borderRadius:8, padding:4 }}>
            {["login","register"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"8px", borderRadius:6, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600, background:tab===t?"#1F6FEB":"transparent", color:tab===t?"#fff":"#8B949E" }}>
                {t === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>
          {tab === "register" && <>
            <div style={S.formGroup}><label style={S.label}>Full Name *</label><input style={S.input} placeholder="CA Rahul Prakash" value={form.name} onChange={set("name")} /></div>
            <div style={S.formGroup}><label style={S.label}>Firm Name *</label><input style={S.input} placeholder="Prakash and Associates" value={form.firm_name} onChange={set("firm_name")} /></div>
            <div style={S.formGroup}><label style={S.label}>FRN (optional)</label><input style={S.input} placeholder="001234N" value={form.frn} onChange={set("frn")} /></div>
          </>}
          <div style={S.formGroup}><label style={S.label}>Email *</label><input style={S.input} type="email" placeholder="you@firm.com" value={form.email} onChange={set("email")} onKeyDown={e => e.key==="Enter" && submit()} /></div>
          <div style={S.formGroup}><label style={S.label}>Password *</label><input style={S.input} type="password" placeholder="min 6 characters" value={form.password} onChange={set("password")} onKeyDown={e => e.key==="Enter" && submit()} /></div>
          {error && <div style={{ background:"#2d0e0e", border:"1px solid #6e1c1c", color:"#f85149", padding:"8px 12px", borderRadius:8, fontSize:12, marginBottom:14 }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{ ...S.btn, width:"100%", padding:"11px", opacity:loading?0.6:1 }}>
            {loading ? "Please wait..." : tab === "login" ? "Login" : "Create Account"}
          </button>
        </div>
        <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#8B949E" }}>TaxPro GST · Secure · ISO 27001 · GST Compliant</div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/dashboard", "GET", null, token)
      .then(d => { setData(d.dashboard); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return <Spinner />;
  if (!data) return <div style={{ color:"#f85149", padding:20 }}>Failed to load dashboard. Is the backend running?</div>;

  const { clients, notices, upcoming_notices=[], recent_clients=[], returns_summary } = data;

  return (
    <div>
      <div style={S.kpiGrid}>
        {[
          { label:"Total Clients",   val:clients.total,              sub:"across all states",           color:"#E6EDF3" },
          { label:"Compliant",       val:clients.compliant,          sub:`${clients.total?Math.round(clients.compliant/clients.total*100):0}% filing on time`, color:"#3fb950" },
          { label:"Open Notices",    val:notices.open,               sub:"require urgent action",       color:"#f85149" },
          { label:"Due in 30 Days",  val:notices.due_in_30_days,     sub:"notices expiring soon",       color:"#e3b341" },
        ].map(k => (
          <div key={k.label} style={S.kpi}>
            <div style={S.kpiLabel}>{k.label}</div>
            <div style={{ ...S.kpiVal, color:k.color }}>{k.val}</div>
            <div style={S.kpiSub}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={S.twoCol}>
        <div style={S.card}>
          <div style={S.cardTitle}>Recent clients</div>
          {recent_clients.length === 0
            ? <div style={{ color:"#8B949E", fontSize:12, padding:"8px 0" }}>No clients yet. Go to Clients to add your first client.</div>
            : recent_clients.map(c => (
              <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #21262D" }}>
                <div>
                  <div style={{ fontWeight:500, color:"#E6EDF3", fontSize:12 }}>{c.name}</div>
                  <div style={S.mono}>{c.gstin}</div>
                </div>
                <StatusBadge s={c.status} />
              </div>
            ))
          }
        </div>
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Upcoming notice due dates</div>
            {upcoming_notices.length === 0
              ? <div style={{ color:"#3fb950", fontSize:12, padding:"8px 0" }}>No notices due in the next 30 days</div>
              : upcoming_notices.map(n => (
                <div key={n.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #21262D" }}>
                  <div>
                    <div style={{ fontWeight:500, color:"#E6EDF3", fontSize:12 }}>{n.type}</div>
                    <div style={{ fontSize:11, color:"#8B949E" }}>{n.client_name}</div>
                  </div>
                  {badge(n.due_date, n.status==="overdue"?"red":"amber")}
                </div>
              ))
            }
          </div>
          {returns_summary && (
            <div style={S.card}>
              <div style={S.cardTitle}>Filing summary — {returns_summary.period}</div>
              <table style={S.tbl}>
                <thead><tr>{["Return","Filed","Pending","Not Filed"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {[["GSTR-1","gstr1"],["GSTR-3B","gstr3b"],["GSTR-9","gstr9"]].map(([lbl,key]) => (
                    <tr key={key}>
                      <td style={S.td}>{lbl}</td>
                      <td style={{ ...S.td, color:"#3fb950", fontWeight:600 }}>{returns_summary[key].filed}</td>
                      <td style={{ ...S.td, color:"#e3b341", fontWeight:600 }}>{returns_summary[key].pending}</td>
                      <td style={{ ...S.tdLast, color:"#f85149", fontWeight:600 }}>{returns_summary[key].not_filed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Clients ────────────────────────────────────────────────────────────────
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal"];
const TYPES = ["Manufacturer","Trader","Exporter","Importer","Service","Composition"];

function Clients({ token, toast }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name:"", gstin:"", state:"", type:"Trader", turnover:"", notes:"", status:"compliant" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api(`/clients${q?`?search=${encodeURIComponent(q)}`:""}`, "GET", null, token)
      .then(d => { setClients(d.clients); setLoading(false); }).catch(() => setLoading(false));
  }, [token, q]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ name:"", gstin:"", state:"", type:"Trader", turnover:"", notes:"", status:"compliant" }); setShowModal(true); };
  const openEdit = c => { setEditing(c); setForm({ name:c.name, gstin:c.gstin, state:c.state, type:c.type, turnover:c.turnover||"", notes:c.notes||"", status:c.status }); setShowModal(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) { await api(`/clients/${editing.id}`, "PUT", form, token); toast("Client updated", "success"); }
      else { await api("/clients", "POST", form, token); toast("Client added", "success"); }
      setShowModal(false); load();
    } catch (e) { toast(e.message, "error"); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm("Delete this client and all their data?")) return;
    try { await api(`/clients/${id}`, "DELETE", null, token); toast("Client deleted", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==="Enter" && load()} placeholder="Search by name or GSTIN..." style={{ ...S.input, width:280 }} />
        <button onClick={load} style={S.btnGhost}>Search</button>
        <button onClick={openAdd} style={{ ...S.btn, marginLeft:"auto" }}>+ Add Client</button>
      </div>
      {loading ? <Spinner /> : (
        <div style={S.card}>
          {clients.length === 0
            ? <div style={{ textAlign:"center", padding:40, color:"#8B949E" }}>No clients found. Click "Add Client" to get started.</div>
            : <table style={S.tbl}>
                <thead><tr>{["Client Name","GSTIN","State","Type","Status","Notices","Turnover","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...S.td, fontWeight:600, color:"#E6EDF3" }}>{c.name}</td>
                      <td style={S.td}><span style={S.mono}>{c.gstin}</span></td>
                      <td style={S.td}>{c.state}</td>
                      <td style={S.td}>{badge(c.type,"gray")}</td>
                      <td style={S.td}><StatusBadge s={c.status} /></td>
                      <td style={S.td}>{c.notice_count>0?<span style={{ color:"#f85149",fontWeight:700 }}>{c.notice_count}</span>:<span style={{ color:"#3fb950" }}>0</span>}</td>
                      <td style={S.td}>{c.turnover||"—"}</td>
                      <td style={S.tdLast}><div style={{ display:"flex", gap:6 }}><button onClick={()=>openEdit(c)} style={S.btnGhost}>Edit</button><button onClick={()=>del(c.id)} style={S.btnDanger}>Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}
      {showModal && (
        <Modal title={editing?"Edit Client":"Add New Client"} onClose={()=>setShowModal(false)}>
          {[{label:"Client Name *",key:"name",ph:"Sharma Textiles Pvt Ltd"},{label:"GSTIN *",key:"gstin",ph:"09AABCS1429B1Z7"},{label:"Turnover",key:"turnover",ph:"2.4 Cr"}].map(f=>(
            <div key={f.key} style={S.formGroup}><label style={S.label}>{f.label}</label><input style={S.input} placeholder={f.ph} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} /></div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={S.formGroup}><label style={S.label}>State *</label>
              <select style={{ ...S.select, width:"100%" }} value={form.state} onChange={e=>setForm(p=>({...p,state:e.target.value}))}>
                <option value="">Select state</option>{STATES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={S.formGroup}><label style={S.label}>Type *</label>
              <select style={{ ...S.select, width:"100%" }} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                {TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {editing && <div style={S.formGroup}><label style={S.label}>Status</label>
            <select style={{ ...S.select, width:"100%" }} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
              {["compliant","pending","notice","overdue"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>}
          <div style={S.formGroup}><label style={S.label}>Notes</label><textarea style={{ ...S.input, resize:"vertical", minHeight:60 }} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} /></div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowModal(false)} style={S.btnGhost}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...S.btn, opacity:saving?0.6:1 }}>{saving?"Saving...":"Save Client"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Notices ────────────────────────────────────────────────────────────────
function Notices({ token, toast }) {
  const [notices, setNotices] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ client_id:"", ref_no:"", type:"", issued_date:"", due_date:"", amount:"", priority:"medium", description:"" });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api(`/notices${filter!=="all"?`?status=${filter}`:""}`, "GET", null, token),
      api("/clients", "GET", null, token),
    ]).then(([nd,cd]) => { setNotices(nd.notices); setClients(cd.clients); setLoading(false); }).catch(()=>setLoading(false));
  }, [token, filter]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/notices", "POST", { ...form, amount:parseFloat(form.amount)||0 }, token);
      toast("Notice added","success"); setShowModal(false); load();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    try { await api(`/notices/${id}/status`, "PATCH", { status }, token); load(); }
    catch(e) { toast(e.message,"error"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    try { await api(`/notices/${id}`, "DELETE", null, token); toast("Deleted","success"); load(); }
    catch(e) { toast(e.message,"error"); }
  };

  const tabs = ["all","pending","in-progress","overdue","replied","closed"];

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        {tabs.map(t => (
          <button key={t} onClick={()=>setFilter(t)} style={{ padding:"5px 14px", borderRadius:20, border:"1px solid", cursor:"pointer", fontSize:12, fontFamily:"inherit", borderColor:filter===t?"#58a6ff":"#30363D", background:filter===t?"#0c1d2e":"transparent", color:filter===t?"#58a6ff":"#8B949E", fontWeight:filter===t?600:400 }}>
            {t==="all"?"All":t==="in-progress"?"In Progress":t.charAt(0).toUpperCase()+t.slice(1)}
            {t==="all"?` (${notices.length})`:""}
          </button>
        ))}
        <button onClick={()=>setShowModal(true)} style={{ ...S.btn, marginLeft:"auto", padding:"5px 14px" }}>+ Add Notice</button>
      </div>
      {loading ? <Spinner /> : (
        <div style={S.card}>
          {notices.length===0
            ? <div style={{ textAlign:"center", padding:40, color:"#8B949E" }}>No notices found.</div>
            : <table style={S.tbl}>
                <thead><tr>{["Ref No.","Client","Type","Issued","Due Date","Amount","Priority","Status","Action"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {notices.map(n=>(
                    <tr key={n.id}>
                      <td style={S.td}><span style={S.mono}>{n.ref_no}</span></td>
                      <td style={S.td}><div style={{ fontWeight:500, color:"#E6EDF3" }}>{n.client_name}</div><div style={S.mono}>{n.gstin}</div></td>
                      <td style={S.td}>{n.type}</td>
                      <td style={S.td}>{n.issued_date}</td>
                      <td style={{ ...S.td, color:n.status==="overdue"?"#f85149":"#C9D1D9", fontWeight:n.status==="overdue"?700:400 }}>{n.due_date}</td>
                      <td style={{ ...S.td, fontWeight:600 }}>Rs.{Number(n.amount).toLocaleString("en-IN")}</td>
                      <td style={S.td}><PrioBadge p={n.priority} /></td>
                      <td style={S.td}>
                        <select value={n.status} onChange={e=>updateStatus(n.id,e.target.value)} style={{ ...S.select, fontSize:11, padding:"3px 6px" }}>
                          {["pending","in-progress","replied","closed","overdue"].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={S.tdLast}><button onClick={()=>del(n.id)} style={S.btnDanger}>Del</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}
      {showModal && (
        <Modal title="Add GST Notice" onClose={()=>setShowModal(false)}>
          <div style={S.formGroup}><label style={S.label}>Client *</label>
            <select style={{ ...S.select, width:"100%" }} value={form.client_id} onChange={e=>setForm(p=>({...p,client_id:e.target.value}))}>
              <option value="">Select client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {[{l:"Reference No. *",k:"ref_no",ph:"ZD071125006543C"},{l:"Notice Type *",k:"type",ph:"GSTR-1 vs 3B Mismatch"},{l:"Amount (Rs.) *",k:"amount",ph:"124500",t:"number"}].map(f=>(
            <div key={f.k} style={S.formGroup}><label style={S.label}>{f.l}</label><input style={S.input} type={f.t||"text"} placeholder={f.ph} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} /></div>
          ))}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={S.formGroup}><label style={S.label}>Issued Date *</label><input style={S.input} type="date" value={form.issued_date} onChange={e=>setForm(p=>({...p,issued_date:e.target.value}))} /></div>
            <div style={S.formGroup}><label style={S.label}>Due Date *</label><input style={S.input} type="date" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} /></div>
          </div>
          <div style={S.formGroup}><label style={S.label}>Priority</label>
            <select style={{ ...S.select, width:"100%" }} value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}>
              {["critical","high","medium","low"].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={S.formGroup}><label style={S.label}>Description</label><textarea style={{ ...S.input, resize:"vertical", minHeight:60 }} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowModal(false)} style={S.btnGhost}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...S.btn, opacity:saving?0.6:1 }}>{saving?"Saving...":"Add Notice"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Returns ────────────────────────────────────────────────────────────────
function Returns({ token, toast }) {
  const [returns, setReturns] = useState([]);
  const [clients, setClients] = useState([]);
  const [period, setPeriod] = useState("FY 2024-25");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ client_id:"", period:"FY 2024-25", gstr1_status:"not-filed", gstr3b_status:"not-filed", gstr9_status:"not-filed" });
  const PERIODS = ["FY 2024-25","FY 2023-24","FY 2022-23","FY 2021-22"];

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api(`/returns?period=${encodeURIComponent(period)}`, "GET", null, token),
      api("/clients", "GET", null, token),
    ]).then(([rd,cd])=>{ setReturns(rd.returns); setClients(cd.clients); setLoading(false); }).catch(()=>setLoading(false));
  }, [token, period]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/returns", "POST", form, token);
      toast("Record saved","success"); setShowModal(false); load();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };

  const updateField = async (id, key, val) => {
    const rec = returns.find(r=>r.id===id);
    if (!rec) return;
    try { await api(`/returns/${id}`, "PUT", {...rec,[key]:val}, token); load(); }
    catch(e) { toast(e.message,"error"); }
  };

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:14, alignItems:"center" }}>
        <span style={{ fontSize:12, color:"#8B949E" }}>Financial Year:</span>
        <select style={S.select} value={period} onChange={e=>setPeriod(e.target.value)}>{PERIODS.map(p=><option key={p}>{p}</option>)}</select>
        <button onClick={()=>{ setForm(f=>({...f,period})); setShowModal(true); }} style={{ ...S.btn, marginLeft:"auto" }}>+ Add Record</button>
      </div>
      {loading ? <Spinner /> : (
        <div style={S.card}>
          {returns.length===0
            ? <div style={{ textAlign:"center", padding:40, color:"#8B949E" }}>No return records for {period}.</div>
            : <table style={S.tbl}>
                <thead><tr>{["Client","GSTIN","GSTR-1","GSTR-3B","GSTR-9","Overall"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {returns.map(r=>{
                    const all=[r.gstr1_status,r.gstr3b_status,r.gstr9_status];
                    const ov=all.every(s=>s==="filed")?"compliant":all.some(s=>s==="not-filed")?"overdue":"pending";
                    return (
                      <tr key={r.id}>
                        <td style={{ ...S.td, fontWeight:500, color:"#E6EDF3" }}>{r.client_name}</td>
                        <td style={S.td}><span style={S.mono}>{r.gstin}</span></td>
                        {[["gstr1_status"],["gstr3b_status"],["gstr9_status"]].map(([key])=>(
                          <td key={key} style={S.td}>
                            <select value={r[key]} onChange={e=>updateField(r.id,key,e.target.value)} style={{ ...S.select, fontSize:11, padding:"3px 6px" }}>
                              {["filed","pending","not-filed"].map(s=><option key={s}>{s}</option>)}
                            </select>
                          </td>
                        ))}
                        <td style={S.tdLast}><StatusBadge s={ov} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          }
        </div>
      )}
      {showModal && (
        <Modal title="Add Return Record" onClose={()=>setShowModal(false)}>
          <div style={S.formGroup}><label style={S.label}>Client *</label>
            <select style={{ ...S.select, width:"100%" }} value={form.client_id} onChange={e=>setForm(p=>({...p,client_id:e.target.value}))}>
              <option value="">Select client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={S.formGroup}><label style={S.label}>Period *</label>
            <select style={{ ...S.select, width:"100%" }} value={form.period} onChange={e=>setForm(p=>({...p,period:e.target.value}))}>{PERIODS.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          {[["gstr1_status","GSTR-1 Status"],["gstr3b_status","GSTR-3B Status"],["gstr9_status","GSTR-9 Status"]].map(([key,lbl])=>(
            <div key={key} style={S.formGroup}><label style={S.label}>{lbl}</label>
              <select style={{ ...S.select, width:"100%" }} value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}>
                {["not-filed","pending","filed"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowModal(false)} style={S.btnGhost}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...S.btn, opacity:saving?0.6:1 }}>{saving?"Saving...":"Save Record"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Reconciliation ─────────────────────────────────────────────────────────
function Reconciliation({ token, toast }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [period, setPeriod] = useState("FY 2024-25");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor_name:"", vendor_gstin:"", invoice_count:"", gstr2a_amount:"", gstr2b_amount:"", books_amount:"", remarks:"" });

  useEffect(() => {
    api("/clients","GET",null,token).then(d=>{ setClients(d.clients); if(d.clients.length) setClientId(d.clients[0].id); });
  }, [token]);

  const load = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    api(`/reconciliation?client_id=${clientId}&period=${encodeURIComponent(period)}`, "GET", null, token)
      .then(d=>{ setData(d); setLoading(false); }).catch(()=>setLoading(false));
  }, [token, clientId, period]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/reconciliation", "POST", { ...form, client_id:clientId, period, invoice_count:parseInt(form.invoice_count)||0, gstr2a_amount:parseFloat(form.gstr2a_amount)||0, gstr2b_amount:parseFloat(form.gstr2b_amount)||0, books_amount:parseFloat(form.books_amount)||0 }, token);
      toast("Entry added","success"); setShowModal(false); setForm({ vendor_name:"", vendor_gstin:"", invoice_count:"", gstr2a_amount:"", gstr2b_amount:"", books_amount:"", remarks:"" }); load();
    } catch(e) { toast(e.message,"error"); }
    setSaving(false);
  };

  const del = async (id) => {
    try { await api(`/reconciliation/${id}`,"DELETE",null,token); toast("Deleted","success"); load(); }
    catch(e) { toast(e.message,"error"); }
  };

  const fmt = n => `Rs.${Number(n||0).toLocaleString("en-IN")}`;

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:"#8B949E" }}>Client:</span>
        <select style={S.select} value={clientId} onChange={e=>setClientId(e.target.value)}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <span style={{ fontSize:12, color:"#8B949E" }}>Period:</span>
        <select style={S.select} value={period} onChange={e=>setPeriod(e.target.value)}>{["FY 2024-25","FY 2023-24","FY 2022-23"].map(p=><option key={p}>{p}</option>)}</select>
        <button onClick={()=>setShowModal(true)} style={{ ...S.btn, marginLeft:"auto" }}>+ Add Entry</button>
      </div>
      {data?.summary && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
          {[{l:"Matched",v:data.summary.matched,c:"#3fb950"},{l:"Mismatched",v:data.summary.mismatch,c:"#e3b341"},{l:"Missing",v:data.summary.missing,c:"#f85149"},{l:"ITC Risk",v:fmt(data.summary.total_itc_risk),c:"#f85149"}].map(k=>(
            <div key={k.l} style={{ ...S.kpi, textAlign:"center" }}>
              <div style={S.kpiLabel}>{k.l}</div>
              <div style={{ fontSize:20, fontWeight:700, color:k.c }}>{k.v}</div>
            </div>
          ))}
        </div>
      )}
      {loading ? <Spinner /> : (
        <div style={S.card}>
          {!data||data.rows.length===0
            ? <div style={{ textAlign:"center", padding:40, color:"#8B949E" }}>No entries. Add vendor reconciliation data using the button above.</div>
            : <table style={S.tbl}>
                <thead><tr>{["Vendor","GSTIN","Inv","GSTR-2A","GSTR-2B","Books","Difference","Status",""].map((h,i)=><th key={i} style={{ ...S.th, textAlign:i>=3&&i<=6?"right":"left" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.rows.map(r=>(
                    <tr key={r.id}>
                      <td style={{ ...S.td, fontWeight:500, color:"#E6EDF3" }}>{r.vendor_name}</td>
                      <td style={S.td}><span style={S.mono}>{r.vendor_gstin}</span></td>
                      <td style={S.td}>{r.invoice_count}</td>
                      <td style={{ ...S.td, textAlign:"right" }}>{fmt(r.gstr2a_amount)}</td>
                      <td style={{ ...S.td, textAlign:"right" }}>{fmt(r.gstr2b_amount)}</td>
                      <td style={{ ...S.td, textAlign:"right" }}>{fmt(r.books_amount)}</td>
                      <td style={{ ...S.td, textAlign:"right", fontWeight:r.difference!==0?700:400, color:r.difference<0?"#f85149":r.difference>0?"#e3b341":"#3fb950" }}>{r.difference===0?"—":fmt(r.difference)}</td>
                      <td style={S.td}>{r.status==="matched"?badge("Matched","green"):r.status==="mismatch"?badge("Mismatch","amber"):badge("Missing","red")}</td>
                      <td style={S.tdLast}><button onClick={()=>del(r.id)} style={S.btnDanger}>Del</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}
      {showModal && (
        <Modal title="Add Reconciliation Entry" onClose={()=>setShowModal(false)}>
          {[{l:"Vendor Name *",k:"vendor_name",ph:"ABC Suppliers Pvt Ltd"},{l:"Vendor GSTIN *",k:"vendor_gstin",ph:"07AABCA1234B1Z5"},{l:"Invoice Count",k:"invoice_count",ph:"12",t:"number"},{l:"GSTR-2A Amount",k:"gstr2a_amount",ph:"145000",t:"number"},{l:"GSTR-2B Amount",k:"gstr2b_amount",ph:"143000",t:"number"},{l:"Books Amount *",k:"books_amount",ph:"147000",t:"number"},{l:"Remarks",k:"remarks",ph:""}].map(f=>(
            <div key={f.k} style={S.formGroup}><label style={S.label}>{f.l}</label><input style={S.input} type={f.t||"text"} placeholder={f.ph} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} /></div>
          ))}
          <div style={{ padding:"8px 10px", background:"#0c1d2e", border:"1px solid #1f4872", borderRadius:8, fontSize:12, color:"#58a6ff", marginBottom:12 }}>
            Status (matched/mismatch/missing) and difference are auto-calculated by the backend.
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={()=>setShowModal(false)} style={S.btnGhost}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ ...S.btn, opacity:saving?0.6:1 }}>{saving?"Saving...":"Add Entry"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── AI Assistant ───────────────────────────────────────────────────────────
function AIAssistant() {
  const [msgs, setMsgs] = useState([{ role:"assistant", content:"Namaste! I'm your AI GST Assistant powered by Claude.\n\nAsk me anything — notice responses, ITC claims, reconciliation queries, GSTR deadlines, DRC-01 replies, or any GST compliance question." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setMsgs(prev => [...prev, { role:"user", content:msg }]);
    setLoading(true);
    try {
      const history = msgs.map(m => ({ role:m.role, content:m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:"You are an expert Indian GST consultant assisting a Chartered Accountant. Deep expertise in CGST/IGST Acts, ITC Sections 16-18, GSTR returns, GST notices (DRC-01, ASMT-10, SCN), reconciliation, e-invoicing, RCM. Be concise and cite sections when relevant. Use Rs. for rupees.",
          messages:[...history,{role:"user",content:msg}] })
      });
      const data = await res.json();
      setMsgs(prev=>[...prev,{role:"assistant",content:data.content?.[0]?.text||"Sorry, could not process that."}]);
    } catch { setMsgs(prev=>[...prev,{role:"assistant",content:"Connection error. Please try again."}]); }
    setLoading(false);
  };

  const chips = ["How to respond to DRC-01?","GSTR-2B vs 2A key differences","ITC reversal under Rule 42","Section 16(4) time limit for ITC","GSTR-9 due date FY 2024-25","RCM applicability list"];

  return (
    <div style={S.aiWrap}>
      <div style={S.aiMsgs}>
        {msgs.map((m,i)=>(
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant"&&<div style={{ width:28,height:28,borderRadius:"50%",background:"#1F6FEB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,marginRight:8,flexShrink:0,marginTop:2 }}>A</div>}
            <div style={m.role==="user"?S.bubbleUser:S.bubbleBot}>{m.content}</div>
          </div>
        ))}
        {loading&&<div style={{ display:"flex",gap:8 }}><div style={{ width:28,height:28,borderRadius:"50%",background:"#1F6FEB",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13 }}>A</div><div style={{ ...S.bubbleBot,color:"#8B949E" }}>Thinking...</div></div>}
        <div ref={endRef} />
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", padding:"8px 14px" }}>
        {chips.map(c=><button key={c} onClick={()=>send(c)} disabled={loading} style={{ padding:"4px 10px", borderRadius:20, border:"1px solid #30363D", background:"transparent", color:"#8B949E", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{c}</button>)}
      </div>
      <div style={{ display:"flex", gap:8, padding:"12px 14px", borderTop:"1px solid #21262D" }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask your GST query..." disabled={loading} style={{ ...S.input, flex:1 }} />
        <button onClick={()=>send()} disabled={loading||!input.trim()} style={{ ...S.btn, opacity:loading||!input.trim()?0.5:1 }}>Send</button>
      </div>
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────────────────────────
const NAV = [
  {key:"dashboard",icon:"D",label:"Dashboard"},{key:"clients",icon:"C",label:"Clients"},
  {key:"reconciliation",icon:"R",label:"Reconciliation"},{key:"notices",icon:"N",label:"Notice Manager"},
  {key:"returns",icon:"F",label:"Return Tracker"},{key:"ai",icon:"A",label:"AI GST Assistant"},
];
const TITLES = {dashboard:"Dashboard",clients:"Client Manager",reconciliation:"GST Reconciliation",notices:"Notice Manager",returns:"Return Filing Tracker",ai:"AI GST Assistant"};

export default function App() {
  const [user, setUser]   = useState(()=>{ try{ return JSON.parse(localStorage.getItem("taxpro_user")); }catch{ return null; } });
  const [token, setToken] = useState(()=>localStorage.getItem("taxpro_token")||"");
  const [view, setView]   = useState("dashboard");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3500); };
  const logout = () => { localStorage.removeItem("taxpro_token"); localStorage.removeItem("taxpro_user"); setUser(null); setToken(""); };
  const onAuth = (u,t) => { setUser(u); setToken(t); };

  if (!user||!token) return <AuthScreen onAuth={onAuth} />;

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={{ padding:"16px", borderBottom:"1px solid #21262D" }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#E6EDF3", letterSpacing:-0.3 }}>TaxPro GST</div>
          <div style={{ fontSize:11, color:"#8B949E", marginTop:2 }}>CA Practice Suite</div>
        </div>
        <nav style={{ flex:1, padding:"8px 0" }}>
          {NAV.map(n=>(
            <button key={n.key} onClick={()=>setView(n.key)} style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"9px 16px", border:"none", background:view===n.key?"#1F6FEB18":"transparent", borderLeft:view===n.key?"2px solid #1F6FEB":"2px solid transparent", color:view===n.key?"#58a6ff":"#8B949E", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:view===n.key?600:400, textAlign:"left" }}>
              <span style={{ fontSize:14, width:18, height:18, borderRadius:4, background:view===n.key?"#1F6FEB":"#21262D", display:"flex", alignItems:"center", justifyContent:"center", color:view===n.key?"#fff":"#8B949E", fontWeight:700, flexShrink:0 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div style={{ padding:"12px 16px", borderTop:"1px solid #21262D" }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#E6EDF3" }}>{user.firm_name||user.name}</div>
          <div style={{ fontSize:11, color:"#8B949E", marginTop:2 }}>{user.frn?`FRN: ${user.frn}`:user.email}</div>
          <button onClick={logout} style={{ ...S.btnGhost, marginTop:10, width:"100%", fontSize:11, padding:"6px" }}>Logout</button>
        </div>
      </aside>
      <div style={S.main}>
        <div style={S.topbar}>
          <span style={{ fontSize:15, fontWeight:600, color:"#E6EDF3" }}>{TITLES[view]}</span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#8B949E" }}>Welcome, {user.name}</span>
            {badge("Live Backend","green")}
          </div>
        </div>
        <div style={S.content}>
          {view==="dashboard"      && <Dashboard      token={token} />}
          {view==="clients"        && <Clients        token={token} toast={showToast} />}
          {view==="reconciliation" && <Reconciliation token={token} toast={showToast} />}
          {view==="notices"        && <Notices        token={token} toast={showToast} />}
          {view==="returns"        && <Returns        token={token} toast={showToast} />}
          {view==="ai"             && <AIAssistant />}
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)} />}
    </div>
  );
}

