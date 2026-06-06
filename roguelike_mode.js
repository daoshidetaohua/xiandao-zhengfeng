/**
 * 仙道争锋 — 修仙爬塔模式 (Roguelike PvE)
 * roguelike_mode.js
 * 仅在 gameMode='pve_roguelike' 时生效
 */

var ROGUELIKE = {};

// ===== 状态 =====
ROGUELIKE.state = null;

// ===== 稀有度 =====
var RARITY_TABLE = {
  common:   { name:'凡品', emoji:'⚪', color:'#a0a0a0' },
  uncommon: { name:'灵品', emoji:'🟢', color:'#40c040' },
  rare:     { name:'仙品', emoji:'🟣', color:'#c060e0' },
  legendary:{ name:'神品', emoji:'🟡', color:'#ffd700' },
};

// ===== 节点类型 =====
var NODE_TYPES = {
  battle:   { icon:'⚔️', name:'散修拦截', desc:'普通战斗', css:'border-left:3px solid #c06040' },
  elite:    { icon:'💀', name:'妖王拦路', desc:'精英(掉遗物)', css:'border-left:3px solid #e04040' },
  shop:     { icon:'🛒', name:'坊市', desc:'买牌/遗物', css:'border-left:3px solid #ffd700' },
  campfire: { icon:'🏕️', name:'修炼台', desc:'升级/回复', css:'border-left:3px solid #40a060' },
  event:    { icon:'❓', name:'奇遇', desc:'随机事件', css:'border-left:3px solid #c080e0' },
  boss:     { icon:'👑', name:'守关仙尊', desc:'Boss战', css:'border-left:3px solid #ff4040' },
};

// ===== 注入 HTML 界面 =====
function injectRoguelikeHTML() {
  var app = document.getElementById('app');
  if (!app || document.getElementById('draftScreen')) return;

  var screens = [
    '<div id="draftScreen" style="display:none;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(180deg,#0f0a1a 0,#1a0f0a 50%,#0a0f1a 100%)">',
    '  <h2 id="draftTitle" style="font-size:1.5rem;color:#f0d8a0;margin:2vh 0">仙途初启</h2>',
    '  <div id="draftSub" style="color:#a09080;font-size:0.85rem;margin-bottom:2vh"></div>',
    '  <div id="draftCards" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap"></div>',
    '  <div id="draftDeckPreview" style="margin-top:2vh;color:#605040;font-size:0.75rem"></div>',
    '</div>',
    '<div id="rewardScreen" style="display:none;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:linear-gradient(180deg,#0f0a1a 0,#1a0f0a 50%,#0a0f1a 100%)">',
    '  <h2 style="font-size:1.5rem;color:#60d060;margin:2vh 0">战斗胜利!</h2>',
    '  <div id="rewardSub" style="color:#a09080;font-size:0.85rem;margin-bottom:2vh">选牌加入牌组</div>',
    '  <div id="rewardCards" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap"></div>',
    '  <div style="margin-top:2vh"><button class="modalBtn secondary" id="btnSkipReward">跳过</button></div>',
    '</div>',
    '<div id="mapScreen" style="display:none;flex-direction:column;align-items:center;padding:2vh 2vw;height:100vh;overflow-y:auto;background:linear-gradient(180deg,#0f0a1a 0,#1a0f0a 50%,#0a0f1a 100%)">',
    '  <h2 id="mapTitle" style="font-size:1.5rem;color:#f0d8a0;margin:1vh 0"></h2>',
    '  <div id="mapSub" style="color:#a09080;font-size:0.8rem;margin-bottom:1vh"></div>',
    '  <div id="mapNodes" style="width:100%;max-width:600px"></div>',
    '  <div id="mapInfo" style="margin:1vh 0;color:#605040;font-size:0.75rem"></div>',
    '</div>',
    '<div id="shopScreen" style="display:none;flex-direction:column;align-items:center;padding:2vh 2vw;height:100vh;overflow-y:auto;background:linear-gradient(180deg,#0f0a1a 0,#1a0f0a 50%,#0a0f1a 100%)">',
    '  <h2 style="font-size:1.5rem;color:#f0d8a0;margin:1vh 0">坊市</h2>',
    '  <div id="shopGold" style="color:#ffd700;font-size:1rem;margin-bottom:1vh">灵石: 50</div>',
    '  <div id="shopItems" style="width:100%;max-width:500px"></div>',
    '  <button class="modalBtn secondary" id="btnLeaveShop" style="margin-top:1vh">离开</button>',
    '</div>',
    '<div id="campfireScreen" style="display:none;flex-direction:column;align-items:center;padding:2vh 2vw;height:100vh;overflow-y:auto;background:linear-gradient(180deg,#0f0a1a 0,#1a0f0a 50%,#0a0f1a 100%)">',
    '  <h2 style="font-size:1.5rem;color:#f0d8a0;margin:1vh 0">修炼台</h2>',
    '  <div style="color:#a09080;font-size:0.85rem;margin-bottom:2vh">选择行动</div>',
    '  <div id="campfireOptions" style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:400px"></div>',
    '</div>',
  ].join('');

  app.insertAdjacentHTML('afterend', screens);

  // CSS
  var style = document.createElement('style');
  style.textContent = [
    '.draftCard{background:linear-gradient(145deg,#1a1520,#12101a);border:1px solid #2a2040;border-radius:12px;padding:16px 12px;text-align:center;cursor:pointer;transition:all .2s;width:clamp(100px,20vw,150px);position:relative}',
    '.draftCard:hover{transform:translateY(-8px);border-color:#f0d8a0;box-shadow:0 8px 30px rgba(200,150,50,0.3)}',
    '.draftCard .dName{font-size:0.9rem;color:#f0d8a0;font-weight:700;margin:4px 0}',
    '.draftCard .dCost{position:absolute;top:-8px;left:-8px;width:24px;height:24px;border-radius:50%;background:#2040a0;color:#a0c0ff;font-size:0.7rem;font-weight:700;display:flex;align-items:center;justify-content:center}',
    '.draftCard .dRarity{font-size:0.55rem;padding:1px 6px;border-radius:4px;margin-bottom:4px;display:inline-block}',
    '.draftCard .dDesc{font-size:0.7rem;color:#908070;line-height:1.2;margin:4px 0}',
    '.mapNode{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px;margin:4px 0;cursor:pointer;transition:all .15s;border:1px solid #2a2040;background:rgba(30,20,40,0.6)}',
    '.mapNode.reachable{border-color:#60a060;box-shadow:0 0 10px rgba(96,160,96,0.3);cursor:pointer}',
    '.mapNode.reachable:hover{transform:translateX(4px);border-color:#f0d8a0}',
    '.mapNode.passed{opacity:0.3;cursor:default}',
    '.mapNode.future{border-color:#1a1520;opacity:0.6;cursor:default}',
    '.mapNode .nIcon{font-size:1.2rem;width:28px;text-align:center}',
    '.mapNode .nName{font-weight:600;color:#e0d8c8;font-size:0.85rem}',
    '.mapNode .nDesc{font-size:0.65rem;color:#807060}',
    '.shopItem{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(30,20,40,0.8);border:1px solid #2a2040;border-radius:10px;margin:6px 0;cursor:pointer;transition:all .15s}',
    '.shopItem:hover{border-color:#f0d8a0}',
    '.shopItem .sIcon{font-size:1.2rem}',
    '.shopItem .sName{flex:1;color:#e0d8c8;font-weight:600;font-size:0.85rem}',
    '.shopItem .sPrice{color:#ffd700;font-weight:700}',
  ].join('\n');
  document.head.appendChild(style);
}

// ===== 隐藏界面函数 =====
function hideAllRLScreens() {
  ['draftScreen','rewardScreen','mapScreen','shopScreen','campfireScreen','gameScreen','selectScreen','lobbyScreen','tournamentLobby','tournamentResult'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ===== 主入口 =====
function startRoguelikeRun() {
  injectRoguelikeHTML();
  hideAllRLScreens();

  ROGUELIKE.state = {
    school: null,
    runDeck: [],
    draftPicks: [],
    floor: 1,
    step: 0,
    stones: 50,
    relics: [],
    bonusHP: false,
  };

  var ds = document.getElementById('draftScreen');
  ds.style.display = 'flex';
  document.getElementById('draftTitle').textContent = '选择宗门';
  document.getElementById('draftSub').textContent = '';
  document.getElementById('draftDeckPreview').textContent = '';

  var grid = document.getElementById('draftCards');
  grid.innerHTML = '';
  Object.entries(SCHOOLS).forEach(function(e) {
    var key = e[0], sc = e[1];
    var card = document.createElement('div');
    card.className = 'draftCard';
    card.innerHTML = '<div style="font-size:2rem">' + sc.icon + '</div><div class="dName">' + sc.name + '</div><div style="color:#807060;font-size:0.7rem">' + sc.diff + '</div><div class="dDesc">' + sc.desc + '</div>';
    card.onclick = function() {
      ROGUELIKE.state.school = key;
      var starter = SCHOOLS[key].cards.filter(function(c){ return (c.realm||0) === 0; }).slice(0, 8);
      ROGUELIKE.state.runDeck = starter.map(function(c){ return Object.assign({}, c); });
      roguelikeDraft(1);
    };
    grid.appendChild(card);
  });
}

// ===== 选牌 =====
function roguelikeDraft(round) {
  document.getElementById('draftTitle').textContent = '构筑初始牌组';
  document.getElementById('draftSub').textContent = '第 ' + round + '/3 轮 — 选一张加入牌组';
  var grid = document.getElementById('draftCards');
  grid.innerHTML = '';

  var cards = SCHOOLS[ROGUELIKE.state.school].cards;
  for (var i = 0; i < 3; i++) {
    var c = shuffle(cards)[0];
    var rt = RARITY_TABLE[c.rarity||'common'];
    var el = document.createElement('div');
    el.className = 'draftCard';
    el.innerHTML = '<div class="dCost">' + c.cost + '</div>' +
      '<div class="dName">' + c.name + '</div>' +
      '<div class="dRarity" style="background:' + rt.color + '20;color:' + rt.color + '">' + rt.emoji + ' ' + rt.name + '</div>' +
      '<div class="dDesc">' + c.desc + '</div>';
    el.onclick = function() {
      ROGUELIKE.state.runDeck.push(Object.assign({}, c));
      if (round < 3) roguelikeDraft(round + 1);
      else { document.getElementById('draftScreen').style.display = 'none'; showFloorMap(1); }
    };
    grid.appendChild(el);
  }
  document.getElementById('draftDeckPreview').textContent = '牌组: ' + ROGUELIKE.state.runDeck.length + '张';
}

// ===== 地图 =====
function generateFloor(n) {
  var count = [6, 8, 10, 12][n-1] || 8;
  var nodes = [{ type:'battle' }];
  for (var i = 1; i < count-1; i++) {
    var r = Math.random();
    if (r < 0.15) nodes.push({ type:'shop' });
    else if (r < 0.25) nodes.push({ type:'elite' });
    else if (r < 0.35) nodes.push({ type:'campfire' });
    else if (r < 0.42) nodes.push({ type:'event' });
    else nodes.push({ type:'battle' });
  }
  nodes.push({ type:'boss' });
  return nodes;
}

var _floorNodes = [], _currentNode = -1;

function showFloorMap(n) {
  ROGUELIKE.state.floor = n;
  ROGUELIKE.state.step = 0;
  _currentNode = -1;
  _floorNodes = generateFloor(n);

  hideAllRLScreens();
  document.getElementById('mapScreen').style.display = 'flex';
  document.getElementById('mapTitle').textContent = '修仙之路 — 第' + n + '关';
  document.getElementById('mapSub').textContent = '点击绿色节点前进';
  document.getElementById('mapInfo').textContent = '💰灵石:' + ROGUELIKE.state.stones + ' | 🃏牌组:' + ROGUELIKE.state.runDeck.length + '张';

  var html = '';
  _floorNodes.forEach(function(node, i) {
    var nt = NODE_TYPES[node.type];
    var state = (i === _currentNode + 1) ? 'reachable' : (i <= _currentNode ? 'passed' : 'future');
    html += '<div class="mapNode ' + state + '" style="' + nt.css + '" id="mn' + i + '">' +
      '<span class="nIcon">' + nt.icon + '</span>' +
      '<div style="flex:1"><div class="nName">' + nt.name + '</div><div class="nDesc">' + nt.desc + '</div></div>' +
      (state === 'reachable' ? '<span style="color:#60a060">→</span>' : '') +
      '</div>';
  });
  document.getElementById('mapNodes').innerHTML = html;

  _floorNodes.forEach(function(node, i) {
    var el = document.getElementById('mn' + i);
    if (el && i === _currentNode + 1) el.onclick = function() { visitNode(i); };
  });
}

function visitNode(i) {
  if (i !== _currentNode + 1) return;
  _currentNode = i;
  var node = _floorNodes[i];
  document.getElementById('mapScreen').style.display = 'none';

  switch (node.type) {
    case 'battle': case 'elite': startRLBattle(node.type === 'elite'); break;
    case 'shop': openRLShop(); break;
    case 'campfire': openRLCampfire(); break;
    case 'event': triggerRLEvent(); break;
    case 'boss': startRLBoss(); break;
  }
}

// ===== 战斗 =====
function makeRLPlayer() {
  var p = newPlayer(ROGUELIKE.state.school);
  p.deck = ROGUELIKE.state.runDeck.map(function(c){ return Object.assign({}, c); });
  shuffle(p.deck);
  return p;
}

function startRLBattle(isElite) {
  var keys = Object.keys(SCHOOLS).filter(function(k){ return k !== ROGUELIKE.state.school; });
  var eSchool = keys[Math.floor(Math.random() * keys.length)];
  var e = newPlayer(eSchool);
  e.deck = SCHOOLS[eSchool].cards.filter(function(c){ return (c.realm||0) <= 1; }).map(function(c){ return Object.assign({}, c); });
  if (isElite) { e.hp += 10; e.maxHp += 10; }
  shuffle(e.deck);

  gameMode = 'pve_roguelike';
  game = { p: makeRLPlayer(), e: e, turn:'player', phase:'start', turnCount:0, winner:null, gameOver:false, aiLevel: isElite?2:1, mode:'local', cultivateMode:false };
  for (var i = 0; i < 5; i++) { drawCard(game.p); drawCard(game.e); }
  game.phase = 'action';
  hideAllRLScreens();
  document.getElementById('gameScreen').style.display = 'flex';
  log('⚔️ ' + (isElite?'精英':'散修') + '！' + SCHOOLS[eSchool].name);
  renderAll();
}

function startRLBoss() {
  var keys = Object.keys(SCHOOLS).filter(function(k){ return k !== ROGUELIKE.state.school; });
  var eSchool = keys[Math.floor(Math.random() * keys.length)];
  var e = newPlayer(eSchool);
  e.deck = SCHOOLS[eSchool].cards.map(function(c){ return Object.assign({}, c); });
  e.hp += 20; e.maxHp += 20;
  shuffle(e.deck);

  gameMode = 'pve_roguelike';
  game = { p: makeRLPlayer(), e: e, turn:'player', phase:'start', turnCount:0, winner:null, gameOver:false, aiLevel:2, mode:'local', cultivateMode:false };
  for (var i = 0; i < 5; i++) { drawCard(game.p); drawCard(game.e); }
  game.phase = 'action';
  hideAllRLScreens();
  document.getElementById('gameScreen').style.display = 'flex';
  log('👑 Boss！' + SCHOOLS[eSchool].name + '镇守者！');
  renderAll();
}

// ===== 战斗结束 =====
function onRLWin(isElite) {
  ROGUELIKE.state.stones += [15, 25, 40, 60][ROGUELIKE.state.floor-1] + Math.floor(Math.random()*10);
  if (isElite) addRLRelic();

  hideAllRLScreens();
  document.getElementById('rewardScreen').style.display = 'flex';
  document.getElementById('rewardSub').textContent = '💰灵石:' + ROGUELIKE.state.stones + ' | 选牌加入牌组';
  document.getElementById('btnSkipReward').onclick = function() { document.getElementById('rewardScreen').style.display='none'; showFloorMap(ROGUELIKE.state.floor); };

  var grid = document.getElementById('rewardCards');
  grid.innerHTML = '';
  var cards = SCHOOLS[ROGUELIKE.state.school].cards.filter(function(c){ return (c.realm||0) <= ROGUELIKE.state.floor; });
  for (var i = 0; i < 3; i++) {
    var c = shuffle(cards)[0];
    var rt = RARITY_TABLE[c.rarity||'common'];
    var el = document.createElement('div');
    el.className = 'draftCard';
    el.innerHTML = '<div class="dCost">' + c.cost + '</div><div class="dName">' + c.name + '</div><div class="dRarity" style="background:' + rt.color + '20;color:' + rt.color + '">' + rt.emoji + ' ' + rt.name + '</div><div class="dDesc">' + c.desc + '</div>';
    el.onclick = function() {
      ROGUELIKE.state.runDeck.push(Object.assign({}, c));
      document.getElementById('rewardScreen').style.display = 'none';
      showFloorMap(ROGUELIKE.state.floor);
    };
    grid.appendChild(el);
  }
}

function onRLBossWin() {
  ROGUELIKE.state.stones += 30;
  if (ROGUELIKE.state.floor < 4) { showFloorMap(ROGUELIKE.state.floor + 1); }
  else {
    gameMode = 'local';
    var o = document.createElement('div');
    o.className = 'modalOverlay';
    o.innerHTML = '<div class="modalBox"><h2>🏆 飞升成功!</h2><p>你已通关修仙爬塔！</p><button class="modalBtn" onclick="this.closest(\'.modalOverlay\').remove();showSelect()">再来一局</button></div>';
    document.body.appendChild(o);
  }
}

function onRLDefeat() {
  gameMode = 'local';
}

// ===== 商店 =====
function openRLShop() {
  hideAllRLScreens();
  document.getElementById('shopScreen').style.display = 'flex';
  document.getElementById('shopGold').textContent = '💰 灵石: ' + ROGUELIKE.state.stones;
  document.getElementById('btnLeaveShop').onclick = function() { document.getElementById('shopScreen').style.display='none'; showFloorMap(ROGUELIKE.state.floor); };

  var ctr = document.getElementById('shopItems');
  ctr.innerHTML = '';

  var cards = SCHOOLS[ROGUELIKE.state.school].cards.filter(function(c){ return (c.realm||0) <= ROGUELIKE.state.floor; });
  for (var i = 0; i < 3; i++) {
    var c = shuffle(cards)[0];
    var price = {common:20, uncommon:35, rare:55, legendary:90}[c.rarity||'common'] || 30;
    var el = document.createElement('div');
    el.className = 'shopItem';
    el.innerHTML = '<span class="sIcon">🃏</span><span class="sName">' + c.name + '</span><span class="sPrice">' + price + '灵石</span>';
    el.onclick = function() {
      if (ROGUELIKE.state.stones >= price) {
        ROGUELIKE.state.stones -= price;
        ROGUELIKE.state.runDeck.push(Object.assign({}, c));
        openRLShop();
      }
    };
    ctr.appendChild(el);
  }

  // Remove card
  var rm = document.createElement('div');
  rm.className = 'shopItem';
  rm.innerHTML = '<span class="sIcon">🗑️</span><span class="sName">移除一张牌</span><span class="sPrice">40灵石</span>';
  rm.onclick = function() {
    if (ROGUELIKE.state.stones >= 40 && ROGUELIKE.state.runDeck.length > 5) {
      ROGUELIKE.state.stones -= 40;
      ROGUELIKE.state.runDeck.pop();
      openRLShop();
    }
  };
  ctr.appendChild(rm);
}

// ===== 修炼台 =====
function openRLCampfire() {
  hideAllRLScreens();
  document.getElementById('campfireScreen').style.display = 'flex';
  var ctr = document.getElementById('campfireOptions');
  ctr.innerHTML = '';

  // 升级牌
  var up = document.createElement('div');
  up.className = 'shopItem';
  up.innerHTML = '<span class="sIcon">⬆️</span><span class="sName">升级一张牌</span><span class="sPrice">提升品质</span>';
  up.onclick = function() {
    var order = ['common','uncommon','rare','legendary'];
    for (var i = 0; i < ROGUELIKE.state.runDeck.length; i++) {
      var c = ROGUELIKE.state.runDeck[i];
      var idx = order.indexOf(c.rarity||'common');
      if (idx < 3) { c.rarity = order[idx+1]; break; }
    }
    document.getElementById('campfireScreen').style.display = 'none';
    showFloorMap(ROGUELIKE.state.floor);
  };
  ctr.appendChild(up);

  // 回血
  var heal = document.createElement('div');
  heal.className = 'shopItem';
  heal.innerHTML = '<span class="sIcon">💚</span><span class="sName">打坐疗伤</span><span class="sPrice">下局+8HP</span>';
  heal.onclick = function() {
    ROGUELIKE.state.bonusHP = true;
    document.getElementById('campfireScreen').style.display = 'none';
    showFloorMap(ROGUELIKE.state.floor);
  };
  ctr.appendChild(heal);
}

// ===== 事件 =====
function triggerRLEvent() {
  var events = [
    { text:'一位老修士愿意用一张好牌换你的灵石', btn:'花费20灵石换牌', fn:function(){ if(ROGUELIKE.state.stones>=20){ROGUELIKE.state.stones-=20; var cs=SCHOOLS[ROGUELIKE.state.school].cards.filter(function(c){return(c.rarity||'')==='rare'}); if(cs.length) ROGUELIKE.state.runDeck.push(Object.assign({},shuffle(cs)[0])); log('🔮 获得稀有卡牌！');} } },
    { text:'发现一处灵泉，是否饮用？', btn:'饮用(下局+8HP)', fn:function(){ ROGUELIKE.state.bonusHP=true; log('💧 饮用灵泉！'); } },
    { text:'灵猴偷走了灵石袋！', btn:'追上去(+20灵石)', fn:function(){ ROGUELIKE.state.stones+=20; log('🐒 夺回20灵石！'); } },
  ];
  var ev = shuffle(events)[0];
  var o = document.createElement('div');
  o.className = 'modalOverlay';
  o.innerHTML = '<div class="modalBox"><h2>❓ 奇遇</h2><p>' + ev.text + '</p><button class="modalBtn" id="evBtn">' + ev.btn + '</button></div>';
  document.body.appendChild(o);
  document.getElementById('evBtn').onclick = function() { ev.fn(); o.remove(); showFloorMap(ROGUELIKE.state.floor); };
}

// ===== 遗物 =====
function addRLRelic() {
  var relics = [
    { id:'lxh', name:'灵气环', desc:'每回合+1灵气', icon:'💠' },
    { id:'xdan', name:'仙丹', desc:'首回合+5HP', icon:'💊' },
    { id:'hyj', name:'混元甲', desc:'每回合+2甲', icon:'🛡️' },
  ];
  if (ROGUELIKE.state.relics.length < 3) {
    ROGUELIKE.state.relics.push(shuffle(relics)[0]);
    log('💎 获得遗物！');
  }
}

// ===== Hook endGame =====
var _origEndGameRL = endGame;
endGame = function(g) {
  if (g && g.gameOver) return _origEndGameRL(g);
  _origEndGameRL(g);
  if (gameMode !== 'pve_roguelike') return;
  if (g.winner === g.p) {
    var isElite = g.e.hp > g.e.maxHp - 11;
    var isBoss = _floorNodes[_currentNode] && _floorNodes[_currentNode].type === 'boss';
    if (isBoss) { setTimeout(function(){ onRLBossWin(); }, 300); }
    else { setTimeout(function(){ onRLWin(isElite); }, 300); }
  } else {
    setTimeout(function(){ onRLDefeat(); }, 300);
  }
};

// ===== Hook startPhase for relics =====
var _origStartPhaseRL = startPhase;
startPhase = function(who, opponent) {
  _origStartPhaseRL(who, opponent);
  if (gameMode !== 'pve_roguelike') return;
  if (ROGUELIKE.state && ROGUELIKE.state.bonusHP) {
    who.hp = Math.min(who.maxHp, who.hp + 8);
    ROGUELIKE.state.bonusHP = false;
  }
  if (ROGUELIKE.state && ROGUELIKE.state.relics.length > 0) {
    ROGUELIKE.state.relics.forEach(function(r) {
      if (r.id === 'lxh' && who === game.p) { who.qi = Math.min(who.maxQi, who.qi + 1); }
      if (r.id === 'hyj' && who === game.p) { addArmor(game, who, 2); }
      if (r.id === 'xdan' && !r._used && who === game.p) { r._used = true; heal(game, who, 5); }
    });
  }
};

// ===== 注入UI按钮 =====
// 在选角界面添加"修仙爬塔"按钮
// ===== 初始化 =====
(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ injectRoguelikeHTML(); console.log('🏔️ 修仙爬塔模式就绪'); });
  } else {
    injectRoguelikeHTML();
    console.log('🏔️ 修仙爬塔模式就绪');
  }
})();
