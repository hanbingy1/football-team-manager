// ========== 数据存储（后端API + 内存缓存） ==========
let dataCache = { players: [], matches: [] };
let currentUser = null;
const isAdmin = () => currentUser && currentUser.role === 'admin';

function loadPlayers() {
  return JSON.parse(JSON.stringify(dataCache.players));
}
function savePlayers(players) {
  dataCache.players = players;
  fetch('/api/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(players),
  }).catch(err => console.error('保存球员数据失败', err));
}
function loadMatches() {
  return JSON.parse(JSON.stringify(dataCache.matches));
}
function saveMatches(matches) {
  dataCache.matches = matches;
  fetch('/api/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(matches),
  }).catch(err => console.error('保存比赛数据失败', err));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function getPlayerById(id) {
  return loadPlayers().find(p => p.id === id);
}
function removePlayerFromMatches(pid) {
  const matches = loadMatches();
  matches.forEach(m => {
    m.roster = (m.roster || []).filter(id => id !== pid);
    m.starters = (m.starters || []).filter(id => id !== pid);
    m.substitutes = (m.substitutes || []).filter(id => id !== pid);
    if (m.stats) delete m.stats[pid];
    if (m.mvp === pid) m.mvp = null;
    ['A', 'B'].forEach(key => {
      const lu = m.lineups && m.lineups[key];
      if (lu) {
        lu.players = (lu.players || []).filter(id => id !== pid);
        Object.keys(lu.assignments || {}).forEach(posId => {
          if (lu.assignments[posId] === pid) delete lu.assignments[posId];
        });
      }
    });
  });
  saveMatches(matches);
}

function getPlayerName(id) {
  const p = getPlayerById(id);
  return p ? `${p.name}${p.number != null && p.number !== '' ? '(' + p.number + ')' : ''}` : '未知球员';
}

// ========== 阵型定义 ==========
// 每种赛制下，可选阵型 -> 场上位置数组（含门将），坐标 x,y 为百分比，y=0 对方球门，y=100 己方球门
const FORMATIONS = {
  5: {
    '1-2-1': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 50, y: 70 },
      { id: 'mf1', label: '中场', x: 25, y: 46 },
      { id: 'mf2', label: '中场', x: 75, y: 46 },
      { id: 'fw1', label: '前锋', x: 50, y: 18 },
    ],
    '2-1-1': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 30, y: 70 },
      { id: 'df2', label: '后卫', x: 70, y: 70 },
      { id: 'mf1', label: '中场', x: 50, y: 46 },
      { id: 'fw1', label: '前锋', x: 50, y: 18 },
    ],
    '1-1-2': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 50, y: 70 },
      { id: 'mf1', label: '中场', x: 50, y: 46 },
      { id: 'fw1', label: '前锋', x: 30, y: 18 },
      { id: 'fw2', label: '前锋', x: 70, y: 18 },
    ],
  },
  7: {
    '2-3-1': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 30, y: 72 },
      { id: 'df2', label: '后卫', x: 70, y: 72 },
      { id: 'mf1', label: '中场', x: 20, y: 46 },
      { id: 'mf2', label: '中场', x: 50, y: 46 },
      { id: 'mf3', label: '中场', x: 80, y: 46 },
      { id: 'fw1', label: '前锋', x: 50, y: 18 },
    ],
    '3-2-1': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 20, y: 72 },
      { id: 'df2', label: '后卫', x: 50, y: 72 },
      { id: 'df3', label: '后卫', x: 80, y: 72 },
      { id: 'mf1', label: '中场', x: 35, y: 46 },
      { id: 'mf2', label: '中场', x: 65, y: 46 },
      { id: 'fw1', label: '前锋', x: 50, y: 18 },
    ],
    '2-2-2': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 30, y: 72 },
      { id: 'df2', label: '后卫', x: 70, y: 72 },
      { id: 'mf1', label: '中场', x: 30, y: 46 },
      { id: 'mf2', label: '中场', x: 70, y: 46 },
      { id: 'fw1', label: '前锋', x: 30, y: 18 },
      { id: 'fw2', label: '前锋', x: 70, y: 18 },
    ],
    '3-1-2': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 20, y: 72 },
      { id: 'df2', label: '后卫', x: 50, y: 72 },
      { id: 'df3', label: '后卫', x: 80, y: 72 },
      { id: 'mf1', label: '中场', x: 50, y: 50 },
      { id: 'fw1', label: '前锋', x: 30, y: 20 },
      { id: 'fw2', label: '前锋', x: 70, y: 20 },
    ],
  },
  8: {
    '3-3-1': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 20, y: 72 },
      { id: 'df2', label: '后卫', x: 50, y: 72 },
      { id: 'df3', label: '后卫', x: 80, y: 72 },
      { id: 'mf1', label: '中场', x: 20, y: 46 },
      { id: 'mf2', label: '中场', x: 50, y: 46 },
      { id: 'mf3', label: '中场', x: 80, y: 46 },
      { id: 'fw1', label: '前锋', x: 50, y: 18 },
    ],
    '3-2-2': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 20, y: 74 },
      { id: 'df2', label: '后卫', x: 50, y: 74 },
      { id: 'df3', label: '后卫', x: 80, y: 74 },
      { id: 'mf1', label: '中场', x: 35, y: 50 },
      { id: 'mf2', label: '中场', x: 65, y: 50 },
      { id: 'fw1', label: '前锋', x: 30, y: 20 },
      { id: 'fw2', label: '前锋', x: 70, y: 20 },
    ],
    '2-3-2': [
      { id: 'gk', label: '门将', x: 50, y: 92 },
      { id: 'df1', label: '后卫', x: 30, y: 74 },
      { id: 'df2', label: '后卫', x: 70, y: 74 },
      { id: 'mf1', label: '中场', x: 20, y: 48 },
      { id: 'mf2', label: '中场', x: 50, y: 48 },
      { id: 'mf3', label: '中场', x: 80, y: 48 },
      { id: 'fw1', label: '前锋', x: 30, y: 18 },
      { id: 'fw2', label: '前锋', x: 70, y: 18 },
    ],
  },
  11: {
    '4-4-2': [
      { id: 'gk', label: '门将', x: 50, y: 94 },
      { id: 'df1', label: '后卫', x: 15, y: 76 },
      { id: 'df2', label: '后卫', x: 38, y: 76 },
      { id: 'df3', label: '后卫', x: 62, y: 76 },
      { id: 'df4', label: '后卫', x: 85, y: 76 },
      { id: 'mf1', label: '中场', x: 15, y: 50 },
      { id: 'mf2', label: '中场', x: 38, y: 50 },
      { id: 'mf3', label: '中场', x: 62, y: 50 },
      { id: 'mf4', label: '中场', x: 85, y: 50 },
      { id: 'fw1', label: '前锋', x: 35, y: 18 },
      { id: 'fw2', label: '前锋', x: 65, y: 18 },
    ],
    '4-3-3': [
      { id: 'gk', label: '门将', x: 50, y: 94 },
      { id: 'df1', label: '后卫', x: 15, y: 76 },
      { id: 'df2', label: '后卫', x: 38, y: 76 },
      { id: 'df3', label: '后卫', x: 62, y: 76 },
      { id: 'df4', label: '后卫', x: 85, y: 76 },
      { id: 'mf1', label: '中场', x: 25, y: 50 },
      { id: 'mf2', label: '中场', x: 50, y: 50 },
      { id: 'mf3', label: '中场', x: 75, y: 50 },
      { id: 'fw1', label: '前锋', x: 15, y: 18 },
      { id: 'fw2', label: '前锋', x: 50, y: 18 },
      { id: 'fw3', label: '前锋', x: 85, y: 18 },
    ],
    '3-5-2': [
      { id: 'gk', label: '门将', x: 50, y: 94 },
      { id: 'df1', label: '后卫', x: 20, y: 76 },
      { id: 'df2', label: '后卫', x: 50, y: 76 },
      { id: 'df3', label: '后卫', x: 80, y: 76 },
      { id: 'mf1', label: '中场', x: 10, y: 50 },
      { id: 'mf2', label: '中场', x: 30, y: 50 },
      { id: 'mf3', label: '中场', x: 50, y: 50 },
      { id: 'mf4', label: '中场', x: 70, y: 50 },
      { id: 'mf5', label: '中场', x: 90, y: 50 },
      { id: 'fw1', label: '前锋', x: 35, y: 18 },
      { id: 'fw2', label: '前锋', x: 65, y: 18 },
    ],
    '4-5-1': [
      { id: 'gk', label: '门将', x: 50, y: 94 },
      { id: 'df1', label: '后卫', x: 15, y: 76 },
      { id: 'df2', label: '后卫', x: 38, y: 76 },
      { id: 'df3', label: '后卫', x: 62, y: 76 },
      { id: 'df4', label: '后卫', x: 85, y: 76 },
      { id: 'mf1', label: '中场', x: 10, y: 50 },
      { id: 'mf2', label: '中场', x: 30, y: 50 },
      { id: 'mf3', label: '中场', x: 50, y: 50 },
      { id: 'mf4', label: '中场', x: 70, y: 50 },
      { id: 'mf5', label: '中场', x: 90, y: 50 },
      { id: 'fw1', label: '前锋', x: 50, y: 18 },
    ],
    '3-4-3': [
      { id: 'gk', label: '门将', x: 50, y: 94 },
      { id: 'df1', label: '后卫', x: 20, y: 76 },
      { id: 'df2', label: '后卫', x: 50, y: 76 },
      { id: 'df3', label: '后卫', x: 80, y: 76 },
      { id: 'mf1', label: '中场', x: 15, y: 50 },
      { id: 'mf2', label: '中场', x: 38, y: 50 },
      { id: 'mf3', label: '中场', x: 62, y: 50 },
      { id: 'mf4', label: '中场', x: 85, y: 50 },
      { id: 'fw1', label: '前锋', x: 15, y: 18 },
      { id: 'fw2', label: '前锋', x: 50, y: 18 },
      { id: 'fw3', label: '前锋', x: 85, y: 18 },
    ],
  },
};

// 根据赛制人数获取可选阵型；若没有预设阵型，则自动生成一个通用阵型
function getFormationsForSize(size) {
  if (FORMATIONS[size]) return FORMATIONS[size];
  return { '自定义': generateGenericFormation(size) };
}

function generateGenericFormation(size) {
  const positions = [{ id: 'gk', label: '门将', x: 50, y: 94 }];
  const outfield = size - 1;
  if (outfield <= 0) return positions;

  const numLines = Math.min(3, outfield);
  const counts = new Array(numLines).fill(Math.floor(outfield / numLines));
  let remainder = outfield % numLines;
  for (let i = 0; i < numLines && remainder > 0; i++, remainder--) counts[i]++;

  let lineY, lineLabels;
  if (numLines === 1) { lineY = [50]; lineLabels = ['球员']; }
  else if (numLines === 2) { lineY = [70, 30]; lineLabels = ['后卫', '前锋']; }
  else { lineY = [75, 50, 18]; lineLabels = ['后卫', '中场', '前锋']; }

  const prefixes = ['df', 'mf', 'fw'];
  counts.forEach((count, lineIdx) => {
    for (let i = 0; i < count; i++) {
      positions.push({
        id: `${prefixes[lineIdx]}${i + 1}`,
        label: lineLabels[lineIdx],
        x: ((i + 1) / (count + 1)) * 100,
        y: lineY[lineIdx],
      });
    }
  });
  return positions;
}

// ========== 全局状态 ==========
let state = {
  view: 'players',
  editingPlayerId: null,
  editingMatchId: null,
  currentMatchId: null,
  currentLineup: 'A',
  mvpVoteDraft: null,
  mvpVoteDraft: null,
};

// ========== 视图切换 ==========
function switchView(view) {
  state.view = view;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  render();
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (state.view === 'players') renderPlayersView(app);
  else if (state.view === 'matches') renderMatchesView(app);
  else if (state.view === 'match-detail') renderMatchDetailView(app);
  else if (state.view === 'calendar') renderCalendarView(app);
  else if (state.view === 'stats') renderStatsView(app);
  else if (state.view === 'members') renderMembersView(app);
}

// ========== 球员名单 ==========
function renderPlayersView(app) {
  const players = loadPlayers();

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn primary';
  addBtn.textContent = '+ 添加球员';
  addBtn.onclick = () => openPlayerModal();
  if (isAdmin()) toolbar.appendChild(addBtn);
  const countSpan = document.createElement('span');
  countSpan.textContent = `共 ${players.length} 名球员`;
  toolbar.appendChild(countSpan);
  app.appendChild(toolbar);

  if (players.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '暂无球员，点击上方按钮添加';
    app.appendChild(tip);
    return;
  }

  const table = document.createElement('table');
  table.innerHTML = `
    <thead><tr><th>号码</th><th>姓名</th><th>位置</th><th>备注</th>${isAdmin() ? '<th>操作</th>' : ''}</tr></thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  players
    .slice()
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
    .forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.number ?? ''}</td>
        <td>${p.name}</td>
        <td>${p.position}</td>
        <td>${p.note || ''}</td>
        <td>
          <button class="btn small" data-edit="${p.id}">编辑</button>
          <button class="btn small danger" data-del="${p.id}">删除</button>
        </td>
      `;
      if (!isAdmin()) tr.lastElementChild.remove();
      tbody.appendChild(tr);
    });
  app.appendChild(table);

  table.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => openPlayerModal(btn.dataset.edit);
  });
  table.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('确认删除该球员吗？')) return;
      const pid = btn.dataset.del;
      const list = loadPlayers().filter(p => p.id !== pid);
      savePlayers(list);
      removePlayerFromMatches(pid);
      render();
    };
  });
}

function openPlayerModal(playerId) {
  state.editingPlayerId = playerId || null;
  const modal = document.getElementById('player-modal');
  const title = document.getElementById('player-modal-title');
  const nameInput = document.getElementById('pf-name');
  const numberInput = document.getElementById('pf-number');
  const positionInput = document.getElementById('pf-position');
  const noteInput = document.getElementById('pf-note');

  if (playerId) {
    const p = getPlayerById(playerId);
    title.textContent = '编辑球员';
    nameInput.value = p.name;
    numberInput.value = p.number ?? '';
    positionInput.value = p.position;
    noteInput.value = p.note || '';
  } else {
    title.textContent = '添加球员';
    nameInput.value = '';
    numberInput.value = '';
    positionInput.value = '后卫';
    noteInput.value = '';
  }
  modal.classList.remove('hidden');
}

function closePlayerModal() {
  document.getElementById('player-modal').classList.add('hidden');
}

function savePlayerFromModal() {
  const name = document.getElementById('pf-name').value.trim();
  if (!name) { alert('请输入姓名'); return; }
  const numberVal = document.getElementById('pf-number').value;
  const position = document.getElementById('pf-position').value;
  const note = document.getElementById('pf-note').value.trim();

  const players = loadPlayers();
  if (state.editingPlayerId) {
    const p = players.find(pl => pl.id === state.editingPlayerId);
    p.name = name;
    p.number = numberVal === '' ? null : Number(numberVal);
    p.position = position;
    p.note = note;
  } else {
    players.push({
      id: uid(),
      name,
      number: numberVal === '' ? null : Number(numberVal),
      position,
      note,
    });
  }
  savePlayers(players);
  closePlayerModal();
  render();
}

// ========== 赛程管理 ==========
function renderMatchesView(app) {
  const matches = loadMatches().slice().sort((a, b) => b.date.localeCompare(a.date));

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn primary';
  addBtn.textContent = '+ 新建比赛';
  addBtn.onclick = () => openMatchModal();
  if (isAdmin()) toolbar.appendChild(addBtn);
  app.appendChild(toolbar);

  if (matches.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '暂无比赛，点击上方按钮新建';
    app.appendChild(tip);
    return;
  }

  matches.forEach(m => {
    const card = document.createElement('div');
    card.className = 'match-card';
    const starterCount = (m.starters || []).length;
    const rosterCount = (m.roster || []).length;
    const scoreText = (m.scoreUs != null && m.scoreThem != null) ? ` ${m.scoreUs} : ${m.scoreThem}` : '';
    card.innerHTML = `
      <div>
        <div><strong>${m.date}</strong> ${m.opponent ? 'vs ' + m.opponent : ''}${scoreText}</div>
        <div class="meta">${m.formationSize}人制 · 参赛 ${rosterCount} 人 · 首发 ${starterCount} 人</div>
      </div>
      <div>
        <button class="btn small" data-open="${m.id}">查看</button>
        <button class="btn small" data-edit="${m.id}">编辑</button>
        <button class="btn small danger" data-del="${m.id}">删除</button>
      </div>
    `;
    app.appendChild(card);

    card.querySelector('[data-open]').onclick = (e) => {
      e.stopPropagation();
      openMatchDetail(m.id);
    };
    card.querySelector('[data-edit]').onclick = (e) => {
      e.stopPropagation();
      openMatchModal(m.id);
    };
    card.querySelector('[data-del]').onclick = (e) => {
      e.stopPropagation();
      if (!confirm('确认删除该比赛及其所有数据吗？')) return;
      saveMatches(loadMatches().filter(mm => mm.id !== m.id));
      render();
    };
    card.onclick = () => openMatchDetail(m.id);
  });
}

function openMatchModal(matchId) {
  state.editingMatchId = matchId || null;
  const modal = document.getElementById('match-modal');
  const title = document.getElementById('match-modal-title');
  const dateInput = document.getElementById('mf-date');
  const opponentInput = document.getElementById('mf-opponent');
  const sizeInput = document.getElementById('mf-size');

  const scoreUsInput = document.getElementById('mf-score-us');
  const scoreThemInput = document.getElementById('mf-score-them');

  if (matchId) {
    const m = loadMatches().find(mm => mm.id === matchId);
    title.textContent = '编辑比赛';
    dateInput.value = m.date;
    opponentInput.value = m.opponent || '';
    sizeInput.value = String(m.formationSize);
    scoreUsInput.value = m.scoreUs ?? '';
    scoreThemInput.value = m.scoreThem ?? '';
  } else {
    title.textContent = '新建比赛';
    dateInput.value = '';
    opponentInput.value = '';
    sizeInput.value = '11';
    scoreUsInput.value = '';
    scoreThemInput.value = '';
  }
  modal.classList.remove('hidden');
}

function closeMatchModal() {
  document.getElementById('match-modal').classList.add('hidden');
}

function saveMatchFromModal() {
  const date = document.getElementById('mf-date').value;
  if (!date) { alert('请选择比赛日期'); return; }
  const opponent = document.getElementById('mf-opponent').value.trim();
  const formationSize = Number(document.getElementById('mf-size').value);
  if (!Number.isInteger(formationSize) || formationSize < 1) { alert('请输入正确的赛制人数'); return; }
  const scoreUsRaw = document.getElementById('mf-score-us').value;
  const scoreThemRaw = document.getElementById('mf-score-them').value;
  const scoreUs = scoreUsRaw === '' ? null : Math.max(0, parseInt(scoreUsRaw, 10) || 0);
  const scoreThem = scoreThemRaw === '' ? null : Math.max(0, parseInt(scoreThemRaw, 10) || 0);

  const matches = loadMatches();
  if (state.editingMatchId) {
    const m = matches.find(mm => mm.id === state.editingMatchId);
    const sizeChanged = m.formationSize !== formationSize;
    m.date = date;
    m.opponent = opponent;
    m.formationSize = formationSize;
    m.scoreUs = scoreUs;
    m.scoreThem = scoreThem;
    if (sizeChanged) {
      // 赛制变化，首发/替补/阵型不再适用，重置
      m.starters = [];
      m.substitutes = (m.roster || []).slice();
      m.lineups = { A: null, B: null };
    }
  } else {
    matches.push({
      id: uid(),
      date,
      opponent,
      formationSize,
      scoreUs,
      scoreThem,
      roster: [],
      starters: [],
      substitutes: [],
      lineups: { A: null, B: null },
      stats: {},
      mvp: null,
    });
  }
  saveMatches(matches);
  closeMatchModal();
  render();
}

function openMatchDetail(matchId) {
  state.currentMatchId = matchId;
  state.currentLineup = 'A';
  document.querySelector('[data-view="match-detail"]').style.display = '';
  switchView('match-detail');
}

// ========== 比赛详情 ==========
function getCurrentMatch() {
  return loadMatches().find(m => m.id === state.currentMatchId);
}
function updateCurrentMatch(mutator) {
  const matches = loadMatches();
  const m = matches.find(mm => mm.id === state.currentMatchId);
  mutator(m);
  saveMatches(matches);
}

function renderMatchDetailView(app) {
  const match = getCurrentMatch();
  if (!match) {
    document.querySelector('[data-view="match-detail"]').style.display = 'none';
    switchView('matches');
    return;
  }
  const players = loadPlayers();

  // 基本信息
  const info = document.createElement('div');
  info.className = 'section';
  const scoreText = (match.scoreUs != null && match.scoreThem != null) ? `　比分 ${match.scoreUs} : ${match.scoreThem}` : '';
  info.innerHTML = `
    <h3>${match.date} ${match.opponent ? 'vs ' + match.opponent : ''}（${match.formationSize}人制）${scoreText}</h3>
    <button class="btn small" id="back-to-list">← 返回赛程列表</button>
  `;
  app.appendChild(info);
  info.querySelector('#back-to-list').onclick = () => {
    document.querySelector('[data-view="match-detail"]').style.display = 'none';
    switchView('matches');
  };

  renderRosterSection(app, match, players);
  renderLineupSection(app, match, players);
  renderStatsSection(app, match, players);
}

// ---- 参赛名单 + 抽签 ----
function renderRosterSection(app, match, players) {
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `<h3>参赛名单</h3>`;

  if (players.length === 0) {
    sec.innerHTML += `<div class="empty-tip">请先在"球员名单"中添加球员</div>`;
    app.appendChild(sec);
    return;
  }

  const allSelected = players.length > 0 && players.every(p => (match.roster || []).includes(p.id));
  const selectAllBtn = document.createElement('button');
  selectAllBtn.className = 'btn small';
  selectAllBtn.style.marginBottom = '8px';
  selectAllBtn.textContent = allSelected ? '取消全选' : '一键全选';
  selectAllBtn.onclick = () => {
    updateCurrentMatch(m => {
      m.roster = allSelected ? [] : players.map(p => p.id);
      if (allSelected) {
        m.starters = [];
        m.substitutes = [];
        m.lineups = { A: null, B: null };
      } else {
        m.substitutes = players.map(p => p.id).filter(id => !(m.starters || []).includes(id));
      }
    });
    render();
  };
  sec.appendChild(selectAllBtn);

  const list = document.createElement('div');
  list.className = 'checkbox-list';
  players
    .slice()
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
    .forEach(p => {
      const checked = (match.roster || []).includes(p.id);
      const label = document.createElement('label');
      label.className = checked ? 'checked' : '';
      label.innerHTML = `<input type="checkbox" value="${p.id}" ${checked ? 'checked' : ''}> ${p.name}${p.number != null ? '(' + p.number + ')' : ''}`;
      list.appendChild(label);
      label.querySelector('input').onchange = (e) => {
        updateCurrentMatch(m => {
          m.roster = m.roster || [];
          if (e.target.checked) {
            if (!m.roster.includes(p.id)) m.roster.push(p.id);
          } else {
            m.roster = m.roster.filter(id => id !== p.id);
            m.starters = (m.starters || []).filter(id => id !== p.id);
            m.substitutes = (m.substitutes || []).filter(id => id !== p.id);
            // 同时从阵型中移除
            ['A', 'B'].forEach(key => {
              const lu = m.lineups && m.lineups[key];
              if (lu) {
                lu.players = (lu.players || []).filter(id => id !== p.id);
                Object.keys(lu.assignments || {}).forEach(posId => {
                  if (lu.assignments[posId] === p.id) delete lu.assignments[posId];
                });
              }
            });
          }
        });
        render();
      };
    });
  sec.appendChild(list);

  // 抽签
  const lotteryBox = document.createElement('div');
  lotteryBox.style.marginTop = '12px';
  const rosterCount = (match.roster || []).length;
  const lotteryBtn = document.createElement('button');
  lotteryBtn.className = 'btn primary';
  lotteryBtn.textContent = '🎲 随机抽取首发/替补';
  lotteryBtn.disabled = rosterCount < match.formationSize;
  lotteryBtn.title = rosterCount < match.formationSize
    ? `参赛人数需不少于 ${match.formationSize} 人`
    : '';
  lotteryBtn.onclick = () => {
    updateCurrentMatch(m => {
      const shuffled = m.roster.slice().sort(() => Math.random() - 0.5);
      m.starters = shuffled.slice(0, m.formationSize);
      m.substitutes = shuffled.slice(m.formationSize);
    });
    render();
  };
  lotteryBox.appendChild(lotteryBtn);
  sec.appendChild(lotteryBox);

  // 首发 / 替补 显示与手动调整
  if ((match.starters || []).length > 0 || (match.substitutes || []).length > 0) {
    const wrap = document.createElement('div');
    wrap.style.marginTop = '12px';
    wrap.style.display = 'flex';
    wrap.style.gap = '20px';
    wrap.style.flexWrap = 'wrap';

    const starterBox = document.createElement('div');
    starterBox.innerHTML = `<h4>首发（点击移到替补）</h4>`;
    (match.starters || []).forEach(pid => {
      const chip = document.createElement('div');
      chip.className = 'player-chip starter-tag';
      chip.innerHTML = `<span>${getPlayerName(pid)}</span><span>⇄</span>`;
      chip.onclick = () => {
        updateCurrentMatch(m => {
          m.starters = m.starters.filter(id => id !== pid);
          m.substitutes = m.substitutes || [];
          m.substitutes.push(pid);
          // 从阵型中移除
          ['A', 'B'].forEach(key => {
            const lu = m.lineups && m.lineups[key];
            if (lu) {
              Object.keys(lu.assignments || {}).forEach(posId => {
                if (lu.assignments[posId] === pid) delete lu.assignments[posId];
              });
              lu.players = (lu.players || []).filter(id => id !== pid);
            }
          });
        });
        render();
      };
      starterBox.appendChild(chip);
    });

    const subBox = document.createElement('div');
    subBox.innerHTML = `<h4>替补（点击移到首发）</h4>`;
    (match.substitutes || []).forEach(pid => {
      const chip = document.createElement('div');
      chip.className = 'player-chip sub-tag';
      chip.innerHTML = `<span>${getPlayerName(pid)}</span><span>⇄</span>`;
      chip.onclick = () => {
        updateCurrentMatch(m => {
          if ((m.starters || []).length >= m.formationSize) {
            alert(`首发人数已达 ${m.formationSize} 人，请先将一名首发移到替补`);
            return;
          }
          m.substitutes = m.substitutes.filter(id => id !== pid);
          m.starters = m.starters || [];
          m.starters.push(pid);
        });
        render();
      };
      subBox.appendChild(chip);
    });

    wrap.appendChild(starterBox);
    wrap.appendChild(subBox);
    sec.appendChild(wrap);
  }

  app.appendChild(sec);
}

// ---- 阵型管理 ----
function renderLineupSection(app, match, players) {
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `<h3>阵型管理</h3>`;

  if ((match.starters || []).length === 0) {
    sec.innerHTML += `<div class="empty-tip">请先完成首发抽签/选择</div>`;
    app.appendChild(sec);
    return;
  }

  // 阵容 A / B 切换
  const tabs = document.createElement('div');
  tabs.className = 'lineup-tabs';
  ['A', 'B'].forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'btn' + (state.currentLineup === key ? ' active' : '');
    btn.textContent = '阵容 ' + key;
    btn.onclick = () => { state.currentLineup = key; render(); };
    tabs.appendChild(btn);
  });
  sec.appendChild(tabs);

  const lineupKey = state.currentLineup;
  match.lineups = match.lineups || { A: null, B: null };
  let lineup = match.lineups[lineupKey];
  if (!lineup) {
    lineup = { formation: null, players: [], assignments: {} };
    match.lineups[lineupKey] = lineup;
    saveMatches(loadMatches().map(mm => mm.id === match.id ? match : mm));
  }

  const formationOptions = Object.keys(getFormationsForSize(match.formationSize));

  // 阵型选择
  const formSelectWrap = document.createElement('div');
  formSelectWrap.className = 'formation-select';
  formSelectWrap.innerHTML = `阵型：`;
  const select = document.createElement('select');
  select.innerHTML = `<option value="">请选择阵型</option>` +
    formationOptions.map(f => `<option value="${f}" ${lineup.formation === f ? 'selected' : ''}>${f}</option>`).join('') +
    `<option value="__custom__" ${lineup.formation === '__custom__' ? 'selected' : ''}>自由排列（手动拖动定位）</option>`;
  select.onchange = () => {
    updateCurrentMatch(m => {
      const lu = m.lineups[lineupKey];
      lu.formation = select.value || null;
      lu.assignments = {}; // 切换阵型清空已分配位置
      lu.customPositions = {}; // 切换阵型清空自由排列位置
    });
    render();
  };
  formSelectWrap.appendChild(select);
  sec.appendChild(formSelectWrap);

  // 出场人员选择（数量需等于 formationSize）
  const playerSelectWrap = document.createElement('div');
  playerSelectWrap.innerHTML = `<div style="margin-bottom:6px;">出场人员（需选 ${match.formationSize} 人，当前 ${lineup.players.length} 人）：</div>`;
  const list = document.createElement('div');
  list.className = 'checkbox-list';

  // 候选人员：阵容A 默认从首发中选；阵容B 可从全部参赛名单中选
  const candidatePool = match.roster || [];
  candidatePool
    .slice()
    .sort((a, b) => (getPlayerById(a)?.number ?? 999) - (getPlayerById(b)?.number ?? 999))
    .forEach(pid => {
      const checked = lineup.players.includes(pid);
      const label = document.createElement('label');
      label.className = checked ? 'checked' : '';
      label.innerHTML = `<input type="checkbox" value="${pid}" ${checked ? 'checked' : ''}> ${getPlayerName(pid)}`;
      list.appendChild(label);
      label.querySelector('input').onchange = (e) => {
        updateCurrentMatch(m => {
          const lu = m.lineups[lineupKey];
          if (e.target.checked) {
            if (lu.players.length >= m.formationSize) {
              e.target.checked = false;
              alert(`最多选择 ${m.formationSize} 人`);
              return;
            }
            lu.players.push(pid);
          } else {
            lu.players = lu.players.filter(id => id !== pid);
            Object.keys(lu.assignments).forEach(posId => {
              if (lu.assignments[posId] === pid) delete lu.assignments[posId];
            });
          }
        });
        render();
      };
    });
  playerSelectWrap.appendChild(list);

  // 一键带入首发
  const fillBtn = document.createElement('button');
  fillBtn.className = 'btn small';
  fillBtn.style.marginTop = '8px';
  fillBtn.textContent = '从首发名单一键带入';
  fillBtn.onclick = () => {
    updateCurrentMatch(m => {
      const lu = m.lineups[lineupKey];
      lu.players = m.starters.slice(0, m.formationSize);
      lu.assignments = {};
    });
    render();
  };
  playerSelectWrap.appendChild(fillBtn);

  sec.appendChild(playerSelectWrap);

  // 阵型场地（仅当阵型已选 且 人员数量正确时显示）
  if (lineup.formation === '__custom__' && lineup.players.length === match.formationSize) {
    sec.appendChild(buildFreeFormationEditor(match, lineupKey, lineup));
  } else if (lineup.formation && lineup.players.length === match.formationSize) {
    sec.appendChild(buildFormationEditor(match, lineupKey, lineup));
  } else {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '请先选择阵型，并选满出场人员，即可拖动排兵布阵';
    sec.appendChild(tip);
  }

  app.appendChild(sec);
}

function createPitch() {
  const pitch = document.createElement('div');
  pitch.className = 'pitch';
  const goal = document.createElement('div');
  goal.className = 'goal';
  pitch.appendChild(goal);
  return pitch;
}
function addTacticsLayer(pitch, lineupKey, lineup, editable) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('tactics-layer');
  const draw = strokes => {
    svg.replaceChildren(...(strokes || []).map(points => {
      const path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '));
      return path;
    }));
  };
  draw(lineup.tactics);
  pitch.appendChild(svg);
  if (!editable) return;

  const controls = document.createElement('div');
  controls.className = 'tactics-controls';
  const drawBtn = document.createElement('button');
  drawBtn.className = 'btn small';
  drawBtn.textContent = '划线';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn small';
  clearBtn.textContent = '清空划线';
  controls.append(drawBtn, clearBtn);

  let drawing = false;
  let points = [];
  const point = e => {
    const rect = pitch.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100)) };
  };
  drawBtn.onclick = () => {
    const active = svg.classList.toggle('drawing');
    drawBtn.classList.toggle('primary', active);
    drawBtn.textContent = active ? '完成划线' : '划线';
  };
  clearBtn.onclick = () => {
    updateCurrentMatch(m => { m.lineups[lineupKey].tactics = []; });
    lineup.tactics = [];
    draw([]);
  };
  svg.onpointerdown = e => {
    if (!svg.classList.contains('drawing')) return;
    drawing = true;
    points = [point(e)];
    svg.setPointerCapture(e.pointerId);
    draw([...(lineup.tactics || []), points]);
  };
  svg.onpointermove = e => {
    if (!drawing) return;
    points.push(point(e));
    draw([...(lineup.tactics || []), points]);
  };
  svg.onpointerup = () => {
    if (!drawing) return;
    drawing = false;
    if (points.length > 1) {
      updateCurrentMatch(m => {
        const tactics = m.lineups[lineupKey].tactics || [];
        tactics.push(points);
        m.lineups[lineupKey].tactics = tactics;
      });
      lineup.tactics = [...(lineup.tactics || []), points];
    }
    draw(lineup.tactics);
  };
  return controls;
}

function buildFormationEditor(match, lineupKey, lineup) {
  const wrap = document.createElement('div');
  wrap.className = 'formation-area';

  const positions = getFormationsForSize(match.formationSize)[lineup.formation];

  // 球场
  const pitch = createPitch();
  positions.forEach(pos => {
    const slot = document.createElement('div');
    slot.className = 'pos-slot';
    slot.style.left = pos.x + '%';
    slot.style.top = pos.y + '%';
    slot.dataset.posId = pos.id;

    const assignedId = lineup.assignments[pos.id];
    if (assignedId) {
      slot.classList.add('filled');
      slot.draggable = true;
      slot.innerHTML = `<div class="player-name">${getPlayerName(assignedId)}</div><div class="pos-label">${pos.label}</div>`;
      slot.dataset.playerId = assignedId;
      slot.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'slot', posId: pos.id, playerId: assignedId }));
      };
    } else {
      slot.innerHTML = `<div class="pos-label">${pos.label}</div>`;
    }

    slot.ondragover = (e) => { e.preventDefault(); slot.classList.add('dragover'); };
    slot.ondragleave = () => slot.classList.remove('dragover');
    slot.ondrop = (e) => {
      e.preventDefault();
      slot.classList.remove('dragover');
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      updateCurrentMatch(m => {
        const lu = m.lineups[lineupKey];
        const targetPlayer = lu.assignments[pos.id];
        if (data.from === 'bench') {
          // 把替换出来的人放回 bench：直接清空（assignments 不记录即视为在 bench）
          if (targetPlayer && targetPlayer !== data.playerId) {
            // 原位置玩家自动回 bench（无需特殊处理，assignments 被覆盖即可）
          }
          lu.assignments[pos.id] = data.playerId;
          // 如果该球员之前在别的位置，移除
          Object.keys(lu.assignments).forEach(pid2 => {
            if (pid2 !== pos.id && lu.assignments[pid2] === data.playerId) delete lu.assignments[pid2];
          });
        } else if (data.from === 'slot') {
          // 交换两个位置的球员
          const fromPos = data.posId;
          const fromPlayer = data.playerId;
          lu.assignments[pos.id] = fromPlayer;
          if (targetPlayer) {
            lu.assignments[fromPos] = targetPlayer;
          } else {
            delete lu.assignments[fromPos];
          }
        }
      });
      render();
    };

    pitch.appendChild(slot);
  });
  const tacticsControls = addTacticsLayer(pitch, lineupKey, lineup, true);

  // 替补席（待分配人员）
  const bench = document.createElement('div');
  bench.className = 'bench';
  bench.innerHTML = `<h4>待分配（拖动到场上位置）</h4>`;
  const assignedIds = Object.values(lineup.assignments);
  const unassigned = lineup.players.filter(pid => !assignedIds.includes(pid));
  if (unassigned.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '已全部分配到场上';
    bench.appendChild(tip);
  }
  unassigned.forEach(pid => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    chip.draggable = true;
    chip.textContent = getPlayerName(pid);
    chip.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ from: 'bench', playerId: pid }));
    };
    bench.appendChild(chip);
  });

  // bench 区域作为放置区：从场上拖回去取消分配
  bench.ondragover = (e) => e.preventDefault();
  bench.ondrop = (e) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data.from === 'slot') {
      updateCurrentMatch(m => {
        const lu = m.lineups[lineupKey];
        delete lu.assignments[data.posId];
      });
      render();
    }
  };

  if (tacticsControls) wrap.appendChild(tacticsControls);
  wrap.appendChild(pitch);
  wrap.appendChild(bench);
  return wrap;
}

// 自由排列：球员可拖动到球场上任意位置
function buildFreeFormationEditor(match, lineupKey, lineup) {
  const wrap = document.createElement('div');
  wrap.className = 'formation-area';

  const customPositions = lineup.customPositions || {};

  const pitch = createPitch();

  lineup.players.forEach(pid => {
    const pos = customPositions[pid];
    if (!pos) return;
    const marker = document.createElement('div');
    marker.className = 'pos-slot filled free';
    marker.style.left = pos.x + '%';
    marker.style.top = pos.y + '%';
    marker.draggable = true;
    marker.innerHTML = `<div class="player-name">${getPlayerName(pid)}</div>`;
    marker.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ playerId: pid }));
    };
    pitch.appendChild(marker);
  });
  const tacticsControls = addTacticsLayer(pitch, lineupKey, lineup, true);

  pitch.ondragover = (e) => e.preventDefault();
  pitch.ondrop = (e) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const rect = pitch.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));
    updateCurrentMatch(m => {
      const lu = m.lineups[lineupKey];
      lu.customPositions = lu.customPositions || {};
      lu.customPositions[data.playerId] = { x, y };
    });
    render();
  };

  // 待分配（拖到球场上即可放置）
  const bench = document.createElement('div');
  bench.className = 'bench';
  bench.innerHTML = `<h4>待分配（拖动到球场上放置，可从场上拖回此处移除）</h4>`;
  const unplaced = lineup.players.filter(pid => !customPositions[pid]);
  if (unplaced.length === 0) {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '已全部放置到场上';
    bench.appendChild(tip);
  }
  unplaced.forEach(pid => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    chip.draggable = true;
    chip.textContent = getPlayerName(pid);
    chip.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ playerId: pid }));
    };
    bench.appendChild(chip);
  });

  bench.ondragover = (e) => e.preventDefault();
  bench.ondrop = (e) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    updateCurrentMatch(m => {
      const lu = m.lineups[lineupKey];
      if (lu.customPositions) delete lu.customPositions[data.playerId];
    });
    render();
  };

  if (tacticsControls) wrap.appendChild(tacticsControls);
  wrap.appendChild(pitch);
  wrap.appendChild(bench);
  return wrap;
}

// ---- 赛后数据统计（单场） ----
function renderStatsSection(app, match, players) {
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `<h3>赛后数据</h3>`;
  if ((match.roster || []).length === 0) {
    sec.innerHTML += `<div class="empty-tip">请先选择参赛名单</div>`;
    app.appendChild(sec);
    return;
  }
  const table = document.createElement('table');
  table.className = 'stats-table';
  table.innerHTML = `<thead><tr><th>球员</th><th>进球</th><th>助攻</th></tr></thead><tbody></tbody>`;
  const tbody = table.querySelector('tbody');
  match.roster.slice().sort((a, b) => (getPlayerById(a)?.number ?? 999) - (getPlayerById(b)?.number ?? 999)).forEach(pid => {
    const stat = (match.stats && match.stats[pid]) || { goals: 0, assists: 0 };
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${getPlayerName(pid)}</td><td><input type="number" min="0" value="${stat.goals || 0}" data-pid="${pid}" data-field="goals"></td><td><input type="number" min="0" value="${stat.assists || 0}" data-pid="${pid}" data-field="assists"></td>`;
    tbody.appendChild(tr);
  });
  sec.appendChild(table);
  table.querySelectorAll('input').forEach(input => {
    input.disabled = !isAdmin();
    if (isAdmin()) input.onchange = () => {
      const val = Math.max(0, parseInt(input.value, 10) || 0);
      input.value = val;
      updateCurrentMatch(m => {
        m.stats = m.stats || {};
        m.stats[input.dataset.pid] = m.stats[input.dataset.pid] || { goals: 0, assists: 0 };
        m.stats[input.dataset.pid][input.dataset.field] = val;
      });
    };
  });
  const mvpWrap = document.createElement('div');
  mvpWrap.style.marginTop = '12px';
  mvpWrap.textContent = 'MVP：';
  const mvpSelect = document.createElement('select');
  mvpSelect.innerHTML = `<option value="">未选择</option>` + match.roster.map(pid => `<option value="${pid}" ${match.mvp === pid ? 'selected' : ''}>${getPlayerName(pid)}</option>`).join('');
  mvpSelect.disabled = !isAdmin();
  if (isAdmin()) mvpSelect.onchange = () => updateCurrentMatch(m => { m.mvp = mvpSelect.value || null; });
  mvpWrap.appendChild(mvpSelect);
  sec.appendChild(mvpWrap);
  renderMvpVote(sec, match);
  app.appendChild(sec);
}

function renderMvpVote(sec, match) {
  const wrap = document.createElement('div');
  wrap.className = 'section';
  wrap.style.marginTop = '14px';
  const vote = match.mvpVote;
  if (!vote) {
    wrap.innerHTML = '<h4>赛后 MVP 投票</h4>';
    if (isAdmin()) {
      const btn = document.createElement('button');
      btn.className = 'btn primary';
      btn.textContent = '发起 MVP 投票';
      btn.onclick = () => renderVoteSetup(wrap, match);
      wrap.appendChild(btn);
    } else wrap.innerHTML += '<div class="meta">管理员尚未发起投票</div>';
    sec.appendChild(wrap);
    return;
  }
  wrap.innerHTML = `<h4>赛后 MVP 投票</h4><div class="meta">每位投票成员最多投 ${vote.votesPerUser} 票</div>`;
  const resultTable = document.createElement('table');
  resultTable.innerHTML = '<thead><tr><th>候选球员</th><th>当前票数</th></tr></thead><tbody></tbody>';
  vote.candidateIds.forEach(pid => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${getPlayerName(pid)}</td><td>${(vote.results || {})[pid] || 0}</td>`;
    resultTable.querySelector('tbody').appendChild(row);
  });
  wrap.appendChild(resultTable);
  if (!vote.voterIds.includes(currentUser.id)) {
    wrap.innerHTML += '<div class="meta" style="margin-top:8px">你不在本次投票名单内</div>';
  } else {
    const own = (vote.ballots || {})[String(currentUser.id)] || [];
    const selected = state.mvpVoteDraft?.matchId === match.id ? state.mvpVoteDraft.candidateIds : own;
    const list = document.createElement('div');
    list.className = 'checkbox-list';
    list.style.marginTop = '10px';
    vote.candidateIds.forEach(pid => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${pid}" ${selected.includes(pid) ? 'checked' : ''}> ${getPlayerName(pid)}`;
      label.querySelector('input').onchange = () => {
        state.mvpVoteDraft = {
          matchId: match.id,
          candidateIds: [...list.querySelectorAll('input:checked')].map(input => input.value),
        };
      };
      list.appendChild(label);
    });
    const submit = document.createElement('button');
    submit.className = 'btn primary';
    submit.style.marginTop = '8px';
    submit.textContent = own.length ? '更新我的投票' : '提交投票';
    submit.onclick = async () => {
      const candidateIds = [...list.querySelectorAll('input:checked')].map(input => input.value);
      if (!candidateIds.length || candidateIds.length > vote.votesPerUser) { alert(`请选择 1-${vote.votesPerUser} 人`); return; }
      const res = await fetch(`/api/matches/${encodeURIComponent(match.id)}/mvp-vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidateIds }) });
      if (!res.ok) { alert('投票未提交'); return; }
      state.mvpVoteDraft = null;
      await loadDataFromServer();
      render();
    };
    wrap.append(list, submit);
  }
  sec.appendChild(wrap);
}

function renderVoteSetup(wrap, match) {
  wrap.innerHTML = `<h4>发起 MVP 投票</h4><label>每人最多票数 <input id="vote-count" type="number" min="1" max="${match.roster.length}" value="1"></label><div style="margin-top:8px">候选球员：</div><div id="vote-candidates" class="checkbox-list"></div><div style="margin-top:8px">可投票成员：</div><div id="vote-voters" class="checkbox-list">加载中…</div><button id="start-vote" class="btn primary" style="margin-top:10px">确认发起</button>`;
  const candidates = wrap.querySelector('#vote-candidates');
  match.roster.forEach(pid => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${pid}" checked> ${getPlayerName(pid)}`;
    candidates.appendChild(label);
  });
  fetch('/api/admin/users').then(res => res.json()).then(data => {
    const voters = wrap.querySelector('#vote-voters');
    voters.textContent = '';
    data.users.forEach(user => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" value="${user.id}" checked> ${user.username}`;
      voters.appendChild(label);
    });
  });
  wrap.querySelector('#start-vote').onclick = async () => {
    const voterIds = [...wrap.querySelectorAll('#vote-voters input:checked')].map(input => Number(input.value));
    const candidateIds = [...candidates.querySelectorAll('input:checked')].map(input => input.value);
    const votesPerUser = Number(wrap.querySelector('#vote-count').value);
    const res = await fetch(`/api/matches/${encodeURIComponent(match.id)}/mvp-vote/configure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voterIds, candidateIds, votesPerUser }) });
    if (!res.ok) { alert('投票设置不完整'); return; }
    await loadDataFromServer();
    render();
  };
}
// ========== 比赛日历 ==========
function renderCalendarView(app) {
  const matches = loadMatches();
  const matchesByDate = {};
  matches.forEach(m => {
    (matchesByDate[m.date] = matchesByDate[m.date] || []).push(m);
  });

  if (state.calendarYear == null) {
    const now = new Date();
    state.calendarYear = now.getFullYear();
    state.calendarMonth = now.getMonth();
  }
  const year = state.calendarYear;
  const month = state.calendarMonth;

  const header = document.createElement('div');
  header.className = 'toolbar';
  header.innerHTML = `
    <button class="btn small" id="cal-prev">‹ 上月</button>
    <strong style="font-size:16px;">${year} 年 ${month + 1} 月</strong>
    <button class="btn small" id="cal-next">下月 ›</button>
  `;
  app.appendChild(header);
  header.querySelector('#cal-prev').onclick = () => {
    state.calendarMonth--;
    if (state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
    render();
  };
  header.querySelector('#cal-next').onclick = () => {
    state.calendarMonth++;
    if (state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
    render();
  };

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';
  ['日', '一', '二', '三', '四', '五', '六'].forEach(d => {
    const cell = document.createElement('div');
    cell.className = 'cal-weekday';
    cell.textContent = d;
    grid.appendChild(cell);
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day empty';
    grid.appendChild(cell);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayMatches = matchesByDate[dateStr] || [];
    const cell = document.createElement('div');
    cell.className = 'cal-day'
      + (dayMatches.length ? ' has-match' : '')
      + (state.calendarSelectedDate === dateStr ? ' selected' : '');
    cell.innerHTML = `<div class="cal-day-num">${d}</div>` + (dayMatches.length ? `<div class="cal-dot">⚽</div>` : '');
    if (dayMatches.length) {
      cell.onclick = () => { state.calendarSelectedDate = dateStr; render(); };
    }
    grid.appendChild(cell);
  }
  app.appendChild(grid);

  if (state.calendarSelectedDate && matchesByDate[state.calendarSelectedDate]) {
    matchesByDate[state.calendarSelectedDate].forEach(m => renderMatchSummary(app, m));
  } else {
    const tip = document.createElement('div');
    tip.className = 'empty-tip';
    tip.textContent = '点击日历中标记 ⚽ 的日期，查看当天比赛的比分、进球助攻、MVP 和阵型';
    app.appendChild(tip);
  }
}

function renderMatchSummary(app, match) {
  const sec = document.createElement('div');
  sec.className = 'section';
  const scoreText = (match.scoreUs != null && match.scoreThem != null)
    ? `${match.scoreUs} : ${match.scoreThem}`
    : '未填写比分';
  sec.innerHTML = `<h3>${match.date} ${match.opponent ? 'vs ' + match.opponent : ''}　${scoreText}</h3>
    <div class="meta">${match.formationSize}人制</div>`;

  const scorers = Object.entries(match.stats || {}).filter(([, s]) => (s.goals || 0) > 0);
  const assisters = Object.entries(match.stats || {}).filter(([, s]) => (s.assists || 0) > 0);

  const statsDiv = document.createElement('div');
  statsDiv.style.marginTop = '8px';
  statsDiv.innerHTML = `
    <div><strong>进球：</strong>${scorers.length ? scorers.map(([pid, s]) => `${getPlayerName(pid)}×${s.goals}`).join('、') : '无'}</div>
    <div><strong>助攻：</strong>${assisters.length ? assisters.map(([pid, s]) => `${getPlayerName(pid)}×${s.assists}`).join('、') : '无'}</div>
    <div><strong>MVP：</strong>${match.mvp ? getPlayerName(match.mvp) : '未选择'}</div>
  `;
  sec.appendChild(statsDiv);

  ['A', 'B'].forEach(key => {
    const lu = match.lineups && match.lineups[key];
    if (!lu || !lu.formation || !lu.players || lu.players.length === 0) return;
    const title = document.createElement('h4');
    title.textContent = `阵容 ${key}（${lu.formation === '__custom__' ? '自由排列' : lu.formation}）`;
    title.style.marginBottom = '6px';
    sec.appendChild(title);
    sec.appendChild(buildFormationViewer(match, lu));
  });

  app.appendChild(sec);
}

// 只读阵型展示
function buildFormationViewer(match, lineup) {
  const pitch = createPitch();
  pitch.style.marginBottom = '14px';

  if (lineup.formation === '__custom__') {
    (lineup.players || []).forEach(pid => {
      const pos = (lineup.customPositions || {})[pid];
      if (!pos) return;
      const marker = document.createElement('div');
      marker.className = 'pos-slot filled free';
      marker.style.left = pos.x + '%';
      marker.style.top = pos.y + '%';
      marker.innerHTML = `<div class="player-name">${getPlayerName(pid)}</div>`;
      pitch.appendChild(marker);
    });
  } else {
    const positions = getFormationsForSize(match.formationSize)[lineup.formation] || [];
    positions.forEach(pos => {
      const pid = (lineup.assignments || {})[pos.id];
      if (!pid) return;
      const marker = document.createElement('div');
      marker.className = 'pos-slot filled';
      marker.style.left = pos.x + '%';
      marker.style.top = pos.y + '%';
      marker.innerHTML = `<div class="player-name">${getPlayerName(pid)}</div><div class="pos-label">${pos.label}</div>`;
      pitch.appendChild(marker);
    });
  }
  addTacticsLayer(pitch, null, lineup, false);
  return pitch;
}

// ========== 数据统计（球员维度） ==========
function renderStatsView(app) {
  const players = loadPlayers();
  const matches = loadMatches();

  if (players.length === 0) {
    app.innerHTML = `<div class="empty-tip">暂无球员数据</div>`;
    return;
  }

  const summary = {};
  players.forEach(p => {
    summary[p.id] = { name: p.name, number: p.number, appearances: 0, starts: 0, goals: 0, assists: 0, mvp: 0 };
  });

  matches.forEach(m => {
    (m.roster || []).forEach(pid => {
      if (summary[pid]) summary[pid].appearances++;
    });
    (m.starters || []).forEach(pid => {
      if (summary[pid]) summary[pid].starts++;
    });
    Object.entries(m.stats || {}).forEach(([pid, s]) => {
      if (summary[pid]) {
        summary[pid].goals += s.goals || 0;
        summary[pid].assists += s.assists || 0;
      }
    });
    if (m.mvp && summary[m.mvp]) summary[m.mvp].mvp++;
  });

  const table = document.createElement('table');
  table.innerHTML = `
    <thead><tr><th>号码</th><th>姓名</th><th>出场</th><th>首发</th><th>进球</th><th>助攻</th><th>MVP</th></tr></thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  Object.values(summary)
    .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))
    .forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.number ?? ''}</td>
        <td>${s.name}</td>
        <td>${s.appearances}</td>
        <td>${s.starts}</td>
        <td>${s.goals}</td>
        <td>${s.assists}</td>
        <td>${s.mvp}</td>
      `;
      tbody.appendChild(tr);
    });
  app.appendChild(table);
}


function renderMembersView(app) {
  if (!currentUser || currentUser.role !== 'admin') {
    app.innerHTML = '<div class="empty-tip">仅管理员可管理成员</div>';
    return;
  }
  const sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = `<h3>成员管理</h3>
    <div class="toolbar">
      <input id="new-username" placeholder="用户名（3-32 位）">
      <input id="new-password" type="password" placeholder="初始密码（至少 8 位）">
      <select id="new-role"><option value="member">普通成员</option><option value="admin">管理员</option></select>
      <button id="create-user-btn" class="btn primary">创建账号</button>
    </div>
    <div id="member-error" class="login-error"></div><div id="member-list">加载中…</div>`;
  app.appendChild(sec);
  const error = sec.querySelector('#member-error');
  sec.querySelector('#create-user-btn').onclick = async () => {
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: sec.querySelector('#new-username').value.trim(),
        password: sec.querySelector('#new-password').value,
        role: sec.querySelector('#new-role').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) { error.textContent = data.error || '创建失败'; return; }
    render();
  };
  fetch('/api/admin/users').then(res => res.json()).then(data => {
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>用户名</th><th>权限</th></tr></thead><tbody></tbody>';
    data.users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `<td></td><td></td>`;
      row.children[0].textContent = user.username;
      row.children[1].textContent = user.role === 'admin' ? '管理员' : '普通成员';
      table.querySelector('tbody').appendChild(row);
    });
    sec.querySelector('#member-list').replaceChildren(table);
  });
}// ========== 登录与数据加载 ==========
async function checkAuth() {
  const res = await fetch('/api/check-auth');
  return res.json();
}

function updateUserUI() {
  const membersTab = document.getElementById('members-tab');
  membersTab.style.display = currentUser && currentUser.role === 'admin' ? '' : 'none';
}

async function loadDataFromServer() {
  const res = await fetch('/api/data');
  if (!res.ok) throw new Error('未登录');
  const data = await res.json();
  dataCache.players = data.players || [];
  dataCache.matches = data.matches || [];
}

function showLogin(message) {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('login-error').textContent = message || '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-username').focus();
}

function hideLogin() {
  document.getElementById('login-overlay').classList.add('hidden');
}

async function tryLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) { showLogin('用户名或密码错误，请重试'); return; }
  currentUser = (await res.json()).user;
  await loadDataFromServer();
  hideLogin();
  updateUserUI();
  render();
}

async function startApp() {
  const auth = await checkAuth();
  if (auth.authed) {
    currentUser = auth.user;
    await loadDataFromServer();
    hideLogin();
    updateUserUI();
    render();
  } else {
    showLogin();
  }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.view === 'match-detail' && !state.currentMatchId) return;
      switchView(btn.dataset.view);
    };
  });

  document.getElementById('player-save-btn').onclick = savePlayerFromModal;
  document.getElementById('player-cancel-btn').onclick = closePlayerModal;
  document.getElementById('match-save-btn').onclick = saveMatchFromModal;
  document.getElementById('match-cancel-btn').onclick = closeMatchModal;

  document.getElementById('login-btn').onclick = tryLogin;
  ['login-username', 'login-password'].forEach(id => document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); }));
  document.getElementById('change-password-btn').onclick = async () => {
    const current_password = prompt('请输入当前密码');
    if (current_password === null) return;
    const new_password = prompt('请输入新密码（至少 8 位）');
    if (new_password === null) return;
    const res = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password, new_password }),
    });
    const data = await res.json();
    alert(res.ok ? '密码已修改' : (data.error || '修改失败'));
  };
  document.getElementById('logout-btn').onclick = async () => {
    await fetch('/api/logout', { method: 'POST' });
    dataCache = { players: [], matches: [] };
    currentUser = null;
    updateUserUI();
    showLogin();
  };

  // 防止拖拽未命中放置区时，浏览器把拖拽内容当作链接打开新页面
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => e.preventDefault());

  startApp();
  setInterval(async () => {
    if (state.view === 'match-detail' && getCurrentMatch()?.mvpVote) { await loadDataFromServer(); render(); }
  }, 5000);
});
