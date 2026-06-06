/**
 * 仙道争锋 — Web Audio API 音效系统
 * 所有音效程序化生成，零外部依赖
 */
const SFX = (function() {
  'use strict';

  let ctx = null;
  let masterGain = null;
  let _muted = false;
  let _volume = 0.6;

  /**
   * 延迟创建 AudioContext（兼容 autoplay 策略）
   */
  function getCtx() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = _volume;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  /**
   * 工具：创建 OscillatorNode + GainNode 并自动播放、自动释放
   * @param {Object} opts
   * @param {number}  opts.freq        - 频率 (Hz)
   * @param {string}  opts.type        - 波形: sine|square|sawtooth|triangle
   * @param {number}  opts.duration    - 时长 (秒)
   * @param {number}  opts.volume      - 音量 (0-1)
   * @param {string}  [opts.detune]    - 微调 (cents)
   * @param {Function} [opts.gainFn]   - 自定义 gain 曲线 (gainNode, ctx, t)
   * @param {Function} [opts.extra]    - 额外连接 (osc, ctx) => 返回 connect 目标
   */
  function playTone(opts) {
    const c = getCtx();
    if (!c) return;

    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = opts.type || 'sine';
    osc.frequency.value = opts.freq || 440;
    if (opts.detune) osc.detune.value = opts.detune;

    // 默认 AD envelope: attack 10ms, sustain, release 50ms
    const dur = opts.duration || 0.2;
    const attack = 0.005;
    const release = 0.05;
    const vol = (opts.volume != null ? opts.volume : 1) * 0.8;

    if (opts.gainFn) {
      opts.gainFn(gain, c, now);
    } else {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + attack);
      gain.gain.linearRampToValueAtTime(vol, now + dur - release);
      gain.gain.linearRampToValueAtTime(0, now + dur);
    }

    osc.connect(gain);

    if (opts.extra) {
      opts.extra(osc, c, now);
    }

    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.1);
  }

  /**
   * 工具：播放噪声（白噪声滤镜成形）
   */
  function playNoise(opts) {
    const c = getCtx();
    if (!c) return;

    const dur = opts.duration || 0.3;
    const vol = (opts.volume != null ? opts.volume : 1) * 0.5;
    const now = c.currentTime;

    // BufferSource 填充随机噪声
    const sr = c.sampleRate;
    const len = Math.ceil(sr * dur);
    const buf = c.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = c.createBufferSource();
    src.buffer = buf;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.01);
    if (opts.gainFn) {
      opts.gainFn(gain, c, now);
    } else {
      gain.gain.linearRampToValueAtTime(vol * 0.3, now + dur - 0.05);
      gain.gain.linearRampToValueAtTime(0, now + dur);
    }

    if (opts.filter) {
      const filter = c.createBiquadFilter();
      filter.type = opts.filter.type || 'lowpass';
      filter.frequency.value = opts.filter.freq || 1000;
      filter.Q.value = opts.filter.Q || 1;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }

    gain.connect(masterGain);
    src.start(now);
    src.stop(now + dur + 0.1);
  }

  // ============================================================
  //  公开 API
  // ============================================================

  const API = {

    // ---- 音量控制 ----

    /** 主音量 (0-1) */
    get volume() { return _volume; },
    set volume(v) {
      _volume = Math.max(0, Math.min(1, v));
      if (masterGain) masterGain.gain.value = _volume;
    },

    /** 静音状态 */
    get muted() { return _muted; },

    mute() {
      _muted = true;
      if (masterGain) masterGain.gain.value = 0;
      return this;
    },

    unmute() {
      _muted = false;
      if (masterGain) masterGain.gain.value = _volume;
      return this;
    },

    toggleMute() {
      return _muted ? this.unmute() : this.mute();
    },

    // ---- 音效 ----

    /** 打出卡牌 — 短促"嗖"声 */
    playCard() {
      playNoise({
        duration: 0.15,
        volume: 0.4,
        filter: { type: 'bandpass', freq: 3000, Q: 2 },
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.4, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
        }
      });
      playTone({
        freq: 800,
        type: 'sine',
        duration: 0.08,
        volume: 0.25,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        }
      });
      return this;
    },

    /** 造成伤害 — 清脆打击 */
    dealDamage() {
      playTone({
        freq: 200,
        type: 'square',
        duration: 0.15,
        volume: 0.5,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        }
      });
      playNoise({
        duration: 0.08,
        volume: 0.3,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0.3, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        }
      });
      return this;
    },

    /** 回复生命 — 柔和的上升音 */
    heal() {
      const c = getCtx();
      if (!c) return this;
      const now = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.25);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.2);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.4);
      return this;
    },

    /** 境界突破 — 宏大的"轰"声 */
    breakthrough() {
      // 低频轰隆
      playTone({
        freq: 60,
        type: 'sawtooth',
        duration: 0.8,
        volume: 0.7,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.7, t + 0.05);
          g.gain.exponentialRampToValueAtTime(0.3, t + 0.3);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        }
      });
      // 上升泛音
      playTone({
        freq: 120,
        type: 'sine',
        duration: 0.6,
        volume: 0.5,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.5, t + 0.15);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        }
      });
      // 噪声尾巴
      playNoise({
        duration: 0.5,
        volume: 0.35,
        filter: { type: 'lowpass', freq: 400, Q: 1 },
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.35, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        }
      });
      return this;
    },

    /** 渡天劫 — 雷鸣震荡 */
    tribulation() {
      // 雷声低频
      playTone({
        freq: 50,
        type: 'sawtooth',
        duration: 1.0,
        volume: 0.8,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.8, t + 0.02);
          // 震荡衰减模拟雷鸣
          for (let i = 0; i < 4; i++) {
            const tt = t + 0.05 + i * 0.12;
            g.gain.setValueAtTime(0.6 - i * 0.1, tt);
            g.gain.linearRampToValueAtTime(0.4 - i * 0.08, tt + 0.06);
          }
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        }
      });
      // 高频裂纹
      playNoise({
        duration: 0.6,
        volume: 0.5,
        filter: { type: 'highpass', freq: 2000, Q: 2 },
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.5, t + 0.01);
          g.gain.linearRampToValueAtTime(0.15, t + 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        }
      });
      // 次声压在 30-40ms 处
      playTone({
        freq: 30,
        type: 'sine',
        duration: 0.3,
        volume: 0.6,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t + 0.03);
          g.gain.linearRampToValueAtTime(0.6, t + 0.06);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        }
      });
      return this;
    },

    /** 修炼 — 冥想音 */
    cultivate() {
      const c = getCtx();
      if (!c) return this;
      const now = c.currentTime;

      // 基础低频嗡鸣
      const osc1 = c.createOscillator();
      const g1 = c.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 110;
      g1.gain.setValueAtTime(0, now);
      g1.gain.linearRampToValueAtTime(0.3, now + 0.2);
      g1.gain.linearRampToValueAtTime(0.2, now + 0.8);
      g1.gain.linearRampToValueAtTime(0, now + 1.2);

      // 缓慢颤音泛音
      const osc2 = c.createOscillator();
      const g2 = c.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(330, now);
      osc2.frequency.linearRampToValueAtTime(440, now + 1.0);
      // LFO 颤音
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = 4;
      lfoGain.gain.value = 10;
      lfo.connect(lfoGain);
      lfoGain.connect(osc2.frequency);
      lfo.start(now);

      g2.gain.setValueAtTime(0, now);
      g2.gain.linearRampToValueAtTime(0.2, now + 0.3);
      g2.gain.linearRampToValueAtTime(0.1, now + 0.9);
      g2.gain.linearRampToValueAtTime(0, now + 1.3);

      osc1.connect(g1);
      osc2.connect(g2);
      g1.connect(masterGain);
      g2.connect(masterGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.4);
      osc2.stop(now + 1.4);
      lfo.stop(now + 1.4);
      return this;
    },

    /** 结束回合 — 确认音 */
    endTurn() {
      playTone({
        freq: 523, // C5
        type: 'sine',
        duration: 0.15,
        volume: 0.35,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.35, t + 0.01);
          g.gain.linearRampToValueAtTime(0, t + 0.12);
        }
      });
      setTimeout(() => {
        playTone({
          freq: 659, // E5
          type: 'sine',
          duration: 0.2,
          volume: 0.35,
          gainFn: (g, c, t) => {
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.35, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          }
        });
      }, 80);
      return this;
    },

    /** 轮到你的回合 — 提示音 */
    yourTurn() {
      const notes = [784, 988, 1175]; // G5, B5, D6
      notes.forEach((freq, i) => {
        setTimeout(() => {
          playTone({
            freq,
            type: 'sine',
            duration: 0.2,
            volume: 0.35,
            gainFn: (g, c, t) => {
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.35, t + 0.02);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            }
          });
        }, i * 100);
      });
      return this;
    },

    /** 胜利 — fanfare */
    victory() {
      const notes = [
        { f: 523, d: 0.15 }, // C5
        { f: 659, d: 0.15 }, // E5
        { f: 784, d: 0.15 }, // G5
        { f: 1047, d: 0.3 }, // C6
      ];
      let offset = 0;
      notes.forEach((n, i) => {
        setTimeout(() => {
          playTone({
            freq: n.f,
            type: 'sine',
            duration: n.d,
            volume: 0.5,
            gainFn: (g, c, t) => {
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.5, t + 0.03);
              g.gain.exponentialRampToValueAtTime(0.001, t + n.d);
            }
          });
        }, offset);
        offset += n.d * 1000 + 50;
      });
      // 最后同时加和弦
      setTimeout(() => {
        [523, 659, 784].forEach(f => {
          playTone({
            freq: f,
            type: 'sine',
            duration: 0.6,
            volume: 0.3,
            gainFn: (g, c, t) => {
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.3, t + 0.02);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            }
          });
        });
      }, offset);
      return this;
    },

    /** 失败 — 低沉失败音 */
    defeat() {
      const notes = [400, 350, 300, 200];
      let offset = 0;
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone({
            freq: f,
            type: 'sawtooth',
            duration: 0.3,
            volume: 0.4,
            gainFn: (g, c, t) => {
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.4, t + 0.03);
              g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            }
          });
        }, offset);
        offset += 150;
      });
      return this;
    },

    /** 游戏开始 — 开场音 */
    gameStart() {
      const notes = [262, 330, 392, 523, 659, 784, 1047];
      notes.forEach((f, i) => {
        setTimeout(() => {
          playTone({
            freq: f,
            type: 'sine',
            duration: 0.2,
            volume: 0.3,
            gainFn: (g, c, t) => {
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.3, t + 0.02);
              g.gain.linearRampToValueAtTime(0, t + 0.18);
            }
          });
        }, i * 80);
      });
      return this;
    },

    /** 卡牌悬停 — 极短促提示 */
    cardHover() {
      playTone({
        freq: 1200,
        type: 'sine',
        duration: 0.04,
        volume: 0.12,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0.12, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        }
      });
      return this;
    },

    /** UI 按钮点击 */
    buttonClick() {
      playTone({
        freq: 800,
        type: 'sine',
        duration: 0.06,
        volume: 0.2,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        }
      });
      playNoise({
        duration: 0.03,
        volume: 0.08,
        gainFn: (g, c, t) => {
          g.gain.setValueAtTime(0.08, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        }
      });
      return this;
    },

    /** 获取底层 AudioContext（用于调试 / 高级使用） */
    getContext() {
      return getCtx();
    },
  };

  return API;
})();
