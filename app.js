/* ============================================================
   Trilha
   Model: positions are nodes, skills are edges, sequences are
   paths, and a path that returns to its start is a loop
   (a washing machine, in acro).

   Sync strategy: local-first. Everything renders from an
   in-memory copy cached in localStorage, so the app opens
   instantly and survives bad gym wifi. Writes go to Supabase
   immediately and optimistically; failures are surfaced, not
   swallowed.
   ============================================================ */

const CFG = window.TRILHA_CONFIG || {};
const CACHE = 'trilha:cache';
const configured = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.includes('YOUR-PROJECT-REF');

let sb = null;
if (configured) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

/* ---------- state ---------- */
let DB = { positions: [], skills: [], logs: [], sequences: [] };
let user = null;
let view = 'skills';
let disc = 'juggling';
let boardMode = 'board';
let chain = [];
let online = true;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now() + Math.random().toString(16).slice(2));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDay = d => { const [, m, dd] = d.split('-'); return dd + '/' + m; };

const pos = id => DB.positions.find(p => p.id === id);
const posName = id => pos(id)?.name ?? '—';
const skill = id => DB.skills.find(s => s.id === id);
const mySkills = () => DB.skills.filter(s => s.discipline === disc);
const myPositions = () => DB.positions.filter(p => p.discipline === disc);
const STATUSES = [['want', 'Want'], ['working', 'Working'], ['got', 'Got it']];
const nextStatus = st => st === 'want' ? 'working' : st === 'working' ? 'got' : 'want';

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function setSync(ok, txt) {
  online = ok;
  const el = $('#sync');
  if (!el) return;
  el.classList.toggle('off', !ok);
  $('#syncTxt').textContent = txt;
}

/* ============================================================
   row mapping — snake_case in Postgres, camelCase in the app
   ============================================================ */
const toRow = {
  positions: p => ({ id: p.id, user_id: user.id, name: p.name, aka: p.aka || '', discipline: p.discipline }),
  skills: s => ({
    id: s.id, user_id: user.id, name: s.name, aka: s.aka || '', discipline: s.discipline,
    from_position: s.from, to_position: s.to, siteswap: s.siteswap || '',
    prop_count: s.propCount ?? null, status: s.status, notes: s.notes || ''
  }),
  logs: l => ({
    id: l.id, user_id: user.id, logged_on: l.date, discipline: l.discipline, skill_id: l.skillId,
    props: l.props ?? null, best_run: l.run ?? null, drops: l.drops ?? null,
    acro_role: l.role ?? null, partner: l.partner || null, felt: l.felt ?? null, note: l.note || ''
  }),
  sequences: q => ({ id: q.id, user_id: user.id, name: q.name, discipline: q.discipline, skill_ids: q.skills })
};
const fromRow = {
  positions: r => ({ id: r.id, name: r.name, aka: r.aka, discipline: r.discipline }),
  skills: r => ({
    id: r.id, name: r.name, aka: r.aka, discipline: r.discipline, from: r.from_position, to: r.to_position,
    siteswap: r.siteswap, propCount: r.prop_count, status: r.status, notes: r.notes
  }),
  logs: r => ({
    id: r.id, date: r.logged_on, discipline: r.discipline, skillId: r.skill_id, props: r.props,
    run: r.best_run, drops: r.drops, role: r.acro_role, partner: r.partner, felt: r.felt, note: r.note
  }),
  sequences: r => ({ id: r.id, name: r.name, discipline: r.discipline, skills: r.skill_ids || [] })
};

/* ---------- persistence ---------- */
function cache() { try { localStorage.setItem(CACHE, JSON.stringify(DB)); } catch (e) {} }
function readCache() { try { const v = localStorage.getItem(CACHE); if (v) DB = JSON.parse(v); } catch (e) {} }

async function push(table, obj) {
  cache();
  if (!sb || !user) return;
  const { error } = await sb.from(table).upsert(toRow[table](obj));
  if (error) { setSync(false, 'Not saved'); toast('Could not sync: ' + error.message); }
  else setSync(true, 'Synced');
}
async function remove(table, id) {
  cache();
  if (!sb || !user) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) { setSync(false, 'Not saved'); toast('Could not sync: ' + error.message); }
  else setSync(true, 'Synced');
}

async function pull() {
  const tables = ['positions', 'skills', 'logs', 'sequences'];
  try {
    const res = await Promise.all(tables.map(t => sb.from(t).select('*')));
    res.forEach((r, i) => {
      if (r.error) throw r.error;
      DB[tables[i]] = r.data.map(fromRow[tables[i]]);
    });
    DB.logs.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
    cache();
    setSync(true, 'Synced');
    return true;
  } catch (e) {
    setSync(false, 'Offline — showing cached');
    toast('Could not reach Supabase. Working from cache.');
    return false;
  }
}

/* ============================================================
   seed — real content, so the app is useful before you type
   ============================================================ */
function seed() {
  const P = (key, name, d, aka = '') => ({ id: uid(), key, name, discipline: d, aka });
  const ps = [
    P('j_rest', 'Hands empty', 'juggling'),
    P('j_casc', 'Cascade', 'juggling', '3-ball cascade'),
    P('j_rev', 'Reverse cascade', 'juggling', 'outside throws'),
    P('j_show', 'Shower', 'juggling'),
    P('j_box', 'Box', 'juggling'),
    P('j_mills', 'Mills Mess', 'juggling'),
    P('j_fount', 'Fountain', 'juggling', '4-ball fountain'),
    P('j_casc5', '5-ball cascade', 'juggling'),
    P('a_stand', 'Standing', 'acro', 'ground'),
    P('a_s2s', 'Shin to shin', 'acro'),
    P('a_bird', 'Bird', 'acro', 'front bird'),
    P('a_rbird', 'Reverse bird', 'acro', 'back bird'),
    P('a_throne', 'Throne', 'acro'),
    P('a_whale', 'Whale', 'acro'),
    P('a_star', 'Star', 'acro'),
    P('a_f2h', 'Foot to hand', 'acro', 'F2H'),
    P('a_leaf', 'Folded leaf', 'acro'),
  ];
  const K = k => ps.find(p => p.key === k).id;
  const S = o => Object.assign({ id: uid(), aka: '', siteswap: '', propCount: null, status: 'want', notes: '' }, o);

  const sk = [
    /* juggling */
    S({ name: 'Cascade', discipline: 'juggling', from: K('j_rest'), to: K('j_casc'), siteswap: '3', propCount: 3, status: 'got', notes: 'The ground state. Everything below enters and exits from here.' }),
    S({ name: 'Reverse cascade', discipline: 'juggling', from: K('j_casc'), to: K('j_rev'), siteswap: '3', propCount: 3, status: 'got', notes: 'Throws go over the top instead of under.' }),
    S({ name: 'Back to cascade', discipline: 'juggling', from: K('j_rev'), to: K('j_casc'), siteswap: '3', propCount: 3, status: 'got' }),
    S({ name: '441', discipline: 'juggling', from: K('j_casc'), to: K('j_casc'), siteswap: '441', propCount: 3, status: 'working', notes: 'Ground state, so it drops straight in and out of cascade. Two columns and a cross.' }),
    S({ name: '531', discipline: 'juggling', from: K('j_casc'), to: K('j_casc'), siteswap: '531', propCount: 3, status: 'working', notes: 'The 1 is a fast hand-across. Feels like a shower that resolves.' }),
    S({ name: '423', discipline: 'juggling', from: K('j_casc'), to: K('j_casc'), siteswap: '423', propCount: 3, notes: 'One ball just sits in the hand on the 2. Good entry to columns work.' }),
    S({ name: 'Into shower', discipline: 'juggling', from: K('j_casc'), to: K('j_show'), siteswap: '51', propCount: 3, status: 'working' }),
    S({ name: 'Out of shower', discipline: 'juggling', from: K('j_show'), to: K('j_casc'), siteswap: '51', propCount: 3, status: 'working' }),
    S({ name: 'Box', discipline: 'juggling', from: K('j_casc'), to: K('j_box'), siteswap: '(4,2x)(2x,4)', propCount: 3, notes: 'Synchronous. The 2x is the ball passing horizontally under.' }),
    S({ name: 'Out of box', discipline: 'juggling', from: K('j_box'), to: K('j_casc'), siteswap: '(4,2x)(2x,4)', propCount: 3 }),
    S({ name: 'Mills Mess', discipline: 'juggling', from: K('j_casc'), to: K('j_mills'), siteswap: '3', propCount: 3, notes: 'Siteswap is still 3 — all the difficulty is in the arm crossing, not the throws.' }),
    S({ name: 'Unwind to cascade', discipline: 'juggling', from: K('j_mills'), to: K('j_casc'), siteswap: '3', propCount: 3 }),
    S({ name: '55500', discipline: 'juggling', from: K('j_casc'), to: K('j_casc'), siteswap: '55500', propCount: 3, notes: '3-ball flash. The gateway drill for 5.' }),
    S({ name: 'Fountain', discipline: 'juggling', from: K('j_rest'), to: K('j_fount'), siteswap: '4', propCount: 4, status: 'working', notes: 'Hands stay independent — it is two 2-ball columns, not a cascade.' }),
    S({ name: '534', discipline: 'juggling', from: K('j_fount'), to: K('j_fount'), siteswap: '534', propCount: 4 }),
    S({ name: '5-ball cascade', discipline: 'juggling', from: K('j_rest'), to: K('j_casc5'), siteswap: '5', propCount: 5 }),
    S({ name: '97531', discipline: 'juggling', from: K('j_casc5'), to: K('j_casc5'), siteswap: '97531', propCount: 5 }),
    /* acro */
    S({ name: 'Shin to shin', discipline: 'acro', from: K('a_stand'), to: K('a_s2s'), status: 'got', notes: 'Base shins vertical, flyer shins across. The warm-up entry to almost everything.' }),
    S({ name: 'Shin to shin to bird', discipline: 'acro', from: K('a_s2s'), to: K('a_bird'), status: 'got', notes: 'Flyer leans in, base receives on the feet. Hands stay connected until the balance sets.' }),
    S({ name: 'Pop to bird', discipline: 'acro', from: K('a_stand'), to: K('a_bird'), status: 'got' }),
    S({ name: 'Bird down', discipline: 'acro', from: K('a_bird'), to: K('a_stand'), status: 'got' }),
    S({ name: 'Barrel roll', discipline: 'acro', from: K('a_bird'), to: K('a_rbird'), status: 'working', notes: 'Flyer rotates over one side. Base tracks with the feet — do not chase with the hands.' }),
    S({ name: 'Reverse barrel roll', discipline: 'acro', from: K('a_rbird'), to: K('a_bird'), status: 'working', notes: 'Close the loop and you have a washing machine.' }),
    S({ name: 'Bird to throne', discipline: 'acro', from: K('a_bird'), to: K('a_throne'), status: 'working' }),
    S({ name: 'Throne to bird', discipline: 'acro', from: K('a_throne'), to: K('a_bird') }),
    S({ name: 'Throne to whale', discipline: 'acro', from: K('a_throne'), to: K('a_whale') }),
    S({ name: 'Whale to folded leaf', discipline: 'acro', from: K('a_whale'), to: K('a_leaf') }),
    S({ name: 'Folded leaf down', discipline: 'acro', from: K('a_leaf'), to: K('a_stand') }),
    S({ name: 'Throne to star', discipline: 'acro', from: K('a_throne'), to: K('a_star'), notes: 'Side star. Needs a spot the first few times.' }),
    S({ name: 'Star to throne', discipline: 'acro', from: K('a_star'), to: K('a_throne') }),
    S({ name: 'Bird to foot to hand', discipline: 'acro', from: K('a_bird'), to: K('a_f2h'), notes: 'Straight arms, stacked joints. Spot at the hips.' }),
    S({ name: 'Foot to hand down', discipline: 'acro', from: K('a_f2h'), to: K('a_stand') }),
  ];
  ps.forEach(p => delete p.key);
  return { positions: ps, skills: sk, logs: [], sequences: [] };
}

async function seedRemote() {
  const s = seed();
  DB = s;
  cache();
  const { error: e1 } = await sb.from('positions').insert(s.positions.map(toRow.positions));
  if (e1) { toast('Seed failed: ' + e1.message); return; }
  const { error: e2 } = await sb.from('skills').insert(s.skills.map(toRow.skills));
  if (e2) toast('Seed failed: ' + e2.message);
}

/* ============================================================
   VIEW: Skills
   ============================================================ */
function viewSkills() {
  const list = mySkills();
  const card = s => `<button class="card st-${s.status}" data-skill="${s.id}">
      <div class="nm">${esc(s.name)}</div>
      ${s.aka ? `<div class="aka">also: ${esc(s.aka)}</div>` : ''}
      <div class="path">${s.siteswap ? `<span class="ss">${esc(s.siteswap)}</span>` : ''}${s.propCount ? `<span>${s.propCount}</span>` : ''}
        <span>${esc(posName(s.from))}</span><span class="arw">&rarr;</span><span>${esc(posName(s.to))}</span>
      </div></button>`;

  let body;
  if (boardMode === 'board') {
    body = '<div class="board">' + STATUSES.map(([k, lab]) => {
      const items = list.filter(s => s.status === k);
      return `<div><div class="col-head"><b>${lab}</b><span class="count">${items.length}</span></div>
        <div class="stack">${items.map(card).join('') || '<div class="empty">Nothing here yet</div>'}</div></div>`;
    }).join('') + '</div>';
  } else {
    body = `<div class="stack">${[...list].sort((a, b) => a.name.localeCompare(b.name)).map(card).join('') || '<div class="empty">No skills yet</div>'}</div>`;
  }

  return `<h2>Skills</h2>
  <div class="sub">Tap a card to move it along: want &rarr; working &rarr; got it. Shift-click to edit.</div>
  <div class="row" style="margin-bottom:16px">
    <div class="seg">
      <button data-board="board" aria-pressed="${boardMode === 'board'}">Board</button>
      <button data-board="list" aria-pressed="${boardMode === 'list'}">List</button>
    </div><div class="spacer"></div>
    <button class="btn" data-act="newpos">Add position</button>
    <button class="btn primary" data-act="newskill">Add skill</button>
  </div>${body}`;
}

/* ============================================================
   VIEW: Log — two shapes, because juggling counts and acro feels
   ============================================================ */
function viewLog() {
  const list = mySkills().filter(s => s.status !== 'want');
  const opts = list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const partners = [...new Set(DB.logs.filter(l => l.partner).map(l => l.partner))];

  const form = disc === 'juggling' ? `
    <div class="field"><label for="lgSkill">Pattern</label><select id="lgSkill">${opts || '<option value="">Move a skill to Working first</option>'}</select></div>
    <div class="grid3">
      <div class="field"><label for="lgProps">Props</label><input id="lgProps" type="number" inputmode="numeric" min="1" max="11" value="3"></div>
      <div class="field"><label for="lgRun">Best run</label><input id="lgRun" type="number" inputmode="numeric" min="0" placeholder="catches"></div>
      <div class="field"><label for="lgDrops">Drops</label><input id="lgDrops" type="number" inputmode="numeric" min="0" placeholder="0"></div>
    </div>` : `
    <div class="field"><label for="lgSkill">Skill</label><select id="lgSkill">${opts || '<option value="">Move a skill to Working first</option>'}</select></div>
    <div class="grid2">
      <div class="field"><label for="lgRole">Your role</label><select id="lgRole"><option value="base">Base</option><option value="flyer">Flyer</option><option value="spotter">Spotter</option></select></div>
      <div class="field"><label for="lgPartner">Partner</label><input id="lgPartner" list="partnerList" placeholder="name">
        <datalist id="partnerList">${partners.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
    </div>
    <div class="field"><label>How did it feel</label>
      <div class="felt" id="lgFelt">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-felt="${n}" aria-pressed="${n === 3}">${n}</button>`).join('')}</div></div>`;

  const mine = DB.logs.filter(l => l.discipline === disc);
  const recent = mine.slice(0, 30).map(l => {
    const s = skill(l.skillId);
    const meta = disc === 'juggling'
      ? [l.props ? l.props + ' props' : null, l.run != null ? l.run + ' catches' : null, l.drops ? l.drops + ' drops' : null].filter(Boolean).join('  ·  ')
      : [l.role, l.partner ? 'with ' + l.partner : null, l.felt ? l.felt + '/5' : null].filter(Boolean).join('  ·  ');
    return `<div class="entry"><div class="when">${fmtDay(l.date)}</div>
      <div class="what"><div>${esc(s ? s.name : '(deleted skill)')}</div><div class="meta">${esc(meta)}</div></div>
      <button class="btn sm ghost" data-dellog="${l.id}" aria-label="Delete entry">&times;</button></div>`;
  }).join('');

  return `<h2>Log</h2>
  <div class="sub">${disc === 'juggling'
      ? 'Numbers, not feelings. A run is only a run if you counted it.'
      : 'Same trick, different role, different partner — log all three or the history lies to you.'}</div>
  <div style="border:1px solid var(--line);border-radius:var(--r);padding:15px;background:var(--surface);margin-bottom:22px">
    ${form}<button class="btn primary" style="width:100%" data-act="savelog">Log it</button>
  </div>
  <div class="col-head"><b>Recent</b><span class="count">${mine.length}</span></div>
  ${recent || '<div class="empty">Nothing logged yet. The first entry is the hard one.</div>'}`;
}

/* ============================================================
   VIEW: Build — a sequence is a path; a closed path is a loop
   ============================================================ */
function analyse(ids) {
  const ss = ids.map(skill).filter(Boolean);
  const joints = [];
  for (let i = 0; i < ss.length - 1; i++) joints.push({ ok: ss[i].to === ss[i + 1].from });
  return { ss, joints, closed: ss.length > 1 && ss[0].from === ss[ss.length - 1].to, allOk: joints.every(j => j.ok) };
}
const bridges = (a, b) => mySkills().filter(s => s.from === a && s.to === b);

function viewBuild() {
  const { ss, joints, closed, allOk } = analyse(chain);
  const last = ss.length ? ss[ss.length - 1] : null;

  const chainHtml = ss.map((s, i) => {
    let joint = '';
    if (i > 0) {
      if (joints[i - 1].ok) joint = `<div class="joint ok">&#9679; lands in ${esc(posName(ss[i - 1].to))}</div>`;
      else joint = `<div class="joint bad">&#9888; breaks — you end in ${esc(posName(ss[i - 1].to))} but the next skill starts from ${esc(posName(s.from))}</div>`
        + bridges(ss[i - 1].to, s.from).slice(0, 3).map(x => `<button class="bridge" data-insert="${x.id}" data-at="${i}">Insert &ldquo;${esc(x.name)}&rdquo; to connect</button>`).join('');
    }
    return joint + `<div class="link"><div class="idx">${i + 1}</div>
      <div class="body"><div class="nm">${esc(s.name)}${s.siteswap ? ` <span class="ss">${esc(s.siteswap)}</span>` : ''}</div>
      <div class="pos">${esc(posName(s.from))} &rarr; ${esc(posName(s.to))}</div></div>
      <button class="btn sm ghost" data-rmlink="${i}" aria-label="Remove">&times;</button></div>`;
  }).join('');

  let verdict = '';
  if (ss.length > 1) {
    if (!allOk) verdict = `<div class="verdict bad"><h3>Doesn't connect yet</h3>Fix the breaks above, or drop the skill that doesn't fit.</div>`;
    else if (closed) verdict = `<div class="verdict loop"><h3>${disc === 'acro' ? 'Washing machine' : 'Closed loop'}</h3>
      This returns to ${esc(posName(ss[0].from))}, so you can run it continuously.
      ${disc === 'acro' ? 'That is the whole point of a washing machine — no reset between rounds.' : 'Ground state in, ground state out.'}</div>`;
    else verdict = `<div class="verdict good"><h3>Valid sequence</h3>Runs from ${esc(posName(ss[0].from))} to ${esc(posName(ss[ss.length - 1].to))}.
      ${bridges(ss[ss.length - 1].to, ss[0].from).length ? 'You already have a skill that would close this into a loop — it is highlighted below.' : 'Add a skill back to ' + esc(posName(ss[0].from)) + ' to close it into a loop.'}</div>`;
  }

  const picker = mySkills().map(s => `<button data-add="${s.id}" class="${(!last || s.from === last.to) ? 'live' : ''}">${esc(s.name)}</button>`).join('');
  const saved = DB.sequences.filter(q => q.discipline === disc).map(q =>
    `<button class="bridge" data-loadseq="${q.id}">${esc(q.name)} <span style="opacity:.6">— ${q.skills.length} skills</span></button>`).join('');

  return `<h2>Build</h2>
  <div class="sub">Chain skills together. Trilha checks whether each one actually starts where the last one ended${disc === 'acro' ? ", and tells you when you've closed a washing machine" : ''}.</div>
  ${ss.length ? `<div class="chain">${chainHtml}</div>${verdict}
    <div class="row" style="margin-top:14px"><button class="btn" data-act="clearchain">Clear</button>
    <button class="btn primary" data-act="saveseq">Save sequence</button></div>`
      : '<div class="empty">Pick a skill below to start a chain.<br>Highlighted ones start where you currently are.</div>'}
  <div style="margin-top:24px"><div class="col-head"><b>Add a skill</b><span class="count">${last ? 'from ' + esc(posName(last.to)) : 'any start'}</span></div>
  <div class="picker">${picker}</div></div>
  ${saved ? `<div style="margin-top:26px"><div class="col-head"><b>Saved</b></div>${saved}</div>` : ''}`;
}

/* ============================================================
   VIEW: Map — the graph you are actually training
   ============================================================ */
function viewMap() {
  const ps = myPositions(), ss = mySkills();
  const W = 760, H = 520, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 72;
  const pt = {};
  ps.forEach((p, i) => {
    const a = (i / ps.length) * Math.PI * 2 - Math.PI / 2;
    pt[p.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const opa = { want: .22, working: .55, got: 1 };

  const edges = ss.map(s => {
    const a = pt[s.from], b = pt[s.to];
    if (!a || !b) return '';
    if (s.from === s.to) return `<circle cx="${a.x}" cy="${a.y - 26}" r="17" fill="none" stroke="var(--hue)"
      stroke-opacity="${opa[s.status]}" stroke-width="1.6" stroke-dasharray="${s.status === 'want' ? '3 3' : ''}"><title>${esc(s.name)} (loops in place)</title></circle>`;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y;
    return `<path d="M${a.x} ${a.y} Q${mx - dy * .12} ${my + dx * .12} ${b.x} ${b.y}" fill="none" stroke="var(--hue)"
      stroke-opacity="${opa[s.status]}" stroke-width="${s.status === 'got' ? 2.2 : 1.5}"
      stroke-dasharray="${s.status === 'want' ? '4 4' : ''}"><title>${esc(s.name)}: ${esc(posName(s.from))} → ${esc(posName(s.to))}</title></path>`;
  }).join('');

  const nodes = ps.map(p => {
    const deg = ss.filter(s => s.from === p.id || s.to === p.id).length;
    const got = ss.filter(s => (s.from === p.id || s.to === p.id) && s.status === 'got').length;
    const r = 7 + Math.min(deg, 10) * 1.1;
    return `<g><circle cx="${pt[p.id].x}" cy="${pt[p.id].y}" r="${r}" fill="${got ? 'var(--hue)' : 'var(--surface2)'}"
      stroke="var(--hue)" stroke-opacity="${got ? 1 : .4}" stroke-width="1.6"><title>${esc(p.name)} — ${deg} skills, ${got} solid</title></circle>
      <text x="${pt[p.id].x}" y="${pt[p.id].y + r + 15}" text-anchor="middle" fill="var(--chalk)" font-size="12.5" font-family="Space Grotesk">${esc(p.name)}</text></g>`;
  }).join('');

  const orphans = ps.filter(p => !ss.some(s => s.from === p.id || s.to === p.id));
  return `<h2>Map</h2>
  <div class="sub">Circles are positions. Lines are skills. The more solid the line, the more solid the skill.</div>
  <div class="mapwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your position graph">${edges}${nodes}</svg></div>
  <div class="legend"><span><i style="border-style:dashed;opacity:.35;border-color:var(--hue)"></i>Want</span>
  <span><i style="opacity:.6;border-color:var(--hue)"></i>Working</span><span><i style="border-color:var(--hue)"></i>Got it</span></div>
  <div class="sub" style="margin-top:16px">${STATUSES.map(([k, l]) => `${l}: ${ss.filter(s => s.status === k).length}`).join('   ·   ')}</div>
  ${orphans.length ? `<div class="empty" style="text-align:left">Positions with nothing attached yet: ${orphans.map(o => esc(o.name)).join(', ')}. Those are the gaps in your vocabulary.</div>` : ''}`;
}

/* ============================================================
   sheets
   ============================================================ */
function openSkill(id) {
  const s = id ? skill(id) : null, ps = myPositions();
  const opt = sel => ps.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const isJ = disc === 'juggling';
  $('#sheetHost').innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">
    <h3>${s ? 'Edit skill' : 'New skill'}</h3>
    <div class="field"><label for="skName">Name</label><input id="skName" value="${esc(s?.name || '')}" placeholder="${isJ ? 'e.g. 441' : 'e.g. Barrel roll'}"></div>
    <div class="field"><label for="skAka">Also called</label><input id="skAka" value="${esc(s?.aka || '')}" placeholder="other names your coach uses"></div>
    <div class="grid2">
      <div class="field"><label for="skFrom">Starts from</label><select id="skFrom">${opt(s?.from || ps[0]?.id)}</select></div>
      <div class="field"><label for="skTo">Ends in</label><select id="skTo">${opt(s?.to || ps[0]?.id)}</select></div></div>
    ${isJ ? `<div class="grid2">
      <div class="field"><label for="skSS">Siteswap</label><input id="skSS" class="mono" value="${esc(s?.siteswap || '')}" placeholder="441"></div>
      <div class="field"><label for="skPC">Props</label><input id="skPC" type="number" min="1" max="11" value="${s?.propCount || 3}"></div></div>` : ''}
    <div class="field"><label for="skStatus">Status</label><select id="skStatus">${STATUSES.map(([k, l]) => `<option value="${k}" ${s?.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="skNotes">Notes</label><textarea id="skNotes" rows="3" placeholder="cues, corrections, what your coach said">${esc(s?.notes || '')}</textarea></div>
    <div class="actions">${s ? `<button class="btn danger" data-act="delskill" data-id="${s.id}">Delete</button>` : ''}
      <button class="btn" data-act="close">Cancel</button>
      <button class="btn primary" data-act="savskill" data-id="${s?.id || ''}">Save</button></div>
  </div></div>`;
  setTimeout(() => $('#skName')?.focus(), 40);
}
function openPosition() {
  $('#sheetHost').innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">
    <h3>New position</h3>
    <div class="sub">A position is a place you can be — a pattern in juggling, a shape in acro. Skills are the moves between them.</div>
    <div class="field"><label for="poName">Name</label><input id="poName" placeholder="${disc === 'juggling' ? 'e.g. Half shower' : 'e.g. Ninja star'}"></div>
    <div class="field"><label for="poAka">Also called</label><input id="poAka"></div>
    <div class="actions"><button class="btn" data-act="close">Cancel</button>
    <button class="btn primary" data-act="savpos">Save</button></div></div></div>`;
  setTimeout(() => $('#poName')?.focus(), 40);
}
const closeSheet = () => { $('#sheetHost').innerHTML = ''; };

/* ============================================================
   render + events
   ============================================================ */
function render() {
  document.documentElement.style.setProperty('--hue', disc === 'juggling' ? 'var(--juggle)' : 'var(--acro)');
  $('#main').innerHTML = view === 'skills' ? viewSkills() : view === 'log' ? viewLog() : view === 'build' ? viewBuild() : viewMap();
  $$('#nav button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === view));
  $$('#disc button').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === disc));
}

document.addEventListener('click', async e => {
  if (e.target.classList?.contains('scrim')) return closeSheet();
  const t = e.target.closest('[data-v],[data-d],[data-board],[data-skill],[data-act],[data-rmlink],[data-add],[data-insert],[data-dellog],[data-loadseq],[data-felt]');
  if (!t) return;

  if (t.dataset.v) { view = t.dataset.v; return render(); }
  if (t.dataset.d) { disc = t.dataset.d; chain = []; return render(); }
  if (t.dataset.board) { boardMode = t.dataset.board; return render(); }

  if (t.dataset.skill) {
    const s = skill(t.dataset.skill);
    if (e.shiftKey || e.metaKey || e.ctrlKey) return openSkill(s.id);
    s.status = nextStatus(s.status);
    render(); return push('skills', s);
  }
  if (t.dataset.felt) { $$('#lgFelt button').forEach(b => b.setAttribute('aria-pressed', b === t)); return; }
  if (t.dataset.add) { chain.push(t.dataset.add); return render(); }
  if (t.dataset.insert) { chain.splice(+t.dataset.at, 0, t.dataset.insert); return render(); }
  if (t.dataset.rmlink !== undefined) { chain.splice(+t.dataset.rmlink, 1); return render(); }
  if (t.dataset.loadseq) { chain = [...DB.sequences.find(q => q.id === t.dataset.loadseq).skills]; return render(); }
  if (t.dataset.dellog) { const id = t.dataset.dellog; DB.logs = DB.logs.filter(l => l.id !== id); render(); return remove('logs', id); }

  switch (t.dataset.act) {
    case 'newskill': return openSkill(null);
    case 'newpos': return openPosition();
    case 'close': return closeSheet();

    case 'savpos': {
      const name = $('#poName').value.trim();
      if (!name) return toast('Give it a name first.');
      const p = { id: uid(), name, aka: $('#poAka').value.trim(), discipline: disc };
      DB.positions.push(p); closeSheet(); render(); return push('positions', p);
    }
    case 'savskill': {
      const name = $('#skName').value.trim();
      if (!name) { $('#skName').focus(); return toast('Give it a name first.'); }
      const data = {
        name, aka: $('#skAka').value.trim(), from: $('#skFrom').value, to: $('#skTo').value,
        status: $('#skStatus').value, notes: $('#skNotes').value.trim(),
        siteswap: $('#skSS')?.value.trim() || '', propCount: $('#skPC') ? +$('#skPC').value : null, discipline: disc
      };
      let obj;
      if (t.dataset.id) { obj = Object.assign(skill(t.dataset.id), data); }
      else { obj = Object.assign({ id: uid() }, data); DB.skills.push(obj); }
      closeSheet(); render(); return push('skills', obj);
    }
    case 'delskill': {
      const id = t.dataset.id;
      DB.skills = DB.skills.filter(s => s.id !== id);
      chain = chain.filter(x => x !== id);
      closeSheet(); render(); return remove('skills', id);
    }
    case 'savelog': {
      const sid = $('#lgSkill')?.value;
      if (!sid || !skill(sid)) return toast('Move a skill to Working first.');
      const entry = { id: uid(), date: today(), discipline: disc, skillId: sid };
      if (disc === 'juggling') {
        entry.props = +$('#lgProps').value || null;
        entry.run = $('#lgRun').value === '' ? null : +$('#lgRun').value;
        entry.drops = $('#lgDrops').value === '' ? null : +$('#lgDrops').value;
      } else {
        entry.role = $('#lgRole').value;
        entry.partner = $('#lgPartner').value.trim();
        entry.felt = +($('#lgFelt [aria-pressed="true"]')?.dataset.felt || 3);
      }
      DB.logs.unshift(entry);
      const s = skill(sid);
      if (s.status === 'want') { s.status = 'working'; push('skills', s); }
      render(); toast('Logged.');
      return push('logs', entry);
    }
    case 'clearchain': chain = []; return render();
    case 'saveseq': {
      if (chain.length < 2) return toast('Add at least two skills.');
      const { closed } = analyse(chain);
      const name = prompt('Name this sequence', closed && disc === 'acro' ? 'Washing machine' : 'Sequence ' + (DB.sequences.length + 1));
      if (!name) return;
      const q = { id: uid(), name, discipline: disc, skills: [...chain] };
      DB.sequences.push(q); render(); toast('Saved.');
      return push('sequences', q);
    }
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- auth ---------- */
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!sb) return;
  const email = $('#email').value.trim();
  const btn = $('#authBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href.split('#')[0] } });
  btn.disabled = false; btn.textContent = 'Send me a sign-in link';
  $('#authNote').textContent = error
    ? 'Could not send: ' + error.message
    : 'Link sent. Check your email — it expires in an hour, and opening it on this device signs you in here.';
});
$('#signout').addEventListener('click', async () => {
  localStorage.removeItem(CACHE);
  await sb.auth.signOut();
  location.reload();
});
$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `trilha-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- boot ---------- */
async function start(session) {
  user = session.user;
  $('#gate').hidden = true;
  $('#app').hidden = false;
  readCache();
  render();
  const ok = await pull();
  if (ok && DB.positions.length === 0) { await seedRemote(); }
  render();
}

(async () => {
  if (!configured) {
    $('#gate').hidden = false;
    $('#cfgWarn').hidden = false;
    $('#authForm').style.display = 'none';
    $('#authNote').textContent = '';
    return;
  }
  const { data } = await sb.auth.getSession();
  if (data.session) start(data.session);
  else $('#gate').hidden = false;

  sb.auth.onAuthStateChange((event, session) => {
    if (session && $('#app').hidden) start(session);
  });
})();
