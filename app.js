/* Nuestro Hogar — PWA de gestión del hogar en pareja
   Vanilla JS. Funciona en MODO DEMO (localStorage) si config.js no tiene FIREBASE_CONFIG,
   y con Firebase (Auth Google + Firestore en tiempo real) si lo tiene. */

// ---------- Utilidades ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const daysUntil = s => s ? Math.round((parse(s) - parse(todayStr())) / 864e5) : null;
const fmtDate = s => s ? parse(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: parse(s).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }) : '';
const eur = n => (Math.round((n || 0) * 100) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
};
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }

function ask(msg, ok = 'Sí') {
  return new Promise(res => {
    const d = $('#ask'); d.querySelector('p').textContent = msg; d.querySelector('[value=ok]').textContent = ok;
    d.onclose = () => res(d.returnValue === 'ok'); d.returnValue = ''; d.showModal();
  });
}

// ---------- Catálogos ----------
const AREAS = { hogar: '🧹 Hogar', bebe: '👶 Bebé / hijos', mascotas: '🐾 Mascotas', papeleo: '📄 Papeleo', finanzas: '💶 Finanzas', salud: '🩺 Salud', compras: '🛍️ Compras', otros: '📌 Otros' };
const REPEATS = { none: 'No se repite', daily: 'Cada día', weekly: 'Cada semana', biweekly: 'Cada 2 semanas', monthly: 'Cada mes', quarterly: 'Cada 3 meses', yearly: 'Cada año' };
const SHOP_CATS = { fruta: '🥦 Fruta y verdura', fresco: '🥩 Fresco', lacteos: '🧀 Lácteos', despensa: '🥫 Despensa', congelados: '🧊 Congelados', limpieza: '🧽 Limpieza', higiene: '🧴 Higiene', bebe: '🍼 Bebé', mascotas: '🐾 Mascotas', otros: '📦 Otros' };
const EXP_CATS = { super: '🛒 Súper', casa: '🏠 Casa', suministros: '💡 Suministros', bebe: '👶 Bebé', mascotas: '🐾 Mascotas', transporte: '🚗 Transporte', salud: '🩺 Salud', ocio: '🎉 Ocio', otros: '📦 Otros', liquidacion: '🤝 Liquidación' };
const DOC_CATS = { identidad: '🪪 Identidad', vehiculo: '🚗 Vehículo', vivienda: '🏠 Vivienda', seguros: '🛡️ Seguros', impuestos: '🏛️ Impuestos', salud: '🩺 Salud', contratos: '📑 Contratos', otros: '📦 Otros' };
const SPLITS = { mitad: 'A medias (50/50)', pagador: 'Solo de quien paga (personal)', otro: 'Todo de la otra persona' };
const SPECIES = { perro: '🐶 Perro', gato: '🐱 Gato', otro: '🐾 Otro' };
const BABY_SEED = {
  'Embarazo': ['Elegir hospital y plan de parto', 'Clases de preparación al parto', 'Informarnos de los permisos por nacimiento', 'Comunicarlo en el trabajo', 'Preparar la habitación del bebé'],
  'Canastilla': ['Cuna o minicuna', 'Colchón y sábanas', 'Silla de coche', 'Carrito', 'Bañera', 'Pañales y toallitas', 'Bodies y pijamas (0-1 mes)', 'Cambiador', 'Vigilabebés'],
  'Bolsa del hospital': ['Documentación (DNI, tarjeta sanitaria, plan de parto)', 'Ropa cómoda para mamá', 'Neceser', 'Ropa para el bebé (2 mudas)', 'Gorrito y manta', 'Cargadores de móvil', 'Ropa para la salida'],
  'Tras el nacimiento': ['Inscripción en el Registro Civil', 'Solicitar prestación por nacimiento (cada progenitor)', 'Tarjeta sanitaria y pediatra', 'Empadronar al bebé', 'Incluirlo en seguros', 'Comunicar el nacimiento en el trabajo']
};
const PET_PRESETS = [['💉 Vacuna', 'yearly'], ['💊 Desparasitación interna', 'quarterly'], ['🪲 Antiparasitario externo', 'monthly'], ['🩺 Revisión veterinario', 'yearly'], ['🦴 Comprar pienso', 'monthly']];
const DOC_IDEAS = [['DNI', 'identidad'], ['Pasaporte', 'identidad'], ['Carnet de conducir', 'identidad'], ['ITV', 'vehiculo'], ['Seguro del coche', 'seguros'], ['Seguro de hogar', 'seguros'], ['Seguro de vida', 'seguros'], ['IBI', 'impuestos'], ['Declaración de la renta', 'impuestos'], ['Revisión de la caldera', 'vivienda'], ['Contrato de alquiler / hipoteca', 'contratos']];

// ---------- Estado ----------
const S = { mode: 'demo', me: null, hh: null, items: [], view: 'inicio', filters: { area: 'all', owner: 'all' }, store: null, refocus: null, showDone: false };
const members = () => S.hh?.members || [];
const partner = () => members().find(m => m !== S.me);
const nameOf = u => u === 'ambos' ? 'Ambos' : (S.hh?.names?.[u] || '—');
const ownerCls = u => u === 'ambos' ? 'both' : 'u' + Math.max(0, members().indexOf(u));
const ownerPill = u => u ? `<span class="pill ${ownerCls(u)}">${esc(nameOf(u))}</span>` : '';
const byMod = m => S.items.filter(i => i.mod === m);

// ---------- Almacenamiento: modo demo ----------
const LocalStore = {
  key: 'nuestro-hogar-demo',
  init() {
    this.d = ls.get(this.key, null);
    if (!this.d) { this.d = demoSeed(); this.save(); }
  },
  save() { ls.set(this.key, this.d); },
  subscribe(cb) { this.cb = cb; cb(this.d.hh, this.d.items); },
  emit() { this.save(); this.cb?.(this.d.hh, [...this.d.items]); },
  async add(it) { this.d.items.push({ ...it, id: rid(), createdAt: Date.now() }); this.emit(); },
  async update(id, p) { const i = this.d.items.find(x => x.id === id); if (i) Object.assign(i, p); this.emit(); },
  async remove(id) { this.d.items = this.d.items.filter(x => x.id !== id); this.emit(); },
  async set(id, it) { if (this.d.items.some(x => x.id === id)) return; this.d.items.push({ ...it, id, createdAt: Date.now() }); this.emit(); },
  async updateHousehold(p) { for (const [k, v] of Object.entries(p)) { if (k.startsWith('names.')) this.d.hh.names[k.slice(6)] = v; else this.d.hh[k] = v; } this.emit(); },
  reset() { this.d = demoSeed(); this.emit(); }
};

function demoSeed() {
  const t = todayStr();
  const T = (title, area, owner, due, repeat = 'none', extra = {}) => ({ id: rid(), mod: 'task', title, area, owner, due, repeat, done: false, createdAt: Date.now(), ...extra });
  const petId = rid();
  return {
    hh: { id: 'demo', name: 'Nuestro hogar', members: ['u1', 'u2'], names: { u1: 'Paula', u2: 'Pareja' }, dueDate: addDays(t, 120) },
    items: [
      T('Poner lavadora de toallas', 'hogar', 'u2', t, 'weekly'),
      T('Limpiar baños', 'hogar', 'u1', addDays(t, 2), 'weekly'),
      T('Comunidad', 'finanzas', 'u2', addDays(t, 5), 'monthly', { amount: 60, paidBy: 'u2', split: 'mitad', cat: 'casa', auto: 'si' }),
      T('Alquiler', 'finanzas', 'u1', addDays(t, 3), 'monthly', { amount: 750, paidBy: 'u1', split: 'mitad', cat: 'casa', auto: 'si' }),
      T('Cita revisión ginecólogo', 'bebe', 'ambos', addDays(t, 9)),
      T('Montar la cuna', 'bebe', 'u2', addDays(t, 30)),
      T('Pedir cita veterinario', 'mascotas', 'u1', addDays(t, -1), 'none', { petId }),
      T('Antiparasitario externo', 'mascotas', 'u2', addDays(t, 12), 'monthly', { petId }),
      { id: petId, mod: 'pet', title: 'Luna', species: 'perro', birth: addDays(t, -900), chip: '', vet: 'Clínica Veterinaria del barrio', createdAt: Date.now() },
      { id: rid(), mod: 'shop', title: 'Leche', qty: '2', cat: 'lacteos', done: false, createdAt: Date.now() },
      { id: rid(), mod: 'shop', title: 'Tomates', qty: '', cat: 'fruta', done: false, createdAt: Date.now() },
      { id: rid(), mod: 'shop', title: 'Pienso Luna', qty: '1 saco', cat: 'mascotas', done: false, createdAt: Date.now() },
      { id: rid(), mod: 'expense', title: 'Compra Mercadona', amount: 86.4, paidBy: 'u1', split: 'mitad', cat: 'super', date: t, createdAt: Date.now() },
      { id: rid(), mod: 'expense', title: 'Factura luz', amount: 62.1, paidBy: 'u2', split: 'mitad', cat: 'suministros', date: t, createdAt: Date.now() },
      { id: rid(), mod: 'doc', title: 'Seguro del coche', cat: 'seguros', expires: addDays(t, 21), remind: 30, owner: 'u2', notes: '', createdAt: Date.now() },
      { id: rid(), mod: 'doc', title: 'DNI Paula', cat: 'identidad', expires: addDays(t, 400), remind: 60, owner: 'u1', notes: '', createdAt: Date.now() },
    ]
  };
}

// ---------- Almacenamiento: Firebase ----------
async function makeFirebaseStore() {
  const B = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
  const app = initializeApp(window.FIREBASE_CONFIG);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch { db = F.getFirestore(app); }
  let hid = null, unsubs = [];
  const col = () => F.collection(db, 'households', hid, 'items');
  const firstName = u => (u.displayName || u.email || 'Yo').split(' ')[0];
  return {
    onAuth: cb => A.onAuthStateChanged(auth, cb),
    async signIn() {
      const p = new A.GoogleAuthProvider();
      try { await A.signInWithPopup(auth, p); }
      catch (e) { if (/popup/.test(e.code || '')) await A.signInWithRedirect(auth, p); else throw e; }
    },
    signOut: () => A.signOut(auth),
    async getUserHid(uid) { const s = await F.getDoc(F.doc(db, 'users', uid)); return s.exists() ? s.data().hid : null; },
    async create(user, name) {
      const ref = F.doc(F.collection(db, 'households'));
      await F.setDoc(ref, { name, members: [user.uid], names: { [user.uid]: firstName(user) }, createdAt: Date.now() });
      await F.setDoc(F.doc(db, 'users', user.uid), { hid: ref.id });
      return ref.id;
    },
    async join(user, id) {
      const ref = F.doc(db, 'households', id);
      const s = await F.getDoc(ref);
      if (!s.exists()) throw new Error('No existe ningún hogar con ese código');
      if (!s.data().members.includes(user.uid)) await F.updateDoc(ref, { members: F.arrayUnion(user.uid), ['names.' + user.uid]: firstName(user) });
      await F.setDoc(F.doc(db, 'users', user.uid), { hid: id });
      return id;
    },
    subscribe(id, cb) {
      hid = id; unsubs.forEach(u => u());
      let hh = null, items = null;
      const emit = () => { if (hh && items) cb(hh, items); };
      const onErr = e => { console.error(e); toast('Error de conexión: ' + (e.code || e.message)); };
      unsubs = [
        F.onSnapshot(F.doc(db, 'households', id), s => { hh = { id, ...s.data() }; emit(); }, onErr),
        F.onSnapshot(col(), q => { items = q.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }, onErr)
      ];
    },
    add: it => F.addDoc(col(), clean({ ...it, createdAt: Date.now() })),
    update: (id, p) => F.updateDoc(F.doc(col(), id), clean(p)),
    remove: id => F.deleteDoc(F.doc(col(), id)),
    set: (id, it) => F.setDoc(F.doc(col(), id), clean({ ...it, createdAt: Date.now() }), { merge: true }),
    updateHousehold: p => F.updateDoc(F.doc(db, 'households', hid), clean(p))
  };
}

// ---------- Lógica ----------
function advance(s, r) {
  const d = parse(s);
  if (r === 'daily') d.setDate(d.getDate() + 1);
  else if (r === 'weekly') d.setDate(d.getDate() + 7);
  else if (r === 'biweekly') d.setDate(d.getDate() + 14);
  else if (r === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (r === 'quarterly') d.setMonth(d.getMonth() + 3);
  else if (r === 'yearly') d.setFullYear(d.getFullYear() + 1);
  return iso(d);
}
const isBill = t => t.area === 'finanzas' && +t.amount > 0;
const MONTHLY_FACTOR = { daily: 30, weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12, none: 0 };
// Apunta el gasto de un pago fijo. El id depende de la fecha que tocaba, así nunca se duplica aunque lo registren los dos móviles a la vez.
function billExpense(t, due, date) {
  const paidBy = members().includes(t.paidBy) ? t.paidBy : (members().includes(t.owner) ? t.owner : S.me);
  return S.store.set(`rec_${t.id}_${due}`, { mod: 'expense', title: t.title, amount: +t.amount, paidBy, split: t.split || 'mitad', cat: t.cat || 'casa', date, recurring: t.id });
}
const processing = new Set();
async function processBills() {
  for (const t of byMod('task')) {
    if (!isBill(t) || t.done || t.auto !== 'si' || !t.due || daysUntil(t.due) > 0) continue;
    const key = t.id + t.due; if (processing.has(key)) continue; processing.add(key);
    let due = t.due, guard = 0;
    while (due && daysUntil(due) <= 0 && guard++ < 60) {
      await billExpense(t, due, due);
      if (!t.repeat || t.repeat === 'none') { await S.store.update(t.id, { done: true, doneAt: Date.now() }); due = null; break; }
      due = advance(due, t.repeat);
    }
    if (due) await S.store.update(t.id, { due });
  }
}
async function toggleTask(t) {
  if (!t.done && isBill(t)) {
    await billExpense(t, t.due || todayStr(), todayStr());
    toast(`Pagado ✓ · ${eur(t.amount)} apuntados en Dinero`);
    if (t.repeat && t.repeat !== 'none') { let next = advance(t.due || todayStr(), t.repeat); while (daysUntil(next) <= 0) next = advance(next, t.repeat); return S.store.update(t.id, { due: next }); }
    return S.store.update(t.id, { done: true, doneBy: S.me, doneAt: Date.now() });
  }
  if (t.done) return S.store.update(t.id, { done: false });
  S.store.add({ mod: 'log', title: t.title, area: t.area, by: S.me, at: Date.now(), ref: t.id });
  if (t.repeat && t.repeat !== 'none') {
    let next = advance(t.due || todayStr(), t.repeat);
    while (daysUntil(next) <= 0) next = advance(next, t.repeat);
    await S.store.update(t.id, { due: next });
    toast(`Hecho ✓ · Próxima vez: ${fmtDate(next)}`);
  } else {
    await S.store.update(t.id, { done: true, doneBy: S.me, doneAt: Date.now() });
    toast('Hecho ✓');
  }
}
function balance() {
  const [a, b] = members(); if (!b) return null;
  let n = 0; // >0: b le debe a "a"
  for (const e of byMod('expense')) {
    const amt = +e.amount || 0;
    const share = e.split === 'mitad' ? amt / 2 : e.split === 'otro' ? amt : 0;
    if (e.paidBy === a) n += share; else if (e.paidBy === b) n -= share;
  }
  return { a, b, n: Math.round(n * 100) / 100 };
}
function pregnancy() {
  const dd = S.hh?.dueDate; if (!dd) return null;
  const left = daysUntil(dd); if (left < -21) return null;
  const elapsed = 280 - left;
  return { left, weeks: Math.floor(elapsed / 7), days: elapsed % 7, pct: Math.min(100, Math.max(0, elapsed / 280 * 100)) };
}
function ageStr(birth) {
  if (!birth) return '';
  const b = parse(birth), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth(); if (n.getDate() < b.getDate()) m--;
  if (m < 1) return `${Math.max(0, daysUntil(birth) * -1)} días`;
  if (m < 24) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  return `${Math.floor(m / 12)} años`;
}
function loadStats() {
  const owners = [...members(), 'ambos'];
  const active = Object.fromEntries(owners.map(o => [o, 0]));
  const perArea = {};
  const bump = (o, area) => { if (!(o in active)) return; active[o]++; perArea[area] ??= Object.fromEntries(owners.map(x => [x, 0])); perArea[area][o]++; };
  byMod('task').filter(t => !t.done).forEach(t => bump(t.owner, t.area || 'otros'));
  byMod('doc').forEach(d => bump(d.owner, 'papeleo'));
  byMod('baby').filter(b => !b.done).forEach(b => bump(b.owner, 'bebe'));
  const since = Date.now() - 30 * 864e5;
  const doneBy = Object.fromEntries(members().map(m => [m, 0]));
  byMod('log').filter(l => l.at >= since).forEach(l => { if (l.by in doneBy) doneBy[l.by]++; });
  byMod('shop').filter(s => s.done && s.doneAt >= since).forEach(s => { if (s.doneBy in doneBy) doneBy[s.doneBy]++; });
  return { owners, active, perArea, doneBy };
}
function stackBar(obj) {
  const tot = Object.values(obj).reduce((a, b) => a + b, 0) || 1;
  const col = o => `var(--${o === 'ambos' ? 'both' : 'u' + members().indexOf(o)})`;
  return `<div class="bar">${Object.entries(obj).map(([o, v]) => `<div style="width:${v / tot * 100}%;background:${col(o)}"></div>`).join('')}</div>
  <div class="legend">${Object.entries(obj).map(([o, v]) => `<span><i class="dot" style="background:${col(o)}"></i>${esc(nameOf(o))}: <b>${v}</b> (${Math.round(v / tot * 100)}%)</span>`).join('')}</div>`;
}

// ---------- Componentes ----------
function dueBadge(due) {
  if (!due) return '';
  const d = daysUntil(due);
  if (d < 0) return `<span class="pill late">Atrasada ${-d} d</span>`;
  if (d === 0) return `<span class="pill soon">Hoy</span>`;
  if (d === 1) return `<span class="pill soon">Mañana</span>`;
  if (d <= 7) return `<span class="pill soon">${fmtDate(due)}</span>`;
  return `<span class="muted">${fmtDate(due)}</span>`;
}
function taskRow(t, showArea = true) {
  const pet = t.petId ? S.items.find(p => p.id === t.petId) : null;
  return `<div class="row ${t.done ? 'done' : ''}" data-act="edit" data-kind="${t.area === 'finanzas' ? 'bill' : 'task'}" data-id="${t.id}">
    <div class="check ${t.done ? 'on' : ''}" data-act="toggleTask" data-id="${t.id}">✓</div>
    <div class="main"><div class="t">${esc(t.title)}</div>
      <div class="s">${dueBadge(t.due)} ${ownerPill(t.owner)} ${showArea ? `<span>${AREAS[t.area] || ''}</span>` : ''} ${pet ? `<span>· ${esc(pet.title)}</span>` : ''} ${t.repeat && t.repeat !== 'none' ? `<span title="${REPEATS[t.repeat]}">🔁</span>` : ''} ${isBill(t) && t.auto === 'si' ? '<span class="pill">automático</span>' : ''}</div>
    </div>${isBill(t) ? `<span class="money">${eur(t.amount)}</span>` : ''}</div>`;
}
function docStatus(d) {
  if (!d.expires) return '<span class="muted">Sin fecha</span>';
  const n = daysUntil(d.expires);
  if (n < 0) return `<span class="pill late">Caducado hace ${-n} d</span>`;
  if (n <= (d.remind || 30)) return `<span class="pill soon">Vence ${n === 0 ? 'hoy' : 'en ' + n + ' d'}</span>`;
  return `<span class="muted">Vence ${fmtDate(d.expires)}</span>`;
}
function docRow(d) {
  return `<div class="row" data-act="edit" data-kind="doc" data-id="${d.id}"><div class="main"><div class="t">${esc(d.title)}</div><div class="s">${docStatus(d)} ${ownerPill(d.owner)}</div></div></div>`;
}
const list = (rows, empty = 'Nada por aquí') => `<div class="list">${rows.length ? rows.join('') : `<div class="empty">${empty}</div>`}</div>`;
const sortDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999');
const fab = (kind, preset = {}) => `<button class="fab" data-act="new" data-kind="${kind}" data-preset='${esc(JSON.stringify(preset))}' aria-label="Añadir">+</button>`;

// ---------- Vistas ----------
const TITLES = { inicio: 'Nuestro Hogar', tareas: 'Tareas', compra: 'Lista de la compra', dinero: 'Dinero', mas: 'Más', bebe: 'Bebé y crianza', mascotas: 'Mascotas', papeleo: 'Papeleo y vencimientos', reparto: 'Reparto de la carga', ajustes: 'Ajustes' };
const SUBVIEWS = ['bebe', 'mascotas', 'papeleo', 'reparto', 'ajustes'];

const VIEWS = {
  inicio() {
    const tasks = byMod('task').filter(t => !t.done);
    const now = tasks.filter(t => t.due && daysUntil(t.due) <= 0).sort(sortDue);
    const week = tasks.filter(t => t.due && daysUntil(t.due) > 0 && daysUntil(t.due) <= 7).sort(sortDue);
    const docs = byMod('doc').filter(d => d.expires && daysUntil(d.expires) <= (d.remind || 30)).sort((a, b) => a.expires.localeCompare(b.expires));
    const shop = byMod('shop').filter(s => !s.done).length;
    const p = pregnancy(), bal = balance(), st = loadStats();
    const h = new Date().getHours();
    let html = `<p class="muted" style="margin:0 0 12px">${h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'}, ${esc(nameOf(S.me))} 👋</p>`;
    if (S.mode === 'demo') html += `<div class="banner">Modo demo: los datos solo se guardan en este navegador. Conecta Firebase para compartirlos con tu pareja.</div>`;
    if (p) html += `<div class="card hero" data-act="go" data-view="bebe" style="cursor:pointer">
      ${p.left >= 0 ? `<small>Embarazo</small><div class="big">Semana ${p.weeks}+${p.days}</div><small>Faltan ${p.left} días · FPP ${fmtDate(S.hh.dueDate)}</small><div class="progress"><div style="width:${p.pct}%"></div></div>` : `<div class="big">¡Ya está aquí! 🎉</div><small>Recuerda los trámites tras el nacimiento</small>`}</div>`;
    html += `<div class="kpi" style="margin-bottom:10px">
      <div class="card" data-act="go" data-view="tareas" style="cursor:pointer"><b>${now.length}</b><small>para hoy</small></div>
      <div class="card" data-act="go" data-view="compra" style="cursor:pointer"><b>${shop}</b><small>en la compra</small></div>
      <div class="card" data-act="go" data-view="dinero" style="cursor:pointer"><b style="font-size:17px;line-height:31px">${bal ? eur(Math.abs(bal.n)) : '—'}</b><small>${bal && bal.n ? `${esc(nameOf(bal.n > 0 ? bal.b : bal.a))} debe` : 'en paz'}</small></div></div>`;
    html += `<h2>Hoy y atrasado</h2>${list(now.map(t => taskRow(t)), 'Todo al día 🎉')}`;
    if (docs.length) html += `<h2>Vencimientos cercanos</h2>${list(docs.map(docRow))}`;
    html += `<h2>Próximos 7 días</h2>${list(week.map(t => taskRow(t)), 'Nada programado esta semana')}`;
    html += `<h2>¿Quién lleva qué?</h2><div class="card" data-act="go" data-view="reparto" style="cursor:pointer"><div class="muted" style="font-size:13px">Responsabilidades activas</div>${stackBar(st.active)}</div>`;
    return html + fab('task');
  },

  tareas() {
    const f = S.filters;
    let ts = byMod('task');
    if (f.area !== 'all') ts = ts.filter(t => t.area === f.area);
    if (f.owner !== 'all') ts = ts.filter(t => t.owner === f.owner);
    const open = ts.filter(t => !t.done).sort(sortDue), done = ts.filter(t => t.done);
    const chip = (k, v, label) => `<button class="chip ${f[k] === v ? 'on' : ''}" data-act="filter" data-k="${k}" data-v="${v}">${label}</button>`;
    let html = `<div class="chips">${chip('area', 'all', 'Todas')}${Object.entries(AREAS).map(([k, v]) => chip('area', k, v)).join('')}</div>
      <div class="chips">${chip('owner', 'all', 'Cualquiera')}${[...members(), 'ambos'].map(m => chip('owner', m, esc(nameOf(m)))).join('')}</div>`;
    html += list(open.map(t => taskRow(t, f.area === 'all')), 'No hay tareas pendientes aquí');
    if (done.length) {
      html += `<div class="btns" style="margin:10px 0"><button class="btn ghost small" data-act="toggleDone">${S.showDone ? 'Ocultar' : 'Ver'} hechas (${done.length})</button>${S.showDone ? `<button class="btn ghost small" data-act="clearDone">Borrar hechas</button>` : ''}</div>`;
      if (S.showDone) html += list(done.map(t => taskRow(t)));
    }
    return html + fab('task', f.area !== 'all' ? { area: f.area } : {});
  },

  compra() {
    const items = byMod('shop');
    const open = items.filter(i => !i.done), done = items.filter(i => i.done);
    const row = i => `<div class="row ${i.done ? 'done' : ''}" data-act="toggleShop" data-id="${i.id}">
      <div class="check ${i.done ? 'on' : ''}">✓</div><div class="main"><div class="t">${esc(i.title)}${i.qty ? ` <span class="muted">· ${esc(i.qty)}</span>` : ''}</div></div>
      <button class="x" data-act="edit" data-kind="shop" data-id="${i.id}" aria-label="Editar">✎</button></div>`;
    let html = `<form class="quick" data-form="quickShop" id="quickShopForm"><input name="title" id="quickShop" placeholder="Añadir producto…" autocomplete="off" enterkeyhint="send"><button class="btn" type="submit" aria-label="Añadir" style="padding:0 16px;font-size:22px">+</button></form>
      <select name="cat" form="quickShopForm" id="quickShopCat" style="margin:-2px 0 10px">${Object.entries(SHOP_CATS).map(([k, v]) => `<option value="${k}" ${k === S.lastShopCat ? 'selected' : ''}>Sección: ${v}</option>`).join('')}</select>`;
    if (!open.length) html += list([], 'La lista está vacía');
    for (const [k, v] of Object.entries(SHOP_CATS)) {
      const g = open.filter(i => (i.cat || 'otros') === k);
      if (g.length) html += `<h2>${v}</h2>${list(g.map(row))}`;
    }
    if (done.length) html += `<h2>En el carro (${done.length})</h2>${list(done.map(row))}<button class="btn ghost block" data-act="clearShop">Quitar comprados</button>`;
    return html;
  },

  dinero() {
    const bal = balance();
    const exps = byMod('expense').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const m = todayStr().slice(0, 7);
    const month = exps.filter(e => (e.date || '').startsWith(m) && e.cat !== 'liquidacion' && e.split !== 'pagador');
    const total = month.reduce((s, e) => s + (+e.amount || 0), 0);
    const perCat = {}; month.forEach(e => perCat[e.cat] = (perCat[e.cat] || 0) + (+e.amount || 0));
    let html = '';
    if (bal) html += `<div class="card center">${bal.n === 0 ? '<div class="big" style="font-size:20px;font-weight:700">Estáis en paz 🤝</div>' :
      `<div class="muted">${esc(nameOf(bal.n > 0 ? bal.b : bal.a))} le debe a ${esc(nameOf(bal.n > 0 ? bal.a : bal.b))}</div><div style="font-size:28px;font-weight:700;margin:4px 0 10px">${eur(Math.abs(bal.n))}</div><button class="btn small" data-act="settle">Saldar cuentas</button>`}</div>`;
    else html += `<div class="banner">Cuando tu pareja se una al hogar, aquí veréis quién le debe a quién.</div>`;
    html += `<h2>Gasto común de este mes</h2><div class="card"><div style="font-size:24px;font-weight:700">${eur(total)}</div>
      ${Object.entries(perCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div style="display:flex;justify-content:space-between;font-size:14px;margin-top:6px"><span>${EXP_CATS[c] || c}</span><span class="money">${eur(v)}</span></div>`).join('')}</div>`;
    const rec = byMod('task').filter(t => t.area === 'finanzas' && !t.done).sort(sortDue);
    const fixedMonthly = rec.filter(isBill).filter(t => t.split !== 'pagador').reduce((s, t) => s + (+t.amount) * (MONTHLY_FACTOR[t.repeat] ?? 0), 0);
    const endMonth = (() => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); })();
    const pending = rec.filter(isBill).filter(t => t.due && t.due <= endMonth && t.split !== 'pagador').reduce((s, t) => s + (+t.amount), 0);
    if (pending) html += `<p class="muted" style="font-size:13px;margin:-4px 0 0">Quedan <b>${eur(pending)}</b> de gastos fijos por pasar este mes.</p>`;
    html += `<h2>Gastos fijos</h2>${list(rec.map(t => taskRow(t, false)), 'Añade alquiler, comunidad, luz, seguros, suscripciones…')}
      ${fixedMonthly ? `<p class="muted" style="font-size:13px;margin:0 0 8px">Gastos fijos comunes: <b>${eur(fixedMonthly)}</b> al mes de media.</p>` : ''}
      <button class="btn ghost small" data-act="new" data-kind="bill">+ Gasto fijo</button>`;
    html += `<h2>Movimientos</h2>${list(exps.slice(0, 60).map(e => `<div class="row" data-act="edit" data-kind="expense" data-id="${e.id}"><div class="main"><div class="t">${esc(e.title)}</div><div class="s">${fmtDate(e.date)} · ${EXP_CATS[e.cat] || ''} ${ownerPill(e.paidBy)} ${e.split !== 'mitad' ? `<span class="muted">${e.split === 'pagador' ? 'personal' : 'para el otro'}</span>` : ''}</div></div><span class="money">${eur(e.amount)}</span></div>`), 'Aún no hay gastos')}`;
    return html + fab('expense');
  },

  mas() {
    const p = pregnancy();
    const tile = (v, icon, label, sub) => `<button class="tile" data-act="go" data-view="${v}"><span>${icon}</span>${label}<small>${sub}</small></button>`;
    const soonDocs = byMod('doc').filter(d => d.expires && daysUntil(d.expires) <= (d.remind || 30)).length;
    return `<div class="grid">
      ${tile('bebe', '👶', 'Bebé y crianza', p && p.left >= 0 ? `Semana ${p.weeks}` : `${byMod('kid').length} hijos`)}
      ${tile('mascotas', '🐾', 'Mascotas', `${byMod('pet').length} registradas`)}
      ${tile('papeleo', '📄', 'Papeleo', soonDocs ? `${soonDocs} por vencer` : 'Todo en orden')}
      ${tile('reparto', '⚖️', 'Reparto de carga', 'Quién lleva qué')}
      ${tile('ajustes', '⚙️', 'Ajustes', S.mode === 'demo' ? 'Modo demo' : esc(S.hh?.name || ''))}
    </div>`;
  },

  bebe() {
    const p = pregnancy();
    const kids = byMod('kid'), checklist = byMod('baby');
    let html = '';
    if (p && p.left >= 0) html += `<div class="card hero"><small>Embarazo</small><div class="big">Semana ${p.weeks}+${p.days}</div><small>${p.weeks < 14 ? '1er' : p.weeks < 28 ? '2º' : '3er'} trimestre · faltan ${p.left} días (FPP ${fmtDate(S.hh.dueDate)})</small><div class="progress"><div style="width:${p.pct}%"></div></div></div>`;
    html += `<div class="btns" style="margin-bottom:6px"><button class="btn ghost small" data-act="setDue">${S.hh?.dueDate ? 'Cambiar fecha prevista de parto' : '🤰 Añadir fecha prevista de parto'}</button></div>`;
    const appts = byMod('task').filter(t => t.area === 'bebe' && !t.done).sort(sortDue);
    html += `<h2>Citas y tareas</h2>${list(appts.map(t => taskRow(t, false)), 'Sin citas pendientes')}
      <button class="btn ghost small" data-act="new" data-kind="task" data-preset='${esc(JSON.stringify({ area: 'bebe' }))}'>+ Cita o tarea</button>`;
    html += `<h2>Lista de preparativos</h2>`;
    if (!checklist.length) html += `<div class="card center"><p class="muted" style="margin-top:0">Una lista con lo típico: canastilla, bolsa del hospital y trámites. Repartid cada cosa entre los dos.</p><button class="btn" data-act="seedBaby">Cargar lista sugerida</button></div>`;
    for (const g of Object.keys(BABY_SEED)) {
      const its = checklist.filter(i => i.group === g); if (!its.length) continue;
      const d = its.filter(i => i.done).length;
      html += `<div class="muted" style="font-size:13px;margin:12px 0 6px;font-weight:600">${g} · ${d}/${its.length}</div>` + list(its.sort((a, b) => a.done - b.done).map(i => `<div class="row ${i.done ? 'done' : ''}" data-act="edit" data-kind="baby" data-id="${i.id}"><div class="check ${i.done ? 'on' : ''}" data-act="toggleBaby" data-id="${i.id}">✓</div><div class="main"><div class="t">${esc(i.title)}</div><div class="s">${ownerPill(i.owner)}</div></div></div>`));
    }
    if (checklist.length) html += `<button class="btn ghost small" data-act="new" data-kind="baby">+ Añadir a la lista</button>`;
    html += `<h2>Hijos</h2>${list(kids.map(k => `<div class="row" data-act="edit" data-kind="kid" data-id="${k.id}"><div class="main"><div class="t">${esc(k.title)}</div><div class="s">${k.birth ? `${ageStr(k.birth)} · nació el ${fmtDate(k.birth)}` : ''}</div></div></div>`), 'Cuando nazca, añádelo aquí')}
      <button class="btn ghost small" data-act="new" data-kind="kid">+ Añadir hijo/a</button>`;
    return html;
  },

  mascotas() {
    const pets = byMod('pet');
    if (!pets.length) return `<div class="card center"><p>Aún no hay mascotas.</p><button class="btn" data-act="new" data-kind="pet">Añadir mascota</button></div>`;
    return pets.map(p => {
      const ts = byMod('task').filter(t => t.petId === p.id && !t.done).sort(sortDue);
      return `<div class="card" style="padding-bottom:6px"><div style="display:flex;align-items:center;gap:10px;cursor:pointer" data-act="edit" data-kind="pet" data-id="${p.id}">
        <div style="font-size:34px">${(SPECIES[p.species] || '🐾').split(' ')[0]}</div><div><b style="font-size:17px">${esc(p.title)}</b><div class="muted" style="font-size:13px">${p.birth ? ageStr(p.birth) : ''}${p.vet ? ' · ' + esc(p.vet) : ''}${p.chip ? ' · Chip ' + esc(p.chip) : ''}</div></div></div>
        <div class="list" style="box-shadow:none;margin:10px -14px 0;border-top:1px solid var(--line);border-radius:0">${ts.length ? ts.map(t => taskRow(t, false)).join('') : '<div class="empty">Sin cuidados programados</div>'}</div>
        <div class="chips" style="padding-top:8px">${PET_PRESETS.map(([l, r]) => `<button class="chip" data-act="new" data-kind="task" data-preset='${esc(JSON.stringify({ title: l.slice(l.indexOf(' ') + 1) + ' ' + p.title, area: 'mascotas', petId: p.id, repeat: r }))}'>${l}</button>`).join('')}</div></div>`;
    }).join('') + fab('pet');
  },

  papeleo() {
    const docs = byMod('doc').sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
    let html = `<p class="muted" style="margin-top:0;font-size:14px">Documentos, seguros e impuestos con fecha. La app avisa en Inicio cuando falte poco para que venzan.</p>`;
    for (const [k, v] of Object.entries(DOC_CATS)) { const g = docs.filter(d => (d.cat || 'otros') === k); if (g.length) html += `<h2>${v}</h2>${list(g.map(docRow))}`; }
    const have = new Set(docs.map(d => d.title.toLowerCase()));
    const ideas = DOC_IDEAS.filter(([t]) => ![...have].some(h => h.startsWith(t.toLowerCase())));
    if (ideas.length) html += `<h2>Ideas para añadir</h2><div class="chips" style="flex-wrap:wrap">${ideas.map(([t, c]) => `<button class="chip" data-act="new" data-kind="doc" data-preset='${esc(JSON.stringify({ title: t, cat: c }))}'>+ ${t}</button>`).join('')}</div>`;
    return html + fab('doc');
  },

  reparto() {
    const st = loadStats();
    let html = `<p class="muted" style="margin-top:0;font-size:14px">Cada tarea, documento o preparativo tiene una persona responsable <b>de principio a fin</b>: acordarse, planificar y hacerlo. Así se ve también la carga invisible.</p>`;
    html += `<div class="card"><b>Responsabilidades activas</b>${stackBar(st.active)}</div>`;
    if (members().length > 1) html += `<div class="card"><b>Hecho en los últimos 30 días</b>${stackBar(st.doneBy)}</div>`;
    html += `<h2>Por áreas</h2><div class="list">${Object.entries(st.perArea).map(([a, o]) => `<div class="row" style="cursor:default"><div class="main"><div class="t">${AREAS[a] || a}</div><div class="s">${Object.entries(o).filter(([, v]) => v).map(([u, v]) => `${ownerPill(u)} ${v}`).join(' ')}</div></div></div>`).join('') || '<div class="empty">Sin datos todavía</div>'}</div>`;
    html += `<p class="muted" style="font-size:13px">Consejo: revisad esto juntos una vez por semana (5 minutos) y reasignad lo que esté descompensado.</p>`;
    return html;
  },

  ajustes() {
    const inv = S.mode === 'firebase' ? `${location.origin}${location.pathname}?unirse=${S.hh.id}` : '';
    let html = `<div class="card"><label style="margin-top:0">Nombre del hogar</label><input data-hh="name" value="${esc(S.hh.name || '')}">
      ${members().map(m => `<label>Nombre de ${m === S.me ? 'tu perfil' : 'tu pareja'}</label><input data-hh="names.${m}" value="${esc(nameOf(m))}">`).join('')}
      <div class="btns" style="margin-top:14px"><button class="btn small" data-act="saveSettings">Guardar</button></div></div>`;
    if (S.mode === 'firebase') html += `<h2>Invitar a tu pareja</h2><div class="card">${members().length > 1 ? '<p style="margin-top:0">Ya sois dos en este hogar ✓</p>' : '<p style="margin-top:0">Envíale este enlace. Al abrirlo e iniciar sesión con Google entrará en vuestro hogar.</p>'}<input readonly value="${esc(inv)}" id="invite"><div class="btns" style="margin-top:10px"><button class="btn small" data-act="share">Compartir enlace</button></div></div>`;
    html += `<h2>Avisos</h2><div class="card"><p style="margin-top:0;font-size:14px">Al abrir la app cada día te muestra una notificación con lo pendiente para hoy y los vencimientos cercanos.</p><button class="btn ghost small" data-act="notif">${('Notification' in window && Notification.permission === 'granted') ? 'Avisos activados ✓' : 'Activar avisos'}</button></div>`;
    html += `<h2>Datos</h2><div class="btns"><button class="btn ghost small" data-act="export">Descargar copia (JSON)</button>
      ${S.mode === 'demo' ? '<button class="btn danger small" data-act="resetDemo">Restablecer datos de ejemplo</button><button class="btn danger small" data-act="emptyDemo">Empezar en blanco</button>' : '<button class="btn danger small" data-act="signOut">Cerrar sesión</button>'}</div>`;
    if (S.mode === 'demo') html += `<p class="muted" style="font-size:13px;margin-top:16px">Estás en modo demo. Para usarla con tu pareja, sigue el archivo LEEME.md (configurar Firebase y publicar en GitHub Pages).</p>`;
    return html;
  }
};

// ---------- Formularios ----------
const F = (k, l, t, o = {}) => ({ k, l, t, ...o });
const FORMS = {
  task: { title: 'Tarea', fields: [F('title', '¿Qué hay que hacer?', 'text', { req: 1 }), F('area', 'Área', 'select', { o: AREAS, d: 'hogar' }), F('owner', 'Responsable (de principio a fin)', 'owner', { d: 'me' }), F('due', 'Fecha', 'date'), F('repeat', 'Se repite', 'select', { o: REPEATS, d: 'none' }), F('petId', 'Mascota', 'pet', { when: () => byMod('pet').length }), F('notes', 'Notas', 'textarea')] },
  shop: { title: 'Producto', fields: [F('title', 'Producto', 'text', { req: 1 }), F('qty', 'Cantidad', 'text'), F('cat', 'Sección', 'select', { o: SHOP_CATS, d: 'otros' })] },
  expense: { title: 'Gasto', fields: [F('title', 'Concepto', 'text', { req: 1 }), F('amount', 'Importe (€)', 'number', { req: 1 }), F('paidBy', 'Pagado por', 'member', { d: 'me' }), F('split', '¿De quién es el gasto?', 'select', { o: SPLITS, d: 'mitad' }), F('cat', 'Categoría', 'select', { o: EXP_CATS, d: 'super' }), F('date', 'Fecha', 'date', { d: 'today' })] },
  doc: { title: 'Documento / vencimiento', fields: [F('title', 'Nombre', 'text', { req: 1 }), F('cat', 'Tipo', 'select', { o: DOC_CATS, d: 'otros' }), F('expires', 'Fecha de caducidad / renovación', 'date'), F('remind', 'Avisar con cuántos días de antelación', 'number', { d: 30 }), F('owner', 'Responsable', 'owner', { d: 'me' }), F('notes', 'Notas (nº de póliza, dónde está guardado…)', 'textarea')] },
  pet: { title: 'Mascota', fields: [F('title', 'Nombre', 'text', { req: 1 }), F('species', 'Especie', 'select', { o: SPECIES, d: 'perro' }), F('birth', 'Fecha de nacimiento', 'date'), F('chip', 'Nº de chip', 'text'), F('vet', 'Veterinario', 'text'), F('notes', 'Notas (alergias, comida…)', 'textarea')] },
  kid: { title: 'Hijo/a', fields: [F('title', 'Nombre', 'text', { req: 1 }), F('birth', 'Fecha de nacimiento', 'date'), F('notes', 'Notas (pediatra, alergias, talla…)', 'textarea')] },
  bill: { title: 'Gasto fijo', fields: [F('title', 'Concepto (alquiler, luz, Netflix…)', 'text', { req: 1 }), F('amount', 'Importe (€)', 'number', { req: 1 }), F('repeat', 'Cada cuánto', 'select', { o: REPEATS, d: 'monthly' }), F('due', 'Próximo pago', 'date', { d: 'today', req: 1 }), F('auto', 'Al llegar la fecha…', 'select', { o: { si: 'Apuntarlo solo en Dinero', no: 'Avisarme y lo marco yo al pagarlo' }, d: 'si' }), F('paidBy', 'Lo paga', 'member', { d: 'me' }), F('split', '¿De quién es el gasto?', 'select', { o: SPLITS, d: 'mitad' }), F('cat', 'Categoría', 'select', { o: EXP_CATS, d: 'casa' }), F('owner', 'Responsable de vigilarlo', 'owner', { d: 'me' })] },
  baby: { title: 'Preparativo', fields: [F('title', '¿Qué?', 'text', { req: 1 }), F('group', 'Grupo', 'select', { o: Object.fromEntries(Object.keys(BABY_SEED).map(k => [k, k])), d: 'Embarazo' }), F('owner', 'Responsable', 'owner', { d: 'me' })] }
};
const MOD = { bill: 'task', task: 'task', shop: 'shop', expense: 'expense', doc: 'doc', pet: 'pet', kid: 'kid', baby: 'baby' };

function openForm(kind, item = null, preset = {}) {
  const spec = FORMS[kind];
  const val = f => {
    let v = item ? item[f.k] : (preset[f.k] ?? f.d);
    if (v === 'me') v = S.me; if (v === 'today') v = todayStr();
    return v ?? '';
  };
  const opts = (o, v) => Object.entries(o).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === k ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const field = f => {
    if (f.when && !f.when()) return '';
    const v = val(f); let inp;
    if (f.t === 'select') inp = `<select name="${f.k}">${opts(f.o, v)}</select>`;
    else if (f.t === 'owner') inp = `<select name="${f.k}">${opts(Object.fromEntries([...members(), 'ambos'].map(m => [m, nameOf(m)])), v)}</select>`;
    else if (f.t === 'member') inp = `<select name="${f.k}">${opts(Object.fromEntries(members().map(m => [m, nameOf(m)])), v)}</select>`;
    else if (f.t === 'pet') inp = `<select name="${f.k}"><option value="">—</option>${opts(Object.fromEntries(byMod('pet').map(p => [p.id, p.title])), v)}</select>`;
    else if (f.t === 'textarea') inp = `<textarea name="${f.k}">${esc(v)}</textarea>`;
    else inp = `<input name="${f.k}" type="${f.t}" value="${esc(v)}" ${f.req ? 'required' : ''} ${f.t === 'number' ? 'step="0.01" inputmode="decimal"' : ''}>`;
    return `<label>${f.l}</label>${inp}`;
  };
  const form = $('#sheetForm');
  form.innerHTML = `<h3>${item ? 'Editar' : 'Nuevo'}: ${spec.title.toLowerCase()}</h3>${spec.fields.map(field).join('')}
    <div class="sheet-actions">${item ? '<button class="btn danger" value="del" formnovalidate>Borrar</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn" value="save">Guardar</button></div>`;
  form.onsubmit = async e => {
    e.preventDefault();
    const act = e.submitter?.value || 'save';
    const dlg = $('#sheet');
    if (act === 'cancel') return dlg.close();
    if (act === 'del') { if (await ask('¿Borrar definitivamente?', 'Borrar')) { await S.store.remove(item.id); dlg.close(); toast('Borrado'); } return; }
    const data = Object.fromEntries(new FormData(form));
    for (const f of spec.fields) if (f.t === 'number' && data[f.k] !== undefined) data[f.k] = data[f.k] === '' ? null : parseFloat(String(data[f.k]).replace(',', '.'));
    dlg.close();
    if (item) await S.store.update(item.id, data);
    else await S.store.add({ mod: MOD[kind], ...preset, ...data, ...(kind === 'bill' ? { area: 'finanzas' } : {}), ...(kind === 'task' || kind === 'bill' || kind === 'baby' || kind === 'shop' ? { done: false } : {}) });
    toast('Guardado ✓');
  };
  $('#sheet').showModal();
  setTimeout(() => { const first = form.querySelector('input[name=title]'); if (first && !item) first.focus(); }, 50);
}

// ---------- Acciones ----------
const find = id => S.items.find(i => i.id === id);
const ACTIONS = {
  go: el => show(el.dataset.view),
  new: el => openForm(el.dataset.kind, null, JSON.parse(el.dataset.preset || '{}')),
  edit: el => { const it = find(el.dataset.id); if (it) openForm(el.dataset.kind, it); },
  toggleTask: el => { const t = find(el.dataset.id); if (t) toggleTask(t); },
  toggleShop: el => { const i = find(el.dataset.id); if (i) S.store.update(i.id, i.done ? { done: false } : { done: true, doneBy: S.me, doneAt: Date.now() }); },
  toggleBaby: el => { const i = find(el.dataset.id); if (i) S.store.update(i.id, { done: !i.done, doneBy: S.me, doneAt: Date.now() }); },
  filter: el => { S.filters[el.dataset.k] = el.dataset.v; render(); },
  toggleDone: () => { S.showDone = !S.showDone; render(); },
  clearDone: async () => { if (!await ask('¿Borrar todas las tareas hechas?', 'Borrar')) return; for (const t of byMod('task').filter(t => t.done)) await S.store.remove(t.id); },
  clearShop: async () => { for (const i of byMod('shop').filter(i => i.done)) await S.store.remove(i.id); toast('Lista limpia'); },
  settle: async () => {
    const b = balance(); if (!b || !b.n) return;
    const debtor = b.n > 0 ? b.b : b.a;
    if (!await ask(`¿Registrar que ${nameOf(debtor)} ha pagado ${eur(Math.abs(b.n))}?`, 'Registrar')) return;
    await S.store.add({ mod: 'expense', title: 'Liquidación', amount: Math.abs(b.n), paidBy: debtor, split: 'otro', cat: 'liquidacion', date: todayStr() });
    toast('Cuentas saldadas 🤝');
  },
  setDue: () => {
    const form = $('#sheetForm');
    form.innerHTML = `<h3>Fecha prevista de parto</h3><label>FPP</label><input type="date" name="dueDate" value="${esc(S.hh.dueDate || '')}">
      <div class="sheet-actions">${S.hh.dueDate ? '<button class="btn danger" value="del" formnovalidate>Quitar</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Cancelar</button><button class="btn" value="save">Guardar</button></div>`;
    form.onsubmit = async e => {
      e.preventDefault(); const a = e.submitter?.value; $('#sheet').close();
      if (a === 'save') await S.store.updateHousehold({ dueDate: form.dueDate.value || null });
      if (a === 'del') await S.store.updateHousehold({ dueDate: null });
    };
    $('#sheet').showModal();
  },
  seedBaby: async () => {
    const [a, b] = members(); let i = 0;
    for (const [g, list] of Object.entries(BABY_SEED)) for (const t of list) await S.store.add({ mod: 'baby', title: t, group: g, owner: b ? (i++ % 2 ? b : a) : a, done: false });
    toast('Lista cargada · repartidla tocando cada elemento');
  },
  saveSettings: async () => {
    const p = {}; document.querySelectorAll('[data-hh]').forEach(i => { if (i.value.trim()) p[i.dataset.hh] = i.value.trim(); });
    await S.store.updateHousehold(p); toast('Guardado ✓');
  },
  share: async () => {
    const url = $('#invite').value;
    try { if (navigator.share) await navigator.share({ title: 'Nuestro Hogar', text: 'Únete a nuestro hogar en la app:', url }); else { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } } catch { }
  },
  notif: async () => {
    if (!('Notification' in window)) return toast('Este navegador no admite avisos');
    const r = await Notification.requestPermission();
    if (r === 'granted') { ls.set('lastNotif', ''); dailyNotify(); toast('Avisos activados'); render(); } else toast('Permiso denegado');
  },
  export: () => {
    const blob = new Blob([JSON.stringify({ hogar: S.hh, items: S.items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nuestro-hogar-${todayStr()}.json`; a.click();
  },
  resetDemo: async () => { if (await ask('¿Volver a los datos de ejemplo?')) LocalStore.reset(); },
  emptyDemo: async () => { if (await ask('¿Borrar todo y empezar en blanco?', 'Borrar')) { LocalStore.d.items = []; LocalStore.d.hh.dueDate = null; LocalStore.emit(); } },
  signOut: () => S.store.signOut().then(() => location.reload())
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('dialog')) return;
  const fn = ACTIONS[el.dataset.act]; if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('submit', async e => {
  if (e.target.dataset.form !== 'quickShop') return;
  e.preventDefault();
  const inp = $('#quickShop'), title = (inp?.value || '').trim();
  if (!title) { inp?.focus(); return; }
  S.lastShopCat = $('#quickShopCat')?.value || 'otros'; S.refocus = '#quickShop';
  inp.value = '';
  try { await S.store.add({ mod: 'shop', title, qty: '', cat: S.lastShopCat, done: false }); }
  catch (err) { console.error(err); inp.value = title; toast('No se pudo añadir: ' + (err.code || err.message)); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'quickShop') { e.preventDefault(); e.target.form?.requestSubmit(); }
});
$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.view); });
$('#backBtn').addEventListener('click', () => show('mas'));
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('#sheet').close(); });

// ---------- Render ----------
function show(view) { S.view = view; window.scrollTo(0, 0); render(); }
function render() {
  if (!S.hh) return;
  $('#nav').classList.remove('hidden');
  const sub = SUBVIEWS.includes(S.view);
  $('#backBtn').classList.toggle('hidden', !sub);
  $('#viewTitle').textContent = S.view === 'inicio' ? (S.hh.name || TITLES.inicio) : TITLES[S.view];
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === (sub ? 'mas' : S.view)));
  $('#view').innerHTML = VIEWS[S.view]();
  if (S.refocus) { $(S.refocus)?.focus(); S.refocus = null; }
}
function onData(hh, items) { S.hh = hh; S.items = items; render(); processBills().catch(e => console.error(e)); }

function dailyNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (ls.get('lastNotif', '') === todayStr()) return;
  const n = byMod('task').filter(t => !t.done && t.due && daysUntil(t.due) <= 0 && (t.owner === S.me || t.owner === 'ambos')).length;
  const d = byMod('doc').filter(x => x.expires && daysUntil(x.expires) <= (x.remind || 30)).length;
  if (!n && !d) return;
  ls.set('lastNotif', todayStr());
  const body = [n && `${n} ${n === 1 ? 'tarea tuya' : 'tareas tuyas'} para hoy`, d && `${d} ${d === 1 ? 'vencimiento cercano' : 'vencimientos cercanos'}`].filter(Boolean).join(' · ');
  navigator.serviceWorker?.ready.then(r => r.showNotification('Nuestro Hogar', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'diario' })).catch(() => { });
}

// ---------- Pantallas de acceso (Firebase) ----------
function renderLogin(err = '') {
  $('#nav').classList.add('hidden');
  $('#view').innerHTML = `<div class="login"><div class="logo">🏡</div><h2 style="text-transform:none;font-size:22px;color:var(--ink)">Nuestro Hogar</h2>
    <p class="muted">La casa, entre los dos.</p><button class="btn" id="loginBtn">Entrar con Google</button>${err ? `<p style="color:var(--danger)">${esc(err)}</p>` : ''}</div>`;
  $('#loginBtn').onclick = () => S.store.signIn().catch(e => renderLogin(e.message));
}
function renderSetup(user) {
  $('#nav').classList.add('hidden');
  $('#view').innerHTML = `<div class="card"><h3 style="margin-top:0">Crear nuestro hogar</h3><label>Nombre</label><input id="hhName" value="Nuestro hogar"><button class="btn block" style="margin-top:12px" id="createBtn">Crear</button></div>
    <div class="card"><h3 style="margin-top:0">¿Tu pareja ya lo creó?</h3><p class="muted" style="font-size:14px">Abre el enlace de invitación que te ha enviado, o pega aquí el código.</p><input id="joinCode" placeholder="Código o enlace"><button class="btn ghost block" style="margin-top:12px" id="joinBtn">Unirme</button></div>`;
  $('#createBtn').onclick = async () => { const id = await S.store.create(user, $('#hhName').value.trim() || 'Nuestro hogar'); start(id); };
  $('#joinBtn').onclick = async () => {
    const raw = $('#joinCode').value.trim(); const code = raw.includes('unirse=') ? new URL(raw).searchParams.get('unirse') : raw;
    try { start(await S.store.join(user, code)); } catch (e) { toast(e.message); }
  };
}
function start(hid) { S.store.subscribe(hid, onData); }

// ---------- Arranque ----------
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (!window.FIREBASE_CONFIG) {
    S.mode = 'demo'; S.store = LocalStore; LocalStore.init(); S.me = 'u1';
    LocalStore.subscribe(onData);
    setTimeout(dailyNotify, 1500);
    return;
  }
  S.mode = 'firebase';
  try { S.store = await makeFirebaseStore(); }
  catch (e) { $('#view').innerHTML = `<p class="empty">No se pudo cargar Firebase. Revisa tu conexión.<br><small>${esc(e.message)}</small></p>`; return; }
  S.store.onAuth(async user => {
    if (!user) return renderLogin();
    S.me = user.uid;
    const join = new URLSearchParams(location.search).get('unirse');
    let hid = await S.store.getUserHid(user.uid);
    if (join && join !== hid && (!hid || await ask('¿Unirte al hogar de tu pareja? Dejarás de ver el actual.', 'Unirme'))) {
      try { hid = await S.store.join(user, join); } catch (e) { toast(e.message); }
      history.replaceState(null, '', location.pathname);
    }
    if (!hid) return renderSetup(user);
    start(hid);
    setTimeout(dailyNotify, 2500);
  });
}
boot();
