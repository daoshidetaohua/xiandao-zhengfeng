/**
 * 仙道争锋 — 联机服务器
 *
 * 启动方式: node server.js
 * 部署到 Railway/Vercel 后自动运行
 *
 * 玩家只需要打开网址 → 点"联机" → 创建/加入房间 → 开玩
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e6
});

// 提供静态文件
app.use(express.static(path.join(__dirname, '.')));

// ===================== 房间管理 =====================
const rooms = {};
const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS = 4;
const AI_LEVELS = ['简单', '普通', '困难'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms[code]);
  return code;
}

// ===================== 游戏逻辑 =====================
// （精简版 - 用于服务器验证和AI托管）

const REALMS = [
  { name:'练气期', maxHp:30, qiPerTurn:2, breakthroughNeed:3 },
  { name:'筑基期', maxHp:42, qiPerTurn:3, breakthroughNeed:7 },
  { name:'金丹期', maxHp:55, qiPerTurn:4, breakthroughNeed:12 },
  { name:'元婴期', maxHp:70, qiPerTurn:5, breakthroughNeed:18 },
  { name:'化神期', maxHp:85, qiPerTurn:6, breakthroughNeed:99 },
];

const SCHOOLS = ['tianjian','baicao','xingxiu','jingang','minghun'];
const SCHOOL_NAMES = {tianjian:'天剑宗',baicao:'百草谷',xingxiu:'星宿阁',jingang:'金刚门',minghun:'命魂师'};
const SCHOOL_ICONS = {tianjian:'🗡️',baicao:'🌿',xingxiu:'🔮',jingang:'🏛️',minghun:'🏆'};

function tribulationDamage(realmIndex) {
  return (realmIndex + 2) * 4 + 5;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createPlayer(schoolKey, isAI, aiLevel) {
  // 从客户端的卡牌数据中获取卡牌列表
  const cards = getAllCardsForSchool(schoolKey);
  return {
    school: schoolKey,
    isAI: !!isAI,
    aiLevel: aiLevel || 0,
    hp: REALMS[0].maxHp,
    maxHp: REALMS[0].maxHp,
    qi: 2,
    maxQi: 10,
    realm: 0,
    cultivation: 0,
    armor: 0,
    hand: [],
    deck: shuffle(cards.map(c => ({...c}))),
    discard: [],
    swordIntent: 0,
    maxSwordIntent: 6,
    poison: 0,
    herb: 0,
    starTrack: 0,
    vajra: 0,
    soulChains: 0,
    chainLocked: false,
    usedHuitian: false,
    poisonMastery: 0,
    retribution: 0,
    armorPersist: 0,
    invincible: 0,
    nextArmor: 0,
    redirect: 0,
    qiPenalty: 0,
    maxPlayNext: 0,
    noDamageNext: 0,
    playsThisTurn: 0,
    name: '',
    socketId: null,
  };
}

function getAllCardsForSchool(schoolKey) { return CARDS[schoolKey] || []; }

// ===================== 卡牌数据 =====================
// 注意: 保持与客户端一致
const CARDS = {
  tianjian: [
    {id:'qingfeng',name:'青锋斩',cost:1,type:'damage',realm:0,desc:'造成4点伤害'},
    {id:'lianzhan',name:'连斩',cost:2,type:'damage',realm:0,desc:'造成3+3点伤害'},
    {id:'jianqijue',name:'剑气诀',cost:1,type:'damage',realm:0,desc:'造成3伤+1剑意'},
    {id:'xujiianshi',name:'蓄剑式',cost:0,type:'special',realm:0,desc:'+2剑意'},
    {id:'pojunjian',name:'破军剑',cost:2,type:'damage',realm:1,desc:'造成7伤(剑意≥3+3)'},
    {id:'jianwu',name:'剑舞',cost:2,type:'damage',realm:1,desc:'3伤+抽1+1剑意'},
    {id:'wanjianjue',name:'万剑诀',cost:3,type:'damage',realm:2,desc:'剑意×4伤→消耗'},
    {id:'jianxin',name:'剑心通明',cost:2,type:'special',realm:2,desc:'剑意上限+2,抽1'},
    {id:'yijianpo',name:'一剑破万法',cost:4,type:'damage',realm:3,desc:'10+剑意×3→消耗'},
    {id:'fenguang',name:'分光剑影',cost:3,type:'damage',realm:3,desc:'5伤→复制1张'},
    {id:'tianjian',name:'天剑',cost:6,type:'damage',realm:4,desc:'造成20点伤害'},
    {id:'wujian',name:'无剑胜有剑',cost:5,type:'damage',realm:4,desc:'剑意×6→不消耗'},
  ],
  baicao: [
    {id:'duteng',name:'毒藤术',cost:1,type:'special',realm:0,desc:'对手+2中毒'},
    {id:'huichun1',name:'回春术',cost:1,type:'heal',realm:0,desc:'恢复4HP'},
    {id:'caiyao',name:'采药',cost:0,type:'heal',realm:0,desc:'回2HP+1药引'},
    {id:'kurong',name:'枯荣诀',cost:1,type:'special',realm:0,desc:'2伤+1毒+回2HP'},
    {id:'baidu',name:'百毒掌',cost:2,type:'special',realm:1,desc:'+4中毒'},
    {id:'baicaodan',name:'百草丹',cost:2,type:'heal',realm:1,desc:'回7HP+抽1'},
    {id:'wandu',name:'万毒噬心',cost:3,type:'damage',realm:2,desc:'药引×4→消耗'},
    {id:'xuanhu',name:'悬壶济世',cost:2,type:'heal',realm:2,desc:'回5HP+2药引'},
    {id:'dubao',name:'毒爆术',cost:3,type:'damage',realm:3,desc:'引爆中毒每层2伤'},
    {id:'huitian',name:'回天',cost:4,type:'heal',realm:3,desc:'回15HP(限1次)'},
    {id:'shenglun',name:'生死轮回',cost:5,type:'special',realm:4,desc:'+8毒+回10HP'},
    {id:'duwang',name:'毒王功',cost:4,type:'special',realm:4,desc:'每层毒+1伤'},
  ],
  xingxiu: [
    {id:'xinghuo',name:'星火术',cost:1,type:'damage',realm:0,desc:'3伤+1星轨'},
    {id:'tuiyan',name:'推演',cost:1,type:'special',realm:0,desc:'抽1+1星轨'},
    {id:'guaxiang',name:'卦象',cost:0,type:'special',realm:0,desc:'对手弃最高费牌'},
    {id:'tianjibian',name:'天机变',cost:1,type:'special',realm:0,desc:'+2星轨'},
    {id:'douzhuan',name:'斗转星移',cost:2,type:'damage',realm:1,desc:'5伤(耗2星轨再5)'},
    {id:'fengling',name:'封灵符',cost:2,type:'special',realm:1,desc:'对手-2灵'},
    {id:'xingyun',name:'星陨',cost:3,type:'damage',realm:2,desc:'星轨×5→消耗'},
    {id:'tianjizhen',name:'天机阵',cost:2,type:'special',realm:2,desc:'抽2+2星轨'},
    {id:'tianluo',name:'天罗地网',cost:4,type:'special',realm:3,desc:'对手最多出2牌'},
    {id:'qixing',name:'七星续命',cost:3,type:'heal',realm:3,desc:'回8HP+3星轨'},
    {id:'tiandao',name:'天道轮回',cost:6,type:'special',realm:4,desc:'抽3+5星轨+费-1'},
    {id:'xingchen',name:'星辰灭世',cost:5,type:'damage',realm:4,desc:'星轨×6→消耗'},
  ],
  jingang: [
    {id:'tiebi',name:'铁壁',cost:1,type:'defense',realm:0,desc:'+4甲+1金刚印'},
    {id:'jingangquan',name:'金刚拳',cost:1,type:'damage',realm:0,desc:'4伤+2甲'},
    {id:'chanding',name:'禅定',cost:0,type:'defense',realm:0,desc:'+3甲+1金刚印'},
    {id:'numu',name:'怒目',cost:1,type:'damage',realm:0,desc:'3伤+1金刚印'},
    {id:'jinzhong',name:'金钟罩',cost:2,type:'defense',realm:1,desc:'+8甲'},
    {id:'xiangmozhang',name:'降魔掌',cost:2,type:'damage',realm:1,desc:'5伤(每5甲+2)'},
    {id:'jingangnu',name:'金刚怒目',cost:2,type:'special',realm:2,desc:'你受1伤对手3伤'},
    {id:'sheshen',name:'舍身',cost:1,type:'defense',realm:2,desc:'-4HP,+10甲+2印'},
    {id:'bupo',name:'不破金身',cost:3,type:'defense',realm:3,desc:'+10甲,甲不消失'},
    {id:'rulai',name:'如来神掌',cost:3,type:'damage',realm:3,desc:'金刚印×3'},
    {id:'dajingang',name:'大金刚掌',cost:5,type:'damage',realm:4,desc:'护甲值伤'},
    {id:'budong',name:'不动明王真身',cost:6,type:'defense',realm:4,desc:'无敌+下回合12甲'},
  ],
  minghun: [
    {id:'hunsi',name:'魂丝',cost:1,type:'chain',realm:0,desc:'+1魂链'},
    {id:'lingfu',name:'灵缚',cost:1,type:'chain',realm:0,desc:'+1魂链+封灵'},
    {id:'gongming',name:'共鸣',cost:0,type:'chain',realm:0,desc:'+1魂链自伤2'},
    {id:'hundun',name:'魂盾',cost:1,type:'defense',realm:0,desc:'4+链数甲'},
    {id:'suohun',name:'锁魂阵',cost:2,type:'chain',realm:1,desc:'+2魂链回血'},
    {id:'tongming',name:'同命连',cost:2,type:'chain',realm:1,desc:'+1链抽牌'},
    {id:'qihun',name:'七魂索命',cost:3,type:'damage',realm:2,desc:'链数×3伤'},
    {id:'linghun',name:'灵魂共鸣',cost:2,type:'special',realm:2,desc:'每链回3+对手2伤'},
    {id:'fuling',name:'缚灵大阵',cost:2,type:'chain',realm:3,desc:'+1链禁伤害'},
    {id:'hunbao',name:'魂爆',cost:3,type:'damage',realm:3,desc:'消耗链每链5伤'},
    {id:'wanhun',name:'万魂归宗',cost:5,type:'chain',realm:4,desc:'+3链不可移除'},
    {id:'boli',name:'灵魂剥离',cost:6,type:'special',realm:4,desc:'链≥4立即获胜'},
  ],
};

// ===================== Socket.IO 事件处理 =====================

io.on('connection', (socket) => {
  console.log(`🔌 新连接: ${socket.id}`);

  // 创建房间
  socket.on('create_room', ({ name }) => {
    try {
      const roomId = generateRoomCode();
      rooms[roomId] = {
        code: roomId,
        host: socket.id,
        players: [],
        gameState: null,
        turnOrder: [],
        currentTurnIndex: 0,
        started: false,
      };
      rooms[roomId].players.push({
        id: socket.id,
        name: name || '修士',
        school: null,
        ready: false,
        ai: false,
        aiLevel: 0,
      });
      socket.join(roomId);
      socket.emit('room_joined', {
        roomId,
        players: sanitizePlayers(rooms[roomId].players),
        host: socket.id,
      });
      console.log(`📦 创建房间 ${roomId} (${name})`);
    } catch (e) {
      socket.emit('error', { message: '创建房间失败' });
    }
  });

  // 加入房间
  socket.on('join_room', ({ roomId, name }) => {
    try {
      const room = rooms[roomId];
      if (!room) return socket.emit('error', { message: '房间不存在' });
      if (room.players.length >= MAX_PLAYERS) return socket.emit('error', { message: '房间已满' });
      if (room.started) return socket.emit('error', { message: '游戏已开始' });

      room.players.push({
        id: socket.id,
        name: name || '修士',
        school: null,
        ready: false,
        ai: false,
        aiLevel: 0,
      });
      socket.join(roomId);
      socket.emit('room_joined', {
        roomId,
        players: sanitizePlayers(room.players),
        host: room.host,
      });
      io.to(roomId).emit('room_updated', { players: sanitizePlayers(room.players) });
      console.log(`🚪 ${name} 加入房间 ${roomId}`);
    } catch (e) {
      socket.emit('error', { message: '加入房间失败' });
    }
  });

  // 离开房间
  socket.on('leave_room', () => {
    leaveCurrentRoom(socket);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 断开连接: ${socket.id}`);
    leaveCurrentRoom(socket);
  });

  // 聊天消息转发（仅转发文本，不涉及API Key）
  socket.on('chat_message', ({ text, from }) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    socket.to(room.code).emit('chat_message', { text, from: socket.id });
  });

  // 选择流派
  socket.on('set_school', ({ school }) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player && SCHOOLS.includes(school)) {
      player.school = school;
      player.ready = false;
      io.to(room.code).emit('room_updated', { players: sanitizePlayers(room.players) });
    }
  });

  // 准备/取消准备
  socket.on('set_ready', ({ ready }) => {
    const room = findRoomBySocket(socket);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player && player.school) {
      player.ready = !!ready;
      io.to(room.code).emit('room_updated', { players: sanitizePlayers(room.players) });
    }
  });

  // 添加AI
  socket.on('add_ai', ({ level }) => {
    const room = findRoomBySocket(socket);
    if (!room || room.host !== socket.id) return;
    if (room.players.length >= MAX_PLAYERS) return;
    if (room.started) return;

    const aiNames = ['青玄真人','紫霞仙子','天机老人','剑痴','药尊者'];
    const usedNames = room.players.map(p => p.name);
    let aiName = aiNames.find(n => !usedNames.includes(n)) || 'AI修士';

    room.players.push({
      id: 'ai_' + Math.random().toString(36).slice(2, 8),
      name: aiName,
      school: null,
      ready: true,
      ai: true,
      aiLevel: level || 1,
    });
    io.to(room.code).emit('room_updated', { players: sanitizePlayers(room.players) });
  });

  // 移除AI
  socket.on('remove_ai', ({ playerId }) => {
    const room = findRoomBySocket(socket);
    if (!room || room.host !== socket.id) return;
    const idx = room.players.findIndex(p => p.id === playerId && p.ai);
    if (idx >= 0) {
      room.players.splice(idx, 1);
      io.to(room.code).emit('room_updated', { players: sanitizePlayers(room.players) });
    }
  });

  // 开始游戏
  socket.on('start_game', () => {
    const room = findRoomBySocket(socket);
    if (!room || room.host !== socket.id) return;
    if (room.players.length < 2) return socket.emit('error', { message: '至少需要2名玩家' });
    if (room.players.some(p => !p.ai && !p.ready)) return socket.emit('error', { message: '有玩家未准备' });
    if (room.started) return;

    // 给未选流派的AI随机分配
    const availableSchools = shuffle([...SCHOOLS]);
    room.players.forEach(p => {
      if (!p.school) {
        const sc = availableSchools.find(s => !room.players.some(pp => pp.id !== p.id && pp.school === s)) || availableSchools[0];
        p.school = sc;
      }
    });

    room.started = true;
    room.gameState = initGameState(room.players);
    room.turnOrder = room.players.map(p => p.id);
    room.currentTurnIndex = 0;

    io.to(room.code).emit('game_started', {
      players: sanitizePlayers(room.players),
      turnOrder: room.turnOrder,
      firstTurn: room.turnOrder[0],
    });

    // 发送初始状态给每个玩家
    room.players.forEach(p => {
      if (!p.ai) {
        const state = getPlayerState(room, p.id);
        io.to(p.id).emit('game_state', state);
      }
    });

    // 如果第一个是AI，触发AI回合
    processTurn(room);
  });

  // 玩家行动
  socket.on('player_action', ({ action, data }) => {
    const room = findRoomBySocket(socket);
    if (!room || !room.started) return;
    if (room.turnOrder[room.currentTurnIndex] !== socket.id) return;

    const pIdx = room.players.findIndex(p => p.id === socket.id);
    if (pIdx < 0) return;

    const gs = room.gameState;
    const player = gs.players[pIdx];
    const opponents = gs.players.filter((_, i) => i !== pIdx);

    switch (action) {
      case 'play_card':
        if (data.idx >= 0 && data.idx < player.hand.length) {
          playServerCard(room, pIdx, data.idx);
        }
        break;
      case 'cultivate':
        if (player.cultivation < REALMS[player.realm].breakthroughNeed) {
          player.cultivation++;
          player.armor = (player.armor || 0) + 2;
        }
        break;
      case 'breakthrough':
        if (player.realm < 4 && player.cultivation >= REALMS[player.realm].breakthroughNeed) {
          const dmg = tribulationDamage(player.realm);
          player.hp -= dmg;
          if (player.hp <= 0) {
            endGame(room, pIdx);
            return;
          }
          player.realm++;
          player.hp = REALMS[player.realm].maxHp;
          player.maxHp = REALMS[player.realm].maxHp;
          player.cultivation = 0;
        }
        break;
      case 'end_turn':
        // 结算结束阶段
        endPlayerPhase(room, pIdx);
        nextTurn(room);
        return;
    }

    // 广播新状态
    broadcastGameState(room);
    // 检查胜利
    if (!room.gameState) return;

    // 继续当前玩家的回合
    if (action !== 'end_turn') {
      io.to(player.socketId).emit('your_turn');
    }
  });

  // 获取房间列表（调试用）
  socket.on('list_rooms', () => {
    const list = Object.entries(rooms).map(([code, room]) => ({
      code,
      players: sanitizePlayers(room.players).length,
      maxPlayers: MAX_PLAYERS,
      started: room.started,
    }));
    socket.emit('room_list', list);
  });
});

// ===================== 辅助函数 =====================

function sanitizePlayers(players) {
  return players.map(p => ({
    id: p.id,
    name: p.name,
    school: p.school,
    ready: p.ready,
    ai: p.ai,
    aiLevel: p.aiLevel,
  }));
}

function findRoomBySocket(socket) {
  for (const code in rooms) {
    if (rooms[code].players.some(p => p.id === socket.id)) {
      return rooms[code];
    }
  }
  return null;
}

function leaveCurrentRoom(socket) {
  for (const code in rooms) {
    const room = rooms[code];
    const idx = room.players.findIndex(p => p.id === socket.id);
    if (idx >= 0) {
      room.players.splice(idx, 1);
      socket.leave(code);

      if (room.started) {
        // 游戏中断——玩家退出
        room.started = false;
        io.to(code).emit('game_interrupted', { message: '有玩家退出游戏' });
        delete rooms[code];
      } else if (room.players.length === 0) {
        delete rooms[code];
      } else {
        if (room.host === socket.id) {
          room.host = room.players[0].id;
        }
        io.to(code).emit('room_updated', { players: sanitizePlayers(room.players), host: room.host });
      }
      console.log(`🚪 玩家离开房间 ${code}`);
      return;
    }
  }
}

function initGameState(players) {
  const gs = {
    players: players.map(p => {
      const pl = createPlayer(p.school, p.ai, p.aiLevel);
      pl.name = p.name;
      pl.socketId = p.id;
      pl.school = p.school;
      // 抽初始手牌
      for (let i = 0; i < 5; i++) {
        if (pl.deck.length) pl.hand.push(pl.deck.pop());
        else break;
      }
      return pl;
    }),
    turn: 0,
    phase: 'action',
    gameOver: false,
    winner: null,
  };
  return gs;
}

function getPlayerState(room, socketId) {
  const pIdx = room.players.findIndex(p => p.id === socketId);
  if (pIdx < 0) return null;
  const gs = room.gameState;
  if (!gs) return null;

  const myPlayer = gs.players[pIdx];
  const opponentStates = gs.players.filter((_, i) => i !== pIdx).map(opp => ({
    name: opp.name,
    school: opp.school,
    hp: opp.hp,
    maxHp: opp.maxHp,
    armor: opp.armor,
    realm: opp.realm,
    handCount: opp.hand.length,
    soulChains: opp.soulChains || 0,
    poison: opp.poison || 0,
    swordIntent: opp.swordIntent || 0,
    starTrack: opp.starTrack || 0,
    vajra: opp.vajra || 0,
    herb: opp.herb || 0,
  }));

  return {
    me: {
      name: myPlayer.name,
      school: myPlayer.school,
      hp: myPlayer.hp,
      maxHp: myPlayer.maxHp,
      armor: myPlayer.armor || 0,
      realm: myPlayer.realm,
      qi: myPlayer.qi,
      maxQi: myPlayer.maxQi,
      cultivation: myPlayer.cultivation,
      hand: myPlayer.hand,
      deckCount: myPlayer.deck.length,
      discardCount: myPlayer.discard.length,
      soulChains: myPlayer.soulChains || 0,
      swordIntent: myPlayer.swordIntent || 0,
      poison: myPlayer.poison || 0,
      starTrack: myPlayer.starTrack || 0,
      vajra: myPlayer.vajra || 0,
      herb: myPlayer.herb || 0,
      chainLocked: myPlayer.chainLocked || false,
    },
    opponents: opponentStates,
    turnOf: room.turnOrder[room.currentTurnIndex],
    turnCount: gs.turn,
    gameOver: gs.gameOver,
    winner: gs.winner,
  };
}

function broadcastGameState(room) {
  if (!room.gameState || !room.started) return;
  room.players.forEach(p => {
    if (!p.ai) {
      const state = getPlayerState(room, p.id);
      io.to(p.id).emit('game_state', state);
    }
  });
}

function endGame(room, loserIdx) {
  if (!room.gameState) return;
  room.gameState.gameOver = true;
  const winnerCandidates = room.gameState.players.filter((_, i) => i !== loserIdx && _.hp > 0);
  room.gameState.winner = winnerCandidates.length > 0 ? winnerCandidates[0].socketId : null;
  broadcastGameState(room);
  io.to(room.code).emit('game_over', {
    winner: room.gameState.winner,
    winnerName: winnerCandidates.length > 0 ? winnerCandidates[0].name : null,
  });
  // 延迟清理房间
  setTimeout(() => { delete rooms[room.code]; }, 30000);
}

// ===================== 服务器端游戏逻辑 =====================

function findCardInList(id, list) {
  return list.find(c => c.id === id);
}

function playServerCard(room, pIdx, cardIdx) {
  const gs = room.gameState;
  const player = gs.players[pIdx];
  if (!player || cardIdx >= player.hand.length) return;
  const card = player.hand[cardIdx];
  if (player.qi < card.cost) return;

  // 限制检查
  if (player.noDamageNext > 0 && card.type === 'damage') return;

  player.qi -= card.cost;
  player.hand.splice(cardIdx, 1);

  // 执行卡牌效果（简化版——只处理关键效果）
  executeServerCardEffect(room, pIdx, card);

  player.discard.push(card);
  player.playsThisTurn = (player.playsThisTurn || 0) + 1;

  // 金丹被动
  if (player.realm >= 2 && player.playsThisTurn % 3 === 0 && card.type === 'damage') {
    const target = getFirstOpponent(room, pIdx);
    if (target) target.hp = Math.max(0, target.hp - 2);
  }

  // 检查胜利
  gs.players.forEach((p, i) => {
    if (p.hp <= 0 && !gs.gameOver) {
      endGame(room, i);
    }
  });
}

function executeServerCardEffect(room, pIdx, card) {
  const gs = room.gameState;
  const player = gs.players[pIdx];
  const target = getFirstOpponent(room, pIdx);
  if (!target) return;

  switch (card.id) {
    // 天剑宗
    case 'qingfeng': target.hp = Math.max(0, target.hp - 4); break;
    case 'lianzhan': target.hp = Math.max(0, target.hp - 3); target.hp = Math.max(0, target.hp - 3); break;
    case 'jianqijue': target.hp = Math.max(0, target.hp - 3); player.swordIntent = Math.min(6, (player.swordIntent||0)+1); break;
    case 'xujiianshi': player.swordIntent = Math.min(6, (player.swordIntent||0)+2); break;
    case 'pojunjian': { let d = 7; if ((player.swordIntent||0) >= 3) d += 3; target.hp = Math.max(0, target.hp - d); } break;
    case 'jianwu': target.hp = Math.max(0, target.hp - 3); if (player.deck.length) player.hand.push(player.deck.pop()); player.swordIntent = Math.min(6, (player.swordIntent||0)+1); break;
    case 'wanjianjue': { let n = (player.swordIntent||0)*4; player.swordIntent=0; target.hp = Math.max(0, target.hp - n); } break;
    case 'jianxin': player.maxSwordIntent = (player.maxSwordIntent||6)+2; if (player.deck.length) player.hand.push(player.deck.pop()); break;
    case 'yijianpo': { let n = 10+(player.swordIntent||0)*3; player.swordIntent=0; target.hp = Math.max(0, target.hp - n); } break;
    case 'fenguang': target.hp = Math.max(0, target.hp - 5); if (player.hand.length < 9) player.hand.push({...card}); break;
    case 'tianjian': target.hp = Math.max(0, target.hp - 20); break;
    case 'wujian': { let n = (player.swordIntent||0)*6; target.hp = Math.max(0, target.hp - n); } break;

    // 百草谷
    case 'duteng': target.poison = (target.poison||0)+2; break;
    case 'huichun1': player.hp = Math.min(player.maxHp, player.hp + Math.ceil(4*1.2)); break;
    case 'caiyao': player.hp = Math.min(player.maxHp, player.hp+Math.ceil(2*1.2)); player.herb=(player.herb||0)+1; break;
    case 'kurong': target.hp = Math.max(0, target.hp-2); target.poison=(target.poison||0)+1; player.hp = Math.min(player.maxHp, player.hp+Math.ceil(2*1.2)); break;
    case 'baidu': target.poison = (target.poison||0)+4; break;
    case 'baicaodan': player.hp = Math.min(player.maxHp, player.hp+Math.ceil(7*1.2)); if (player.deck.length) player.hand.push(player.deck.pop()); break;
    case 'wandu': { let n = (player.herb||0)*4; player.herb=0; target.hp = Math.max(0, target.hp - n); } break;
    case 'xuanhu': player.hp = Math.min(player.maxHp, player.hp+Math.ceil(5*1.2)); player.herb=(player.herb||0)+2; break;
    case 'dubao': { let n = (target.poison||0)*2; target.poison=0; target.hp = Math.max(0, target.hp - n); } break;
    case 'huitian': if (!player.usedHuitian) { player.hp = Math.min(player.maxHp, player.hp+Math.ceil(15*1.2)); player.usedHuitian=true; } break;
    case 'shenglun': target.poison=(target.poison||0)+8; player.hp = Math.min(player.maxHp, player.hp+Math.ceil(10*1.2)); break;
    case 'duwang': player.poisonMastery=(player.poisonMastery||0)+1; break;

    // 星宿阁
    case 'xinghuo': target.hp = Math.max(0, target.hp-3); player.starTrack=(player.starTrack||0)+1; break;
    case 'tuiyan': if (player.deck.length) player.hand.push(player.deck.pop()); player.starTrack=(player.starTrack||0)+1; break;
    case 'guaxiang': { let hc = target.hand; if (hc.length) { let mi = 0; hc.forEach((c,i)=>{if (c.cost > hc[mi].cost) mi=i;}); target.discard.push(hc.splice(mi,1)[0]); } } break;
    case 'tianjibian': player.starTrack=(player.starTrack||0)+2; break;
    case 'douzhuan': target.hp = Math.max(0, target.hp-5); if ((player.starTrack||0)>=2) { player.starTrack-=2; target.hp = Math.max(0, target.hp-5); } break;
    case 'fengling': player.qiPenalty = (player.qiPenalty||0) + 2; break;
    case 'xingyun': { let n = (player.starTrack||0)*5; player.starTrack=0; target.hp = Math.max(0, target.hp - n); } break;
    case 'tianjizhen': for(let i=0;i<2&&player.deck.length;i++) player.hand.push(player.deck.pop()); player.starTrack=(player.starTrack||0)+2; break;
    case 'tianluo': target.maxPlayNext = (target.maxPlayNext||0) + 2; break;
    case 'qixing': player.hp = Math.min(player.maxHp, player.hp+8); player.starTrack=(player.starTrack||0)+3; break;
    case 'tiandao': for(let i=0;i<3&&player.deck.length;i++) player.hand.push(player.deck.pop()); player.starTrack=(player.starTrack||0)+5; player.hand.forEach(c=>{if(c.cost>0)c.cost=Math.max(0,c.cost-1);}); break;
    case 'xingchen': { let n = (player.starTrack||0)*6; player.starTrack=0; target.hp = Math.max(0, target.hp - n); } break;

    // 金刚门
    case 'tiebi': player.armor=(player.armor||0)+4; player.vajra=(player.vajra||0)+1; break;
    case 'jingangquan': target.hp = Math.max(0, target.hp-4); player.armor=(player.armor||0)+2; break;
    case 'chanding': player.armor=(player.armor||0)+3; player.vajra=(player.vajra||0)+1; break;
    case 'numu': target.hp = Math.max(0, target.hp-3); player.vajra=(player.vajra||0)+1; break;
    case 'jinzhong': player.armor=(player.armor||0)+8; break;
    case 'xiangmozhang': { let bonus = Math.floor((player.armor||0)/5)*2; target.hp = Math.max(0, target.hp-(5+bonus)); } break;
    case 'jingangnu': player.retribution = (player.retribution||0)+1; break;
    case 'sheshen': player.hp = Math.max(1, player.hp-4); player.armor=(player.armor||0)+10; player.vajra=(player.vajra||0)+2; break;
    case 'bupo': player.armor=(player.armor||0)+10; player.armorPersist=(player.armorPersist||0)+1; break;
    case 'rulai': { let n = (player.vajra||0)*3; target.hp = Math.max(0, target.hp-n); } break;
    case 'dajingang': { let a = player.armor||0; player.armor = Math.floor(a/2); player.vajra=(player.vajra||0)+Math.floor(a/2); target.hp = Math.max(0, target.hp-a); } break;
    case 'budong': player.invincible=(player.invincible||0)+1; player.nextArmor=12; break;

    // 命魂师
    case 'hunsi': if ((player.soulChains||0)<5) player.soulChains=(player.soulChains||0)+1; break;
    case 'lingfu': if ((player.soulChains||0)<5) { player.soulChains=(player.soulChains||0)+1; target.qiPenalty=(target.qiPenalty||0)+(player.soulChains||0); } break;
    case 'gongming': if ((player.soulChains||0)<5) { player.soulChains=(player.soulChains||0)+1; player.hp=Math.max(1,player.hp-2); } break;
    case 'hundun': player.armor=(player.armor||0)+4+(player.soulChains||0); break;
    case 'suohun': for(let i=0;i<2&&(player.soulChains||0)<5;i++) player.soulChains=(player.soulChains||0)+1; player.hp = Math.min(player.maxHp, player.hp+(player.soulChains||0)*2); break;
    case 'tongming': if ((player.soulChains||0)<5) player.soulChains=(player.soulChains||0)+1; for(let i=0;i<1+(player.soulChains||0)&&player.deck.length;i++) player.hand.push(player.deck.pop()); break;
    case 'qihun': { let n = (player.soulChains||0)*3; target.hp = Math.max(0, target.hp-n); } break;
    case 'linghun': { let n = player.soulChains||0; player.hp = Math.min(player.maxHp, player.hp+n*3); target.hp = Math.max(0, target.hp-n*2); } break;
    case 'fuling': if ((player.soulChains||0)<5) player.soulChains=(player.soulChains||0)+1; target.noDamageNext=(target.noDamageNext||0)+1; break;
    case 'hunbao': { let n = (player.soulChains||0)*5; player.soulChains=0; target.hp = Math.max(0, target.hp-n); } break;
    case 'wanhun': for(let i=0;i<3&&(player.soulChains||0)<5;i++) player.soulChains=(player.soulChains||0)+1; player.chainLocked=true; break;
    case 'boli': if ((player.soulChains||0)>=4) { let winner = pIdx; gs.gameOver=true; gs.winner=player.socketId; } break;
  }

  // 魂链反射
  if (target.soulChains >= 1 && target !== player) {
    const reflect = Math.floor((card.cost) * 0.5 * target.soulChains / 3);
    if (reflect > 0) player.hp = Math.max(0, player.hp - reflect);
  }
}

function getFirstOpponent(room, pIdx) {
  return room.gameState.players.find((_, i) => i !== pIdx && _.hp > 0);
}

function endPlayerPhase(room, pIdx) {
  const gs = room.gameState;
  const player = gs.players[pIdx];

  // 中毒伤害
  if (player.poison > 0) {
    let extra = 0;
    gs.players.forEach(p => { if (p !== player && p.poisonMastery) extra += player.poison * p.poisonMastery; });
    player.hp = Math.max(0, player.hp - (player.poison + extra));
  }

  // 魂链伤害
  gs.players.forEach((p, i) => {
    if (p !== player && p.soulChains > 0) {
      player.hp = Math.max(0, player.hp - p.soulChains);
    }
  });

  // 弃牌到上限
  const maxHand = 7 + (player.school === 'xingxiu' ? 2 : 0);
  while (player.hand.length > maxHand) player.discard.push(player.hand.pop());

  // 护甲
  if (player.realm >= 3 && player.armor > 0 && !player.armorPersist) player.armor = Math.min(player.armor, 3);
  else if (!player.armorPersist) player.armor = 0;

  player.armorPersist = 0;
  player.invincible = 0;
  player.redirect = 0;
  player.playsThisTurn = 0;
  player.maxPlayNext = 0;
  player.noDamageNext = 0;

  // 检查胜利
  if (player.hp <= 0) endGame(room, pIdx);
}

function nextTurn(room) {
  if (!room.gameState || room.gameState.gameOver) return;

  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  room.gameState.turn++;

  // 新回合开始阶段
  const pIdx = room.currentTurnIndex;
  const player = room.gameState.players[pIdx];

  const realm = REALMS[player.realm];
  let qiGain = realm.qiPerTurn - (player.qiPenalty || 0);
  if (qiGain < 1) qiGain = 1;
  player.qi = Math.min(player.maxQi, player.qi + qiGain);
  player.qiPenalty = 0;

  for (let i = 0; i < 2 + (player.realm >= 4 ? 1 : 0); i++) {
    if (player.deck.length) player.hand.push(player.deck.pop());
    else {
      player.deck = shuffle(player.discard.splice(0));
      if (player.deck.length) player.hand.push(player.deck.pop());
    }
  }

  if (player.realm >= 1) player.hp = Math.min(player.maxHp, player.hp + 2);
  if (player.school === 'jingang') player.armor = (player.armor || 0) + 2;

  broadcastGameState(room);

  // 通知所有玩家轮到谁了
  room.players.forEach((rp, i) => {
    if (rp.ai) return;
    if (i === pIdx) {
      io.to(rp.id).emit('your_turn');
    } else {
      io.to(rp.id).emit('enemy_turn');
    }
  });
  // AI回合
  if (room.players[pIdx].ai) {
    setTimeout(() => processAITurn(room), 500);
  }
}

function processTurn(room) {
  if (!room.gameState || room.gameState.gameOver) return;
  const pIdx = room.currentTurnIndex;
  const roomPlayer = room.players[pIdx];

  // 通知所有玩家
  room.players.forEach((rp, i) => {
    if (rp.ai) return;
    if (i === pIdx) {
      io.to(rp.id).emit('your_turn');
    } else {
      io.to(rp.id).emit('enemy_turn');
    }
  });

  if (roomPlayer.ai) {
    setTimeout(() => processAITurn(room), 300);
  }
}

// ===================== AI 逻辑（服务器端） =====================

function processAITurn(room) {
  if (!room.gameState || room.gameState.gameOver) return;
  const pIdx = room.currentTurnIndex;
  const player = room.gameState.players[pIdx];
  const lvl = player.aiLevel || 1;

  // AI出牌逻辑（简化版）
  let played = false;

  // 命魂师优先铺链
  if (player.school === 'minghun' && (player.soulChains||0) < 4) {
    const chainIdx = player.hand.findIndex(c => c.type === 'chain' && c.cost <= player.qi);
    if (chainIdx >= 0) { playServerCard(room, pIdx, chainIdx); played = true; }
  }

  // 打出伤害牌
  if (!played) {
    const dmgCandidates = player.hand
      .map((c,i) => ({card:c, idx:i}))
      .filter(x => (x.card.type === 'damage' || x.card.type === 'special') && x.card.cost <= player.qi)
      .sort((a,b) => b.card.cost - a.card.cost);

    if (dmgCandidates.length > 0) {
      playServerCard(room, pIdx, dmgCandidates[0].idx);
      played = true;
    }
  }

  // 防御/回复
  if (!played && player.hp < player.maxHp * 0.5) {
    const defIdx = player.hand.findIndex(c =>
      (c.type === 'defense' || c.type === 'heal') && c.cost <= player.qi);
    if (defIdx >= 0) { playServerCard(room, pIdx, defIdx); played = true; }
  }

  // 修炼
  if (!played && player.qi >= 1 && player.cultivation < REALMS[player.realm].breakthroughNeed) {
    player.cultivation++;
    player.armor = (player.armor || 0) + 2;
    played = true;
  }

  // 突破
  if (player.cultivation >= REALMS[player.realm].breakthroughNeed && player.realm < 4 && player.hp > 15) {
    const dmg = tribulationDamage(player.realm);
    if (player.hp > dmg + 5) {
      player.hp -= dmg;
      player.realm++;
      player.hp = REALMS[player.realm].maxHp;
      player.maxHp = REALMS[player.realm].maxHp;
      player.cultivation = 0;
    }
  }

  broadcastGameState(room);

  // 结束AI回合
  setTimeout(() => {
    if (!room.gameState || room.gameState.gameOver) return;
    endPlayerPhase(room, pIdx);
    if (!room.gameState || room.gameState.gameOver) return;
    nextTurn(room);
  }, 400);
}

// ===================== 启动服务器 =====================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🏔️ 仙道争锋 联机服务器启动！`);
  console.log(`📡 地址: http://localhost:${PORT}`);
  console.log(`📱 手机同局域网访问: http://<本机IP>:${PORT}`);
  console.log(`🚀 部署到云端后分享链接即可开玩！\n`);
});
