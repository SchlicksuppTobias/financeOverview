// ── STATE ──
let state = {
    period: 'month',
    income: [],
    costs: [],
    savingsRate: 20,
    wealth: { current: 0, returnPct: 5 },
    goals: [],
    nextId: 100,
};

// ── PERSISTENCE ──
function save() {
    try { localStorage.setItem('finanz_v1', JSON.stringify(state)); } catch(e) {}
}
function load() {
    try {
        const s = localStorage.getItem('finanz_v1');
        if (s) state = JSON.parse(s);
    } catch(e) {}
}

// ── FORMATTERS ──
const fmt = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';
const fmtK = (n) => {
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2).replace('.',',') + ' Mio. €';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1).replace('.',',') + 'k €';
    return fmt(n);
};

// ── PERIOD ──
function setPeriod(p, btn) {
    state.period = p;
    document.querySelectorAll('.period-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
    save();
}

function periodFactor() { return state.period === 'year' ? 12 : 1; }

// ── RENDER ITEMS ──
function renderList(type) {
    const list = document.getElementById(type + '-list');
    const items = state[type];
    list.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'line-item';
        div.innerHTML = `
      <input class="line-name" value="${item.name}" onchange="updateItem('${type}',${item.id},'name',this.value)" title="Name bearbeiten">
      <input class="line-amount" type="number" value="${item.amount}" onchange="updateItem('${type}',${item.id},'amount',+this.value)" title="Betrag (Monat)">
      <button class="line-del" onclick="delItem('${type}',${item.id})" title="Löschen">×</button>
    `;
        list.appendChild(div);
    });
}

function addItem(type) {
    state[type].push({ id: state.nextId++, name: 'Neue Position', amount: 0 });
    render(); save();
    setTimeout(() => {
        const inputs = document.querySelectorAll(`#${type}-list .line-name`);
        if (inputs.length) inputs[inputs.length-1].select();
    }, 50);
}

function delItem(type, id) {
    state[type] = state[type].filter(i => i.id !== id);
    render(); save();
}

function updateItem(type, id, field, val) {
    const item = state[type].find(i => i.id === id);
    if (item) item[field] = val;
    recalc(); save();
}

// ── GOALS ──
function renderGoals() {
    const list = document.getElementById('goals-list');
    list.innerHTML = '';
    const wCurrent = parseFloat(document.getElementById('w-current').value) || 0;
    const monthlySave = calcMonthlySave();

    state.goals.forEach(g => {
        const pct = Math.min(100, wCurrent / g.target * 100);
        const remaining = Math.max(0, g.target - wCurrent);
        const monthsLeft = monthlySave > 0 ? remaining / monthlySave : Infinity;
        const yearsLeft = monthsLeft / 12;
        const onTrack = yearsLeft < 15 || pct >= 80;

        const div = document.createElement('div');
        div.innerHTML = `
      <div class="goal-row">
        <input class="goal-name-input" value="${g.name}" onchange="updateGoal(${g.id},'name',this.value)">
        <input class="goal-target-input" type="number" value="${g.target}" onchange="updateGoal(${g.id},'target',+this.value)">
        <button class="line-del" onclick="delGoal(${g.id})">×</button>
      </div>
      <div class="goal-bar-area" style="margin-top:0.5rem">
        <div class="bar-wrap"><div class="bar-fill${pct > 85 ? '' : pct > 60 ? ' warn' : ''}" style="width:${pct}%"></div></div>
        <div class="goal-meta">
          <span class="chip ${onTrack ? 'on-track' : 'behind'}">${onTrack ? '↑ Im Plan' : '↓ Hinterher'}</span>
          <span class="goal-pct">${pct.toFixed(1)}% · Noch ${fmtK(remaining)}</span>
        </div>
        <div class="goal-meta" style="margin-top:0.2rem">
          <span style="color:var(--muted);font-size:0.68rem">Ziel: ${fmt(g.target)}</span>
          <span style="color:var(--muted);font-size:0.68rem">${isFinite(yearsLeft) ? yearsLeft.toFixed(1) + ' J bis Ziel' : '—'}</span>
        </div>
      </div>
    `;
        div.style.marginBottom = '1rem';
        div.style.paddingBottom = '1rem';
        div.style.borderBottom = '1px solid var(--border)';
        list.appendChild(div);
    });
    if (list.lastChild) list.lastChild.style.borderBottom = 'none';
}

function addGoal() {
    state.goals.push({ id: state.nextId++, name: 'Neues Ziel', target: 50000 });
    render(); save();
}
function delGoal(id) { state.goals = state.goals.filter(g => g.id !== id); render(); save(); }
function updateGoal(id, field, val) {
    const g = state.goals.find(g => g.id === id);
    if (g) g[field] = val;
    recalc(); save();
}

// ── CALCULATE ──
function sumItems(arr) { return arr.reduce((s,i) => s + (parseFloat(i.amount)||0), 0); }

function calcMonthlySave() {
    const totalIncome = sumItems(state.income);
    return totalIncome * state.savingsRate / 100;
}

function futureWealth(current, monthlyAdd, rateAnnual, years) {
    const r = rateAnnual / 100 / 12;
    let w = current;
    for (let m = 0; m < years*12; m++) {
        w = w * (1 + r) + monthlyAdd;
    }
    return w;
}

function onRateChange(v) {
    state.savingsRate = +v;
    recalc(); save();
}

function recalc() {
    const pf = periodFactor();
    const totalIncome = sumItems(state.income);
    const totalCosts = sumItems(state.costs);
    const monthlySave = calcMonthlySave();
    const free = totalIncome - totalCosts - monthlySave;
    const costsPct = totalIncome > 0 ? totalCosts / totalIncome * 100 : 0;

    state.wealth.current = parseFloat(document.getElementById('w-current').value) || 0;
    state.wealth.returnPct = parseFloat(document.getElementById('w-return').value) || 0;
    const wCur = state.wealth.current;
    const wRet = state.wealth.returnPct;

    // ── Summary strip ──
    document.getElementById('s-income').textContent = fmt(totalIncome * pf);
    document.getElementById('s-income-sub').textContent = pf === 1 ? 'pro Monat' : 'pro Jahr';
    document.getElementById('s-costs').textContent = fmt(totalCosts * pf);
    document.getElementById('s-costs-pct').textContent = costsPct.toFixed(0) + '% des Einkommens';
    document.getElementById('s-savings-pct').textContent = state.savingsRate + '%';
    document.getElementById('s-savings-abs').textContent = fmt(monthlySave * pf) + ' gespart';
    document.getElementById('s-wealth').textContent = fmtK(wCur);
    document.getElementById('s-wealth-sub').textContent = 'Aktuell erfasst';

    // ── Free banner ──
    const freeEl = document.getElementById('free-amount');
    freeEl.textContent = fmt(free * pf);
    freeEl.className = 'amount ' + (free >= 0 ? 'positive' : 'negative');
    document.getElementById('fb-income').textContent = fmt(totalIncome * pf);
    document.getElementById('fb-costs').textContent = fmt(totalCosts * pf);
    document.getElementById('fb-save').textContent = fmt(monthlySave * pf);

    // ── Totals ──
    document.getElementById('income-total').textContent = fmt(totalIncome * pf);
    document.getElementById('costs-total').textContent = fmt(totalCosts * pf);

    // ── Savings section ──
    const rateVal = state.savingsRate;
    document.getElementById('savings-rate').value = rateVal;
    document.getElementById('rate-label').textContent = rateVal + '%';
    document.getElementById('savings-bar').style.width = rateVal + '%';
    const cPct = Math.min(100, costsPct);
    document.getElementById('costs-bar').style.width = cPct + '%';
    const cBar = document.getElementById('costs-bar');
    cBar.className = 'bar-fill' + (cPct > 75 ? ' danger' : cPct > 55 ? ' warn' : '');
    document.getElementById('costs-pct-label').textContent = costsPct.toFixed(0) + '%';

    document.getElementById('st-monthly').textContent = fmt(monthlySave);
    document.getElementById('st-yearly').textContent = fmt(monthlySave * 12);
    document.getElementById('st-5y').textContent = fmt(monthlySave * 12 * 5);
    document.getElementById('st-10y').textContent = fmt(monthlySave * 12 * 10);

    // ── Wealth prognosis ──
    document.getElementById('wp-1y').textContent = fmtK(futureWealth(wCur, monthlySave, wRet, 1));
    document.getElementById('wp-5y').textContent = fmtK(futureWealth(wCur, monthlySave, wRet, 5));
    document.getElementById('wp-10y').textContent = fmtK(futureWealth(wCur, monthlySave, wRet, 10));
    document.getElementById('wp-20y').textContent = fmtK(futureWealth(wCur, monthlySave, wRet, 20));

    // ── Goals ──
    renderGoals();
}

function render() {
    renderList('income');
    renderList('costs');
    recalc();
}

// ── INIT ──
load();
document.getElementById('w-current').value = state.wealth.current || '';
document.getElementById('w-return').value = state.wealth.returnPct || 5;
document.getElementById('savings-rate').value = state.savingsRate;

const now = new Date();
document.getElementById('date-label').textContent =
    now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

render();
