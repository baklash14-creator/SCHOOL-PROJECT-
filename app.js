const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const TABS = [
  ['Overview', [['Dashboard','📊','dash'], ['Guide','📖','raw']]],
  ['Views', [['Report Card','🧾','rc'], ['Results','🏆','res'], ['Class List','👥','cl'], ['Class Attendance','✅','ca'],
             ['Class Grades','📝','cg'], ['ID Cards','🪪','id'], ['Timetable View','🗓️','tv']]],
  ['Records', [['Schools','🏫'], ['Classes','🚪'], ['Teachers','👩‍🏫'], ['Students','🎒'], ['Attendance','📅'], ['Grades','🎓'],
               ['Fees','💰'], ['Timetable','⏰'], ['Staff Attendance','🕘'], ['Payroll','💵']]],
  ['System', [['Settings','⚙️','raw'], ['Email Log','✉️','ro'], ['Report Files','📁','ro']]]
];
const demo = !CONFIG.API_URL;
let D, cur = 'Dashboard', S = {}, sort = null, KEY = localStorage.sm_key || '';
const rows = n => (D && D.sheets && D.sheets[n])
  ? D.sheets[n].rows
  : [];
const schools = () => rows('Schools').filter(r => r['School Name']).map(r => ({v: r['School ID (auto)'], t: r['School Name']}));
const studs = () => rows('Students').filter(r => r['Full Name']);
const sid = s => s['Student ID (auto)'];
const klass = () => studs().filter(r => r['School ID'] == S.school && r.Class == S.class && r.Status == 'Active');
const band = f => D.meta.bands.find(b => f >= b[0]) || [0, 'F', 'Fail'];
const toast = m => { const t = $('#toast'); t.textContent = m; t.className = 'show'; setTimeout(() => t.className = '', 2600); };

/* ---------- data layer: Google Sheet via Apps Script, or demo data ---------- */
async function load() {
  if (demo) {
    D = await (await fetch('data/seed.json')).json();
    const o = localStorage.sm_demo; if (o) D.sheets = JSON.parse(o);
    return;
  }
  const r = await (await fetch(CONFIG.API_URL + '?key=' + encodeURIComponent(KEY))).json();
  if (r.error) throw r.error;
  D = r;
}
async function send(ops) {
  if (!demo) {
    const r = await (await fetch(CONFIG.API_URL, {method: 'POST', body: JSON.stringify({key: KEY, ops})})).json();
    if (r.error) throw r.error;
    return load();
  }
  ops.forEach(o => {   // demo: mimic what the sheet does
    const t = D.sheets[o.sheet]; let r;
    if (o.action == 'add') { r = {_r: Math.max(4, ...t.rows.map(x => x._r)) + 1}; t.headers.forEach(k => r[k] = ''); t.rows.push(r); }
    else r = t.rows.find(x => x._r == o.row);
    t.headers.forEach((k, i) => { if (t.edit[i]) { if (o.action == 'delete') r[k] = ''; else if (o.values && k in o.values) r[k] = o.values[k]; } });
    if (o.action == 'delete') t.rows.splice(t.rows.indexOf(r), 1); else derive(o.sheet, r);
  });
  localStorage.sm_demo = JSON.stringify(D.sheets);
}
function derive(s, r) {   // fills the formula columns in demo mode only
  const t = D.sheets[s], id = t.headers[0], pad = {Schools: 2, Classes: 3, Teachers: 3, Students: 4}[s];
  if (id.endsWith('(auto)') && !r[id]) r[id] = {Schools: 'SCH', Classes: 'C', Teachers: 'T', Students: 'S'}[s] + String(t.rows.indexOf(r) + 1).padStart(pad, '0');
  const st = studs().find(x => sid(x) == r['Student ID']) || {}, te = rows('Teachers').find(x => x['Teacher ID (auto)'] == r['Teacher ID'] || x['Teacher ID (auto)'] == r['Class Teacher ID']) || {};
  if ('Student Name' in r) Object.assign(r, {'Student Name': st['Full Name'] || 'ID not found', 'School ID': st['School ID'], Class: st.Class});
  if ('Teacher Name' in r) Object.assign(r, {'Teacher Name': te['Full Name'] || 'ID not found', 'School ID': te['School ID']});
  if ('Teacher' in r) r.Teacher = te['Full Name'] || '';
  if ('Class Teacher' in r) r['Class Teacher'] = te['Full Name'] || '';
  if (s == 'Grades') {
    const v = [r['Class Work (0-100)'], r['Exam (0-100)']].filter(x => x !== '' && x != null).map(Number), w = D.meta.cw;
    const f = v.length == 2 ? Math.round((v[0] * w + v[1] * (1 - w)) * 10) / 10 : v.length ? v[0] : '';
    const g = f === '' ? ['', '', ''] : band(f); Object.assign(r, {'Final Score (auto)': f, Grade: g[1], Remark: g[2]});
  }
  if (s == 'Fees') { const b = r['Amount Due'] - r['Amount Paid']; r.Balance = b; r.Status = b <= 0 ? 'Paid' : r['Amount Paid'] > 0 ? 'Partial' : 'Unpaid'; }
  if (s == 'Payroll') { r['Days Absent (auto)'] = r['Days Absent (auto)'] || 0; r['Absence Deduction (auto)'] = r['Absence Deduction (auto)'] || 0; r['Net Pay (auto)'] = +r['Basic Salary'] + +r.Allowances - r['Absence Deduction (auto)'] - (+r['Other Deductions'] || 0); }
}
async function run(ops) {
  try { await send(ops); toast('Saved ✓'); render(); } catch (e) { toast('Error: ' + e); }
}

/* ---------- small UI helpers ---------- */
const tbl = (h, r) => r.length ? `<div class="tw"><table><tr>${h.map(x => `<th>${esc(x)}</th>`).join('')}</tr>${r.map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : '<div class="card empty">Nothing here yet.</div>';
const pick = fs => '<div class="f">' + fs.map(([k, l, o]) => o == 'date' ? `<label>${l}<input type="date" data-k="${k}" value="${S[k]}"></label>`
  : `<label>${l}<select data-k="${k}">${o.map(x => `<option value="${esc(x.v ?? x)}" ${S[k] == (x.v ?? x) ? 'selected' : ''}>${esc(x.t ?? x)}</option>`).join('')}</select></label>`).join('') + '</div>';
const SC = () => [['school', 'School', schools()], ['class', 'Class', D.meta.classes]];
const TERMS = () => [...D.meta.terms, 'All terms'];
const STU = () => ['student', 'Student', studs().map(s => ({v: sid(s), t: sid(s) + ' · ' + s['Full Name']}))];
const hb = (t, o) => { const m = Math.max(1, ...Object.values(o)); return `<div class="card"><h3>${t}</h3>` + (Object.entries(o).map(([k, v]) => `<div class="hb"><span>${esc(k)}</span><i style="width:${v / m * 100}%"></i><b>${v}</b></div>`).join('') || '<p class="mut">No data yet</p>') + '</div>'; };
const cnt = (l, f) => l.reduce((o, x) => { const k = f(x); if (k) o[k] = (o[k] || 0) + 1; return o; }, {});
const sum = (l, k) => l.reduce((p, x) => p + (+x[k] || 0), 0);
const schoolName = () => (schools().find(s => s.v == S.school) || {}).t || CONFIG.SCHOOL_NAME;

/* ---------- views ---------- */
const V = {
  dash() {
    const st = studs().filter(x => x.Status == 'Active'), te = rows('Teachers').filter(x => x['Full Name'] && x.Status == 'Active');
    const a = rows('Attendance').filter(x => x['Student ID']), fe = rows('Fees').filter(x => x['Student ID']);
    const due = sum(fe, 'Amount Due'), paid = sum(fe, 'Amount Paid'), cur = D.meta.currency;
    const rate = a.length ? Math.round(a.filter(x => x['Status (P/A/L)'] != 'A').length / a.length * 100) + '%' : '–';
    const nm = Object.fromEntries(schools().map(s => [s.v, s.t]));
    return `<div class="kpis"><div class="kpi"><small>Students</small><b>${st.length}</b></div><div class="kpi"><small>Teachers</small><b>${te.length}</b></div>
      <div class="kpi"><small>Attendance rate</small><b>${rate}</b></div><div class="kpi"><small>Fees collected</small><b>${due ? Math.round(paid / due * 100) + '%' : '–'}</b></div></div>
      <p class="mut">Academic year ${esc(D.meta.year)} · Outstanding fees: ${cur} ${(due - paid).toLocaleString()}</p>
      <div class="grid2">${hb('Students per school', cnt(st, x => nm[x['School ID']]))}${hb('Students per class', cnt(st, x => x.Class))}
      ${hb('Fee status', cnt(fe, x => x.Status))}${hb('Attendance marks', cnt(a, x => x['Status (P/A/L)']))}${hb('Grades awarded', cnt(rows('Grades'), x => x.Grade))}</div>`;
  },
  raw() {
    const g = D.raw[cur].filter(r => r.some(c => c !== '')), w = Math.max(...g.map(r => r.map(c => c !== '').lastIndexOf(true))) + 1;
    return `<p class="mut">Read-only here. ${cur == 'Settings' ? 'Change settings in the Google Sheet.' : ''}</p><div class="tw"><table>${g.map(r => `<tr>${r.slice(0, w).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  },
  cl: () => pick(SC()) + tbl(['ID', 'Name', 'Gender', 'Guardian', 'Phone'], klass().map(r => [sid(r), r['Full Name'], r.Gender, r.Guardian, r['Guardian Phone']])),
  res() {
    const g = rows('Grades').filter(x => (S.term == 'All terms' || x.Term == S.term) && x['Final Score (auto)'] !== '');
    const r = klass().map(s => { const m = g.filter(x => x['Student ID'] == sid(s)).map(x => +x['Final Score (auto)']); return {id: sid(s), n: s['Full Name'], c: m.length, a: m.length ? sum(m.map(v => ({v})), 'v') / m.length : null}; }).sort((p, q) => (q.a ?? -1) - (p.a ?? -1));
    return pick([...SC(), ['term', 'Term', TERMS()]]) + tbl(['Rank', 'ID', 'Name', 'Subjects', 'Average', 'Grade'], r.map((x, i) => [x.a == null ? '–' : i + 1, x.id, x.n, x.c, x.a == null ? '–' : x.a.toFixed(1), x.a == null ? '' : band(x.a)[1]]));
  },
  rc() {
    const s = studs().find(x => sid(x) == S.student) || {}, g = rows('Grades').filter(x => x['Student ID'] == S.student && (S.term == 'All terms' || x.Term == S.term));
    const a = rows('Attendance').filter(x => x['Student ID'] == S.student), avg = g.length ? sum(g, 'Final Score (auto)') / g.length : null;
    return pick([STU(), ['term', 'Term', TERMS()]]) + `<div class="card"><h3>${esc(CONFIG.SCHOOL_NAME)} · Report Card</h3><p>${esc(s['Full Name'])} · ${esc(s.Class)} · ${esc(D.meta.year)} · ${esc(S.term)}</p>`
      + tbl(['Subject', 'Class Work', 'Exam', 'Final', 'Grade', 'Remark'], g.map(x => [x.Subject, x['Class Work (0-100)'], x['Exam (0-100)'], x['Final Score (auto)'], x.Grade, x.Remark]))
      + `<p><b>Average:</b> ${avg == null ? '–' : avg.toFixed(1) + ' (' + band(avg)[1] + ')'} &nbsp; <b>Attendance:</b> ${a.length ? Math.round(a.filter(x => x['Status (P/A/L)'] != 'A').length / a.length * 100) + '%' : '–'}</p></div><button class="pri" onclick="print()">🖨 Print</button>`;
  },
  ca() {
    const att = rows('Attendance').filter(x => x.Date == S.date);
    return pick([...SC(), ['date', 'Date', 'date']]) + `<div class="tw"><table><tr><th>ID</th><th>Name</th><th>Mark</th></tr>` + klass().map(s => {
      const m = (att.find(x => x['Student ID'] == sid(s)) || {})['Status (P/A/L)'] || 'P';
      return `<tr><td>${sid(s)}</td><td>${esc(s['Full Name'])}</td><td>${['P', 'A', 'L'].map(v => `<label class="seg"><input type="radio" name="m_${sid(s)}" value="${v}" ${m == v ? 'checked' : ''}><span>${v}</span></label>`).join('')}</td></tr>`;
    }).join('') + `</table></div><p><button class="pri" onclick="saveAtt()">Save attendance</button> <span class="mut">P present · A absent · L late</span></p>`;
  },
  cg() {
    const f = id => rows('Grades').find(x => x['Student ID'] == id && x.Subject == S.subject && x.Term == S.term) || {};
    return pick([...SC(), ['term', 'Term', D.meta.terms], ['subject', 'Subject', D.meta.subjects]]) + `<div class="tw"><table><tr><th>ID</th><th>Name</th><th>Class Work</th><th>Exam</th><th>Final</th></tr>` + klass().map(s => {
      const e = f(sid(s)); return `<tr><td>${sid(s)}</td><td>${esc(s['Full Name'])}</td>` + [['cw', 'Class Work (0-100)'], ['ex', 'Exam (0-100)']].map(([k, h]) => `<td><input type="number" min="0" max="100" style="width:80px" data-id="${sid(s)}" data-f="${k}" value="${e[h] ?? ''}"></td>`).join('') + `<td>${e['Final Score (auto)'] ?? ''}</td></tr>`;
    }).join('') + `</table></div><p><button class="pri" onclick="saveGr()">Save grades</button> <span class="mut">Leave empty to skip a student</span></p>`;
  },
  id: () => pick(SC()) + '<div class="cards">' + klass().map(s => `<div class="idc"><small>${esc(schoolName())}</small><div class="av">${esc(s['Full Name'][0])}</div><b>${esc(s['Full Name'])}</b><span>${sid(s)} · ${esc(s.Class)}</span><em>${esc(D.meta.year)}</em></div>`).join('') + '</div><button class="pri" onclick="print()">🖨 Print cards</button>',
  tv() {
    const t = rows('Timetable').filter(x => x['School ID'] == S.school && x.Class == S.class), P = [...new Set(t.map(x => +x.Period))].sort((a, b) => a - b), days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return pick(SC()) + (P.length ? `<div class="tw"><table><tr><th>Period</th>${days.map(d => `<th>${d}</th>`).join('')}</tr>` + P.map(p => `<tr><th>${p}</th>` + days.map(d => { const l = t.find(x => x.Day == d && x.Period == p); return `<td>${l ? `<b>${esc(l.Subject)}</b><br><small class="mut">${esc(l.Teacher)}</small>` : ''}</td>`; }).join('') + '</tr>').join('') + '</table></div>' : '<div class="card empty">No lessons for this class yet.</div>');
  },
  ro: () => V.tbl(true),
  tbl(ro) {
    const t = D.sheets[cur], q = $('#q').value.toLowerCase();
    let r = t.rows.filter(x => !q || t.headers.some(k => String(x[k]).toLowerCase().includes(q)));
    if (sort && sort.n == cur) r = [...r].sort((a, b) => (a[sort.k] > b[sort.k] ? 1 : -1) * sort.d);
    return `<div class="tb"><span>${r.length} record${r.length == 1 ? '' : 's'}</span>${ro ? '' : `<button class="pri" data-a="add">＋ Add new</button>`}</div><div class="tw"><table><tr>${t.headers.map(k => `<th data-a="sort" data-k="${esc(k)}">${esc(k.replace(' (auto)', ''))}${sort && sort.k == k && sort.n == cur ? (sort.d > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}${ro ? '' : '<th></th>'}</tr>`
      + r.map(x => `<tr>${t.headers.map((k, i) => `<td class="${t.edit[i] ? '' : 'au'}">${esc(x[k])}</td>`).join('')}${ro ? '' : `<td><button data-a="edit" data-r="${x._r}">✏️</button> <button data-a="del" data-r="${x._r}">🗑</button></td>`}</tr>`).join('') + '</table></div>' + (r.length ? '' : '<div class="empty">No records.</div>')
      + (ro ? '' : '<p class="mut">Grey columns are calculated by the spreadsheet formulas.</p>');
  }
};

/* ---------- forms & actions ---------- */
function options(s, h) {
  const ids = (n, c) => rows(n).map(r => r[c]).filter(Boolean);
  if (h == 'Gender') return ['M', 'F'];
  if (h == 'School ID') return ids('Schools', 'School ID (auto)');
  if (h == 'Class' || h == 'Class Name') return D.meta.classes;
  if (h == 'Term') return D.meta.terms;
  if (/Subject$/.test(h)) return D.meta.subjects;
  if (h == 'Student ID') return ids('Students', 'Student ID (auto)');
  if (/Teacher ID$/.test(h)) return ids('Teachers', 'Teacher ID (auto)');
  if (h == 'Day') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (h == 'Period') return [1, 2, 3, 4, 5, 6, 7, 8];
  if (h.startsWith('Status')) return s == 'Students' || s == 'Teachers' ? ['Active', 'Left'] : s == 'Payroll' ? ['Unpaid', 'Paid'] : s == 'Staff Attendance' ? ['P', 'A', 'L', 'V'] : ['P', 'A', 'L'];
}

function form(n, x) {
  const t = D.sheets[n], d = $('#dlg');
  x = x || {};

  // Special form for Students
  if (n === 'Students') {
    const schoolOptions = schools().map(s =>
      `<option value="${esc(s.v)}" ${s.v == (x['School ID'] || '') ? 'selected' : ''}>${esc(s.t)}</option>`
    ).join('');

    const classOptions = (D.meta.classes || []).map(c =>
      `<option value="${esc(c)}" ${c == (x['Class'] || '') ? 'selected' : ''}>${esc(c)}</option>`
    ).join('');

    d.innerHTML = `
      <form id="ff">
        <h3>${x._r ? 'Edit' : 'Add'} · Student</h3>

        <div class="g">

          <label>
            Full Name
            <input name="Full Name" type="text"
              value="${esc(x['Full Name'] || '')}" required>
          </label>

          <label>
            Gender
            <select name="Gender" required>
              <option value="">Select gender</option>
              <option value="Male" ${x['Gender'] === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${x['Gender'] === 'Female' ? 'selected' : ''}>Female</option>
            </select>
          </label>

          <label>
            Date of Birth
            <input name="DOB" type="date"
              value="${esc(x['DOB'] || '')}">
          </label>

          <label>
            School
            <select name="School ID" required>
              <option value="">Select school ID</option>
               <option value="SCH001" ${x['School ID'] === 'SCH001' ? 'selected' : ''}>SCH001</option>
            </select>
          </label>

          <label>
            Class
            <select name="Class" required>
              <option value="">Select class</option>
              <option value="JSS 1" ${x['Class'] === 'JSS 1' ? 'selected' : ''}>JSS 1</option>
    <option value="JSS 2" ${x['Class'] === 'JSS 2' ? 'selected' : ''}>JSS 2</option>
    <option value="JSS 3" ${x['Class'] === 'JSS 3' ? 'selected' : ''}>JSS 3</option>
    <option value="SSS 1" ${x['Class'] === 'SSS 1' ? 'selected' : ''}>SSS 1</option>
    <option value="SSS 2" ${x['Class'] === 'SSS 2' ? 'selected' : ''}>SSS 2</option>
    <option value="SSS 3" ${x['Class'] === 'SSS 3' ? 'selected' : ''}>SSS 3</option>
  </select>
</label>
            </select>
          </label>

          <label>
            Guardian Name
            <input name="Guardian Name" type="text"
              value="${esc(x['Guardian Name'] || '')}">
          </label>

          <label>
            Guardian Phone
            <input name="Guardian Phone" type="tel"
              value="${esc(x['Guardian Phone'] || '')}">
          </label>

          <label>
            Address
            <input name="Address" type="text"
              value="${esc(x['Address'] || '')}">
          </label>

          <label>
            Date Admitted
            <input name="Date Admitted" type="date"
              value="${esc(x['Date Admitted'] || '')}">
          </label>

          <label>
            Status
            <select name="Status">
              <option value="Active" ${x['Status'] === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${x['Status'] === 'Inactive' ? 'selected' : ''}>Inactive</option>
            </select>
          </label>

          <label>
            Guardian Email
            <input name="Guardian Email" type="email"
              value="${esc(x['Guardian Email'] || '')}">
          </label>

        </div>

        <div class="ac">
          <button type="button" onclick="dlg.close()">Cancel</button>
          <button class="pri" type="submit">Save Student</button>
        </div>
      </form>
    `;

    d.showModal();

    $('#ff').onsubmit = e => {
      e.preventDefault();

      const v = {};

      [...$('#ff').elements]
        .filter(i => i.name)
        .forEach(i => {
          v[i.name] = i.value;
        });

      d.close();

      run([{
        action: x._r ? 'update' : 'add',
        sheet: n,
        row: x._r,
        values: v
      }]);
    };

    return;
  }

  // Normal forms for other sheets
  d.innerHTML = `<form id="ff">
    <h3>${x._r ? 'Edit' : 'Add'} · ${n}</h3>
    <div class="g">` +
    t.headers
      .filter((k, i) => t.edit[i])
      .map(k => {
        const o = options(n, k);
        const v = x[k] ?? '';
        const type =
          /Date|Month/.test(k) ? 'date' :
          /Amount|Salary|Allow|Deductions|\(0-100\)/.test(k) ? 'number' :
          'text';

        return `<label>${esc(k)}
          ${
            o
              ? `<select name="${esc(k)}">
                  <option></option>
                  ${o.map(z =>
                    `<option ${z == v ? 'selected' : ''}>${esc(z)}</option>`
                  ).join('')}
                </select>`
              : `<input name="${esc(k)}" type="${type}" value="${esc(v)}">`
          }
        </label>`;
      }).join('') +
    `</div>
    <div class="ac">
      <button type="button" onclick="dlg.close()">Cancel</button>
      <button class="pri">Save</button>
    </div>
  </form>`;

  d.showModal();

  $('#ff').onsubmit = e => {
    e.preventDefault();

    const v = {};

    [...$('#ff').elements]
      .filter(i => i.name)
      .forEach(i => {
        v[i.name] =
          i.type === 'number' && i.value !== ''
            ? +i.value
            : i.value;
      });
      // Always use SCH001
      v['SCHOOL'] = 'SCH001';
    d.close();

    run([{
      action: x._r ? 'update' : 'add',
      sheet: n,
      row: x._r,
      values: v
    }]);
  };
}

function saveAtt() {
  const ops = klass().map(s => {
    const v = $(`input[name="m_${sid(s)}"]:checked`).value, ex = rows('Attendance').find(x => x.Date == S.date && x['Student ID'] == sid(s));
    return ex ? {action: 'update', sheet: 'Attendance', row: ex._r, values: {'Status (P/A/L)': v}} : {action: 'add', sheet: 'Attendance', values: {Date: S.date, 'Student ID': sid(s), 'Status (P/A/L)': v}};
  });
  ops.length ? run(ops) : toast('No students in this class');
}
function saveGr() {
  const ops = [];
  klass().forEach(s => {
    const id = sid(s), cw = $(`[data-id="${id}"][data-f=cw]`).value, ex = $(`[data-id="${id}"][data-f=ex]`).value;
    if (cw === '' && ex === '') return;
    const e = rows('Grades').find(x => x['Student ID'] == id && x.Subject == S.subject && x.Term == S.term), v = {'Class Work (0-100)': cw === '' ? '' : +cw, 'Exam (0-100)': ex === '' ? '' : +ex};
    ops.push(e ? {action: 'update', sheet: 'Grades', row: e._r, values: v} : {action: 'add', sheet: 'Grades', values: {'Student ID': id, Subject: S.subject, Term: S.term, ...v}});
  });
  ops.length ? run(ops) : toast('Enter at least one score');
}

/* ---------- shell ---------- */
function render() {
  if (!D || !D.sheets) return;

  $('#nav').innerHTML = TABS.map(([g, l]) =>
    `<h4>${g}</h4>` +
    l.map(([n, i]) =>
      `<a href="#${n}" class="${n == cur ? 'on' : ''}">${i} ${n}</a>`
    ).join('')
  ).join('');

  const T = TABS.flatMap(g => g[1])
    .find(t => t[0] == cur) || ['', '', 'dash'];

  $('#title').textContent = cur;

  $('#q').style.display =
    ['tbl', 'ro'].includes(T[2] || 'tbl') ? '' : 'none';

  $('#mode').textContent =
    demo
      ? '● Demo mode: sample data, not connected'
      : '● Connected to Google Sheet';

  $('#view').innerHTML = V[T[2] || 'tbl']();
}
function route() { cur = decodeURIComponent(location.hash.slice(1)) || 'Dashboard'; $('#q').value = ''; $('#side').classList.remove('open'); if (D) render(); }
$('#view').addEventListener('change', e => { const k = e.target.dataset.k; if (k) { S[k] = e.target.value; render(); } });
$('#view').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, r = rows(cur).find(x => x._r == b.dataset.r);
  if (a == 'add') form(cur); else if (a == 'edit') form(cur, r);
  else if (a == 'del') { if (confirm('Clear this record? The row is blanked in the sheet.')) run([{action: 'delete', sheet: cur, row: r._r}]); }
  else if (a == 'sort') { const k = b.dataset.k; sort = {n: cur, k, d: sort && sort.k == k ? -sort.d : 1}; render(); }
});
$('#q').oninput = render;
$('#burger').onclick = () => $('#side').classList.toggle('open');
$('#refresh').onclick = () => load().then(() => { render(); toast('Reloaded'); }).catch(e => toast('Error: ' + e));
window.addEventListener('hashchange', route);
$('#lf').onsubmit = e => {
  e.preventDefault();

  KEY = $('#key').value.trim();

  if (!KEY) {
    $('#lerr').textContent = 'Please enter your access key.';
    return;
  }

  localStorage.sm_key = KEY;
  $('#lerr').textContent = 'Signing in...';

  boot();
};

async function boot() {
  if (!demo && !KEY) {
    $('#login').classList.remove('hidden');
    return;
  }

  try {
    await load();
  } catch (e) {
    localStorage.removeItem('sm_key');
    KEY = '';
    $('#lerr').textContent = String(e);
    $('#login').classList.remove('hidden');
    return;
  }

  $('#login').classList.add('hidden');

  S = {
    school: (schools()[0] || {}).v,
    class: D.meta.classes[0],
    term: D.meta.terms[0],
    subject: D.meta.subjects[0],
    student: (studs()[0] && sid(studs()[0])),
    date: new Date().toISOString().slice(0, 10),
    ...S
  };

  route();
  render();
}

boot()