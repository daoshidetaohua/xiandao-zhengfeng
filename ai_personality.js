/**
 * ============================================================
 *  仙道争锋 — 多用户 AI 大模型系统
 *  ai_personality.js
 *  
 *  安全设计：
 *  - API Key 存储在 browser localStorage，永不上传服务器
 *  - 单人模式：用你的 Key 驱动对手 AI 的对话
 *  - 联机模式：双方各自用自己 Key，对话通过消息转发
 *  - 群仙乱斗：你的 Key 驱动对手 AI 人格发言
 * ============================================================
 */

// ===== 0. 配置 =====
// 默认不配，由用户自己在界面输入
var DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
var DEEPSEEK_MODEL = 'deepseek-chat';

// 从 localStorage 加载 Key
var _userApiKey = null;
function getUserApiKey() {
  if (_userApiKey) return _userApiKey;
  try {
    _userApiKey = localStorage.getItem('xiandao_apikey') || '';
  } catch(e) { _userApiKey = ''; }
  return _userApiKey;
}
function setUserApiKey(key) {
  _userApiKey = key || '';
  try {
    if (key) localStorage.setItem('xiandao_apikey', key);
    else localStorage.removeItem('xiandao_apikey');
  } catch(e) {}
}
function hasApiKey() {
  var k = getUserApiKey();
  return k && k.length > 10;
}

// ===== 1. 五大人格 =====
var AI_PERSONALITIES = {
  auto: { name:'随机', icon:'🎲', color:'#a09080', voice:{rate:1,pitch:1}, systemPrompt:'' },
  jianchi: {
    name:'剑痴', icon:'🗡️', color:'#ff6040', title:'热血剑狂',
    voice:{rate:1.15,pitch:1.1},
    systemPrompt:
      '你扮演【剑痴】——天剑宗狂热剑修。\n'+
      '性格：热血、冲动、话多、爱嘲讽。\n'+
      '规则：只说中文对话，不加动作描述，每句≤15字。',
  },
  yaozun: {
    name:'药尊者', icon:'🌿', color:'#40c060', title:'青莲药仙',
    voice:{rate:0.9,pitch:0.85},
    systemPrompt:
      '你扮演【药尊者】——百草谷炼药宗师。\n'+
      '性格：沉稳老练、像老中医、偶尔说教。\n'+
      '规则：只说中文对话，不加动作描述，每句≤15字。',
  },
  tianji: {
    name:'天机老人', icon:'🔮', color:'#8060e0', title:'玄机子',
    voice:{rate:0.85,pitch:0.7},
    systemPrompt:
      '你扮演【天机老人】——星宿阁占卜大师。\n'+
      '性格：神秘、话中藏玄机、爱预言。\n'+
      '规则：只说中文对话，不加动作描述，每句≤15字。',
  },
  mingwang: {
    name:'不动明王', icon:'🏛️', color:'#ffd080', title:'金刚护法',
    voice:{rate:0.8,pitch:0.6},
    systemPrompt:
      '你扮演【不动明王】——金刚门护法高僧。\n'+
      '性格：寡言、威严、惜字如金。\n'+
      '规则：只说中文对话，字数越少越好，不加描述。',
  },
  hunzun: {
    name:'命魂尊者', icon:'🏆', color:'#a060e0', title:'灵魂之主',
    voice:{rate:0.95,pitch:0.9},
    systemPrompt:
      '你扮演【命魂尊者】——灵魂之力的掌控者。\n'+
      '性格：阴冷、邪魅、用灵魂比喻一切。\n'+
      '规则：只说中文对话，不加动作描述，每句≤15字。',
  },
};

// 预设语录 fallback（配了 Key 的人用 LLM，没配的用这个）
var FALLBACK_LINES = {
  jianchi: {
    start:['来！与我一战！','剑下不留情！','吾之剑，斩断一切！'],
    taunt:['就这？','我徒弟都比你强！','剑不是这么用的！'],
    win:['剑道之巅，唯我独尊！','你的剑，太慢了！'],
    lose:['好剑法……认输了。','来日必报此败！'],
  },
  yaozun: {
    start:['万物皆可为药。','以毒攻毒，以柔克刚。'],
    taunt:['你中毒了，不知道吗？','年轻人莫要气盛。'],
    win:['你的毒抗还需修炼。','治病救人也是修行。'],
    lose:['技不如人……惭愧。','该回去重炼丹药了。'],
  },
  tianji: {
    start:['天机不可泄露……但你败局已定。','星辰告诉我，你会输。'],
    taunt:['每一步都被算到了。','格局小了。'],
    win:['看到了吗？这就是天命。'],
    lose:['天机果然不可尽信……','算漏了一着。'],
  },
  mingwang: {
    start:['……来吧。','吾不动如山。'],
    taunt:['聒噪。','废话少说。'],
    win:['阿弥陀佛。','善哉。'],
    lose:['……因果循环。'],
  },
  hunzun: {
    start:['你的灵魂……很美味。','命运之线已在我手中。'],
    taunt:['灵魂强度只有这么点？','魂链在收紧哦。'],
    win:['你的灵魂我收下了。','命运不偏袒弱者。'],
    lose:['灵魂……散了……'],
  },
};

// ===== 2. DeepSeek API 调用 =====
function callDeepSeek(systemPrompt, userMessage, scene, callback) {
  var key = getUserApiKey();
  if (!key || key.length < 10) {
    callback(null);
    return;
  }

  var messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: messages,
      max_tokens: 50,
      temperature: 0.9,
    }),
  }).then(function(res) {
    if (!res.ok) throw new Error('API ' + res.status);
    return res.json();
  }).then(function(data) {
    var reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content.trim()
      : null;
    if (reply) {
      reply = reply.replace(/^["'「『]/,'').replace(/["'」』]$/,'');
    }
    callback(reply);
  }).catch(function(err) {
    console.warn('DeepSeek调用失败:', err.message);
    callback(null);
  });
}

// 获取回复（优先 LLM，回退预设）
function getAIResponse(personalityKey, scene, context, callback) {
  var p = AI_PERSONALITIES[personalityKey] || AI_PERSONALITIES.jianchi;
  if (personalityKey === 'auto') {
    var keys = Object.keys(AI_PERSONALITIES).filter(function(k){return k!=='auto';});
    p = AI_PERSONALITIES[keys[Math.floor(Math.random()*keys.length)]];
    personalityKey = keys[Math.floor(Math.random()*keys.length)];
  }

  callDeepSeek(p.systemPrompt, context, scene, function(llmReply) {
    if (llmReply) {
      callback(llmReply);
      return;
    }
    // Fallback
    var fb = FALLBACK_LINES[personalityKey] || FALLBACK_LINES.jianchi;
    var pool = fb[scene] || fb.taunt || fb.start;
    if (pool && pool.length > 0) {
      callback(pool[Math.floor(Math.random() * pool.length)]);
    } else {
      callback('……');
    }
  });
}

// ===== 3. 全局状态 =====
var selectedAIPersonality = 'auto';
var voiceEnabled = true;
var chatVisible = false;
var synth = null;

// PvP联机模式下完全禁止AI对话
function isPvP(){return typeof gameMode!=='undefined' && gameMode==='pvp';}
function isChatAllowed(){return !isPvP();}


// ===== 4. 聊天UI =====
function initChatSystem() {
  var openBtn  = document.getElementById('btnOpenChat');
  var closeBtn = document.getElementById('btnChatToggle');
  var sendBtn  = document.getElementById('btnChatSend');
  var input    = document.getElementById('chatInput');
  var vBtn     = document.getElementById('btnVoiceToggle');
  var mBtn     = document.getElementById('btnVoiceInput');
  if (!openBtn) return;
  openBtn.onclick  = function(){ chatVisible=true; document.getElementById('chatPanel').style.display='flex'; openBtn.style.display='none'; };
  if(closeBtn) closeBtn.onclick = function(){ chatVisible=false; document.getElementById('chatPanel').style.display='none'; openBtn.style.display='block'; };
  if(sendBtn)  sendBtn.onclick  = sendChatMsg;
  if(input)    input.onkeydown  = function(e){ if(e.key==='Enter') sendChatMsg(); };
  if(vBtn)     vBtn.onclick     = function(){ voiceEnabled=!voiceEnabled; vBtn.textContent=voiceEnabled?'🔊':'🔇'; vBtn.style.color=voiceEnabled?'#605040':'#ff4040'; };
  if(mBtn)     mBtn.onclick     = startVoiceInput;
}

function sendChatMsg() {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  playerChat(text);
}

function addChatMsg(who, text, color) {
  var msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  var p = AI_PERSONALITIES[selectedAIPersonality] || AI_PERSONALITIES.jianchi;
  var bg = who === 'ai' ? 'rgba(40,20,60,0.6)' : (who === 'opponent' ? 'rgba(60,20,20,0.6)' : 'rgba(20,40,60,0.6)');
  var label = who === 'ai' ? (p.icon + ' ' + p.name) : (who === 'opponent' ? '🌐 对手' : '🧑 你');
  var c = who === 'ai' ? (color || p.color) : (who === 'opponent' ? '#ff6060' : '#60a0f0');
  var el = document.createElement('div');
  el.style.cssText = 'margin:3px 0;padding:4px 8px;border-radius:6px;background:' + bg;
  el.innerHTML = '<span style="font-weight:600;color:' + c + ';font-size:0.65rem">' + label + '：</span>' +
    '<span style="color:#c0b0a0;font-size:0.68rem">' + text + '</span>';
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

// ===== 5. 语音 =====
function initSpeech() {
  if (typeof window.speechSynthesis !== 'undefined') synth = window.speechSynthesis;
}
function speakAI(text) {
  if (!synth || !voiceEnabled || !text) return;
  synth.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  var p = AI_PERSONALITIES[selectedAIPersonality] || AI_PERSONALITIES.jianchi;
  u.rate = p.voice.rate || 1;
  u.pitch = p.voice.pitch || 1;
  u.volume = 0.6;
  synth.speak(u);
}
function startVoiceInput() {
  var R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) { addChatMsg('system', '浏览器不支持语音输入', '#ff6040'); return; }
  var rec = new R();
  rec.lang = 'zh-CN';
  rec.interimResults = false;
  var mBtn = document.getElementById('btnVoiceInput');
  if (mBtn) mBtn.textContent = '🔴';
  rec.start();
  rec.onresult = function(e) {
    document.getElementById('chatInput').value = e.results[0][0].transcript;
    sendChatMsg();
    if (mBtn) mBtn.textContent = '🎤';
  };
  rec.onerror = rec.onend = function() { if (mBtn) mBtn.textContent = '🎤'; };
}

// ===== 6. 联机聊天转发 =====
// 联机时对方消息通过服务器转发，各端用自己的 Key 生成 AI 回复
var _origSocketOn = null;
function setupMultiplayerChat() {
  if (typeof io === 'undefined' || !window.socket) return;
  window.socket.on('chat_message', function(data) {
    // 收到对方的聊天消息
    if (data.from !== window.socket.id) {
      addChatMsg('opponent', data.text);
      if (voiceEnabled) speakAI(data.text);
    }
  });
}

// ===== 7. 游戏事件 → AI发言 =====
function aiSay(scene, context) { if(isPvP())return;
  if (!chatVisible) return;
  var p = AI_PERSONALITIES[selectedAIPersonality] || AI_PERSONALITIES.jianchi;
  if (document.getElementById('chatTitle')) {
    document.getElementById('chatTitle').textContent = '💬 ' + p.name + (p.title ? '·' + p.title : '');
  }
  getAIResponse(selectedAIPersonality, scene, context, function(reply) {
    addChatMsg('ai', reply, p.color);
    if (voiceEnabled) speakAI(reply);
    // 联机时转发给对方
    if (typeof window.socket !== 'undefined' && window.socket && window.socket.connected) {
      window.socket.emit('chat_message', { text: reply, from: window.socket.id });
    }
  });
}

function playerChat(text) {
  addChatMsg('player', text);
  // 联机时转发
  if (typeof window.socket !== 'undefined' && window.socket && window.socket.connected) {
    window.socket.emit('chat_message', { text: text, from: window.socket.id });
  }
  // AI 回复
  getAIResponse(selectedAIPersonality, 'taunt', '对手对你说：「' + text + '」，请用你的性格回复（≤15字）', function(reply) {
    addChatMsg('ai', reply);
    if (voiceEnabled) speakAI(reply);
    if (typeof window.socket !== 'undefined' && window.socket && window.socket.connected) {
      window.socket.emit('chat_message', { text: reply, from: window.socket.id });
    }
  });
}

// ===== 8. Hook 游戏函数 =====
// 伤害检测
var _origLog3 = log;
var _accumDmg = 0;
log = function(msg, type) {
  _origLog3(msg, type);
  if(isPvP()) return;
  if (type === 'damage' && msg.indexOf('对手受到') >= 0) {
    var m = msg.match(/受到(\d+)点伤害/);
    if (m && parseInt(m[1]) >= 6) {
      _accumDmg += parseInt(m[1]);
      if (_accumDmg >= 10) { _accumDmg = 0; aiSay('takeDamage', '对手刚才对你造成了一次重击，请做出反应（≤15字）'); }
    }
  }
};

// 对局结束
var _origEndGame3 = endGame;
endGame = function(g) {
  if (g && g.gameOver) return _origEndGame3(g);
  var aiWon = g && g.winner === g.e;
  _origEndGame3(g);
  if (!isPvP()) {
    setTimeout(function() {
      if (chatVisible) aiSay(aiWon ? 'win' : 'lose', aiWon ? '你赢了！说句胜利宣言（≤15字）' : '你输了，说句失败感言（≤15字）');
    }, 500);
  }
};

// 新对局
var _origNewGame3 = newGame;
newGame = function() {
  var ret = _origNewGame3.apply(this, arguments);
  _accumDmg = 0;
  if (gameMode !== 'pvp') {
    var ob = document.getElementById('btnOpenChat');
    if (ob) ob.style.display = 'block';
    var cp = document.getElementById('chatPanel');
    if (cp) cp.style.display = 'none';
    chatVisible = false;
    setTimeout(function() { aiSay('start', '对战刚开始，请说一句开场白（≤15字，符合你人设）'); }, 1200);
  } else {
    var ob2 = document.getElementById('btnOpenChat');
    if (ob2) ob2.style.display = 'block';
    setupMultiplayerChat();
  }
  return ret;
};

// AI出牌
var _origAITurn3 = aiTurn;
aiTurn = function(g) {
  var before = g.e.hand.length;
  _origAITurn3(g);
  if (chatVisible && before > g.e.hand.length && g.e.discard.length > 0) {
    var c = g.e.discard[g.e.discard.length - 1];
    if (c.cost >= 3 || c.type === 'chain' || c.type === 'heal') {
      setTimeout(function() {
        aiSay('playCard', '你刚出了一张牌【' + c.name + '】，针对它说句台词（≤15字）');
      }, 400);
    }
  }
};

// 人格选择按钮
var _origBindUI4 = bindUI;
bindUI = function() {
  _origBindUI4();
  var btns = document.querySelectorAll('#aiPersonalityBtns button');
  for (var i = 0; i < btns.length; i++) {
    btns[i].onclick = function() {
      selectedAIPersonality = this.dataset.ai;
      for (var j = 0; j < btns.length; j++) btns[j].classList.remove('chosen');
      this.classList.add('chosen');
    };
  }

  // API Key 管理
  var inp = document.getElementById('aiApiKeyInput');
  var save = document.getElementById('btnSaveApiKey');
  var st = document.getElementById('apiKeyStatus');

  // 从 localStorage 加载
  if (inp) {
    var saved = getUserApiKey();
    if (saved) { inp.value = saved; if (st) st.textContent = '✓ 已加载'; }
  }

  if (save && inp) {
    save.onclick = function() {
      var v = inp.value.trim();
      setUserApiKey(v);
      if (v) {
        if (st) st.textContent = '✓ 已保存（仅本设备）';
        console.log('🤖 AI Key 已保存（仅存储在本地浏览器）');
      } else {
        if (st) st.textContent = '✗ 已清除';
      }
    };
  }
};

// 选角界面
var _origShowSelect3 = showSelect;
showSelect = function() {
  _origShowSelect3();
  var ob = document.getElementById('btnOpenChat');
  if (ob) ob.style.display = 'none';
  var cp = document.getElementById('chatPanel');
  if (cp) cp.style.display = 'none';
  chatVisible = false;
};

// ===== 9. 初始化 =====
(function() {
  initSpeech();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatSystem);
  } else {
    initChatSystem();
  }
  if (!hasApiKey()) {
    console.log('💡 提示: 在选角界面输入 DeepSeek API Key 可开启 AI 大模型对话');
    console.log('    Key 仅保存在你的浏览器 localStorage 中，不会上传');
  } else {
    console.log('🤖 AI 大模型已就绪');
  }
})();
