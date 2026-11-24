/* ===== Sistem Pembagian Tugas =====
   Database: data/db.json (data awal) -> disimpan ke localStorage selama dipakai */
const KEY = "pembagian_tugas_db";
const DB_FILE = "data/db.json";
let db = { petugas: [], tugas: [] };
let step = 1;
const notified = new Set();

const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const STEPS = ["Data Petugas", "Tugas & Pembagian", "Checklist Petugas"];

/* ---------- Database JSON ---------- */
async function loadDB() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) { db = JSON.parse(s); return; }
  } catch (e) {}
  try {
    const r = await fetch(DB_FILE);          // butuh server lokal (mis. Live Server)
    db = await r.json();
    save();
  } catch (e) {
    db = { petugas: [], tugas: [] };         // jika dibuka langsung (file://) mulai dari kosong
  }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

/* ---------- Helper ---------- */
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmt = (s, t) => {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d)) return "-";
  return d.toLocaleString("id-ID", t ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
};
const dur = ms => {
  ms = Math.abs(ms);
  const m = Math.floor(ms / 6e4), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return d + " hari " + (h % 24) + " jam";
  if (h >= 1) return h + " jam " + (m % 60) + " menit";
  return Math.max(m, 1) + " menit";
};
const nama = id => { const p = db.petugas.find(x => x.id === id); return p ? p.nama : "Belum dibagi"; };

function status(t) {
  if (!t.deadline) return { k: "nor", l: "Tanpa deadline" };
  const dl = new Date(t.deadline).getTime(), now = Date.now();
  if (t.selesai) {
    const at = t.selesaiPada ? new Date(t.selesaiPada).getTime() : now;
    return at > dl ? { k: "late", l: "Selesai terlambat" } : { k: "ok", l: "Selesai tepat waktu" };
  }
  if (now > dl) return { k: "late", l: "Terlambat " + dur(now - dl) };
  if (dl - now < 864e5) return { k: "soon", l: "Sisa " + dur(dl - now) };
  return { k: "ok", l: "Sisa " + dur(dl - now) };
}

/* ---------- Pemberitahuan ---------- */
function checkAlerts() {
  const now = Date.now();
  const late = db.tugas.filter(t => !t.selesai && t.deadline && new Date(t.deadline).getTime() < now);
  const soon = db.tugas.filter(t => !t.selesai && t.deadline && new Date(t.deadline).getTime() >= now && new Date(t.deadline).getTime() - now < 864e5);
  let h = "";
  if (late.length) h += `<div class="alert late"><b>⚠ ${late.length} tugas melewati deadline!</b>${late.map(t => `<div>${esc(t.judul)} — ${esc(nama(t.petugas))} (terlambat ${dur(now - new Date(t.deadline))})</div>`).join("")}</div>`;
  if (soon.length) h += `<div class="alert soon"><b>⏰ ${soon.length} tugas segera jatuh tempo (&lt; 24 jam)</b>${soon.map(t => `<div>${esc(t.judul)} — ${esc(nama(t.petugas))} (sisa ${dur(new Date(t.deadline) - now)})</div>`).join("")}</div>`;
  $("alerts").innerHTML = h;
  document.title = (late.length ? "(" + late.length + ") " : "") + "Sistem Pembagian Tugas";
  late.forEach(t => {
    if (!notified.has(t.id)) {
      notified.add(t.id);
      toast(`Deadline terlewat: ${t.judul} (${nama(t.petugas)})`);
    }
  });
}
function toast(m) {
  const d = document.createElement("div");
  d.textContent = "⚠ " + m;
  $("toast").appendChild(d);
  setTimeout(() => d.remove(), 6000);
}

/* ---------- Navigasi ---------- */
function go(n) { step = n; render(); }
function render() {
  $("steps").innerHTML = STEPS.map((t, i) => `<button class="step ${step == i + 1 ? "on" : ""}" onclick="go(${i + 1})"><b>${i + 1}</b>${t}</button>`).join("");
  [v1, v2, v3][step - 1]();
  checkAlerts();
}
function navBtns() {
  return `<div class="nav">${step > 1 ? `<button class="b g" onclick="go(${step - 1})">← Kembali</button>` : "<span></span>"}${step < 3 ? `<button class="b" onclick="go(${step + 1})">Lanjut →</button>` : ""}</div>`;
}

/* ---------- Tahap 1: Petugas ---------- */
function v1() {
  $("view").innerHTML = `<div class="card"><h2>1. Tambah petugas</h2>
  <div class="row"><div class="f"><span>Nama petugas</span><input type="text" id="np" placeholder="Nama petugas" onkeydown="if(event.key==='Enter')addP()"></div><button class="b" onclick="addP()">Tambah</button></div>
  <ul>${db.petugas.map(p => `<li class="it"><span class="n">${esc(p.nama)}</span><span class="tag">${db.tugas.filter(t => t.petugas === p.id).length} tugas</span><button class="b d" onclick="delP('${p.id}')">Hapus</button></li>`).join("") || '<div class="empty">Belum ada petugas.</div>'}</ul></div>${navBtns()}`;
}
function addP() {
  const v = $("np").value.trim();
  if (!v) return;
  db.petugas.push({ id: uid(), nama: v });
  save(); v1(); $("np").focus();
}
function delP(id) {
  db.petugas = db.petugas.filter(p => p.id !== id);
  db.tugas.forEach(t => { if (t.petugas === id) t.petugas = null; });
  save(); render();
}

/* ---------- Tahap 2: Tugas & pembagian ---------- */
function v2() {
  const opt = sel => `<option value="">— Belum dibagi —</option>` + db.petugas.map(p => `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.nama)}</option>`).join("");
  $("view").innerHTML = `<div class="card"><h2>2. Buat tugas, tanggal &amp; deadline</h2>
  <div class="row"><div class="f" style="flex:2"><span>Nama tugas</span><input type="text" id="nt" placeholder="Contoh: Siapkan laporan"></div>
  <div class="f" style="flex:2"><span>Detail tugas</span><input type="text" id="nd" placeholder="Keterangan / instruksi"></div></div>
  <div class="row" style="margin-top:8px"><div class="f"><span>Tanggal tugas</span><input type="date" id="ntg" value="${today()}"></div>
  <div class="f"><span>Deadline</span><input type="datetime-local" id="ndl"></div><button class="b" onclick="addT()">Tambah</button></div>
  <div class="row" style="margin-top:12px"><button class="b g" onclick="auto()">Bagi otomatis (merata)</button><button class="b g" onclick="clearAssign()">Kosongkan pembagian</button></div>
  <ul>${db.tugas.map(t => `<li class="it"><span class="n">${esc(t.judul)}<small>${esc(t.detail) || "Tanpa detail"}</small><small>Tanggal: ${fmt(t.tanggal)}</small></span>
  <input type="datetime-local" value="${esc(t.deadline)}" title="Deadline" onchange="setDl('${t.id}',this.value)">
  <select onchange="assign('${t.id}',this.value)">${opt(t.petugas)}</select><button class="b d" onclick="delT('${t.id}')">Hapus</button></li>`).join("") || '<div class="empty">Belum ada tugas.</div>'}</ul>
  ${db.petugas.length ? "" : '<div class="empty">Tambahkan petugas dulu di tahap 1.</div>'}</div>${navBtns()}`;
}
function addT() {
  const v = $("nt").value.trim();
  if (!v) { toast("Nama tugas wajib diisi"); return; }
  db.tugas.push({ id: uid(), judul: v, detail: $("nd").value.trim(), tanggal: $("ntg").value || today(), deadline: $("ndl").value, petugas: null, selesai: false, selesaiPada: null });
  save(); render(); $("nt").focus();
}
function setDl(id, v) {
  const t = db.tugas.find(x => x.id === id);
  t.deadline = v;
  notified.delete(id);
  save(); checkAlerts();
}
function delT(id) { db.tugas = db.tugas.filter(t => t.id !== id); save(); render(); }
function assign(id, p) {
  const t = db.tugas.find(x => x.id === id);
  t.petugas = p || null; t.selesai = false; t.selesaiPada = null;
  save(); checkAlerts();
}
function auto() {
  if (!db.petugas.length) return;
  db.tugas.forEach((t, i) => { t.petugas = db.petugas[i % db.petugas.length].id; t.selesai = false; t.selesaiPada = null; });
  save(); render();
}
function clearAssign() {
  db.tugas.forEach(t => { t.petugas = null; t.selesai = false; t.selesaiPada = null; });
  save(); render();
}

/* ---------- Tahap 3: Checklist ---------- */
function v3() {
  const total = db.tugas.length, done = db.tugas.filter(t => t.selesai).length;
  const late = db.tugas.filter(t => !t.selesai && t.deadline && new Date(t.deadline) < Date.now()).length;
  const un = db.tugas.filter(t => !t.petugas).length;
  const cards = db.petugas.map(p => {
    const ts = db.tugas.filter(t => t.petugas === p.id), d = ts.filter(t => t.selesai).length, pct = ts.length ? Math.round(d / ts.length * 100) : 0;
    return `<div class="card"><h2>${esc(p.nama)}</h2><div class="tag">${d}/${ts.length} selesai · ${pct}%</div><div class="pbar"><i style="width:${pct}%"></i></div>
    ${ts.map(t => { const s = status(t); return `<label class="ck ${t.selesai ? "done" : ""}"><input type="checkbox" ${t.selesai ? "checked" : ""} onchange="tick('${t.id}',this.checked)"><span><span class="t">${esc(t.judul)}</span>${t.detail ? `<span class="d2">${esc(t.detail)}</span>` : ""}<span class="m">Tanggal: ${fmt(t.tanggal)} · Deadline: ${fmt(t.deadline, 1)}</span><span class="bd ${s.k}">${s.l}</span></span></label>`; }).join("") || '<div class="empty">Tidak ada tugas.</div>'}</div>`;
  }).join("");
  $("view").innerHTML = `<div class="sum"><div><b>${total}</b>Total tugas</div><div><b>${done}</b>Selesai</div><div><b>${total - done}</b>Belum selesai</div><div><b style="color:var(--bad)">${late}</b>Terlambat</div><div><b>${un}</b>Belum dibagi</div></div>
  <div class="grid">${cards || '<div class="card empty">Belum ada petugas.</div>'}</div>${navBtns()}`;
}
function tick(id, v) {
  const t = db.tugas.find(x => x.id === id);
  t.selesai = v; t.selesaiPada = v ? new Date().toISOString() : null;
  save(); render();
}

/* ---------- Mulai ---------- */
loadDB().then(() => {
  render();
  setInterval(() => { checkAlerts(); if (step === 3) v3(); }, 30000);
});
