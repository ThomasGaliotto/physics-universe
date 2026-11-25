import * as THREE from 'three';
import type { Renderer } from './core/render';
import { Level } from './core/level';
import { Game, type WhatIf } from './game';
import { MISSIONS, SANDBOX, type Mission } from './missions';
import { PARTS, PART_ORDER } from './parts';
import { loadSave, playerLevel, totalStars, writeSave, type SaveData } from './save';
import { EXPLAIN, drawAnim, type Explanation } from './understand';
import { makeExplorerModel } from './explorer';
import type { PartKind } from './core/physics';

const WORLDS = [
  { icon: '🌍', name: 'Terra', theme: 'La planète vivante', physics: 'Gravité', open: true },
  { icon: '🚀', name: 'Velocity', theme: 'Le monde de la vitesse', physics: 'Mouvement', open: false },
  { icon: '⚙️', name: 'Mechanica', theme: 'La cité des machines', physics: 'Forces et leviers', open: false },
  { icon: '🔋', name: 'Energon', theme: 'Le monde énergétique', physics: 'Énergie', open: false },
  { icon: '🧲', name: 'Magnetika', theme: 'L’île magnétique', physics: 'Magnétisme', open: false },
  { icon: '⚡', name: 'Electra', theme: 'La cité électrique', physics: 'Électricité', open: false },
  { icon: '🌊', name: 'Aquaria', theme: 'Le monde aquatique', physics: 'Fluides et pression', open: false },
  { icon: '🌌', name: 'Quantum', theme: 'L’univers mystérieux', physics: 'Physique avancée', open: false },
];

const WHATIF: { key: WhatIf; icon: string; label: string }[] = [
  { key: 'gravite', icon: '⇅', label: 'Gravité inversée' },
  { key: 'frottement', icon: '≋', label: 'Sans frottement' },
  { key: 'ralenti', icon: '◷', label: 'Temps ralenti' },
  { key: 'masse', icon: '⚖', label: 'Double masse' },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmt = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

/** Owns the DOM UI, the input, and switches between menus and game sessions. */
export class App {
  private ui = document.getElementById('ui')!;
  private save: SaveData = loadSave();
  game: Game | null = null;
  private backdrop: { level: Level; t: number } | null = null;
  private keys = new Set<string>();
  private joy = new THREE.Vector2();
  private jumpQueued = false;
  private hintTimer = 0;
  private toastTimer = 0;
  private animRaf = 0;
  private lastInsightCount = 0;
  private screen: 'title' | 'missions' | 'worlds' | 'defis' | 'game' = 'title';

  constructor(private r: Renderer) {
    this.bindKeyboard();
    this.bindPointer();
    this.showTitle();
  }

  // ================================================================ loop

  update(dt: number) {
    if (this.game) {
      const k = this.keys;
      const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const v = new THREE.Vector2(kx + this.joy.x, ky + this.joy.y);
      if (v.length() > 1) v.normalize();
      const input = { move: this.game.mode === 'play' ? this.game.cameraRelative(v) : new THREE.Vector2(), jump: this.jumpQueued };
      this.game.update(dt, input, this.game.mode === 'build' ? v : new THREE.Vector2());
      if (!input.jump) this.jumpQueued = false;
      if (this.game.insights.length !== this.lastInsightCount) {
        this.lastInsightCount = this.game.insights.length;
        this.ui.querySelector('#btn-comprendre')?.classList.add('pulse');
      }
      const liftEl = this.ui.querySelector('#lift-val');
      if (liftEl && this.game.selected) liftEl.textContent = `${fmt(this.game.selected.lift)} m`;
    } else if (this.backdrop) {
      const b = this.backdrop;
      b.t += dt;
      for (const a of b.level.animated) a(b.t, dt);
      const cam = this.r.camera;
      const a = -1.2 + Math.sin(b.t * 0.08) * 0.35;
      cam.position.set(Math.sin(a) * 9 + 1, 3.2, Math.cos(a) * 9);
      cam.lookAt(1.6, 2.2, 0);
      this.r.followShadow(new THREE.Vector3(0, 0, 0));
    }
  }

  // ================================================================ screens

  private clearGame() {
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
    cancelAnimationFrame(this.animRaf);
  }

  private ensureBackdrop() {
    if (this.backdrop) return;
    const level = new Level(this.r.scene);
    level.island(0, 0, 12, 9, 0, 3.5, { trees: 4, waterfall: true });
    level.island(9, 6, 5, 5, 2.5, 2.5, { trees: 1 });
    level.flag(4.5, 0, -1.5);
    const ex = makeExplorerModel();
    ex.root.position.set(-1.5, 0, 1.5);
    ex.root.rotation.y = 2.2;
    level.root.add(ex.root);
    level.animated.push((t) => {
      ex.head.rotation.y = Math.sin(t * 0.5) * 0.3;
      ex.arms[1].rotation.x = Math.sin(t * 1.2) * 0.05;
    });
    this.backdrop = { level, t: 0 };
  }

  private dropBackdrop() {
    if (!this.backdrop) return;
    this.backdrop.level.dispose(this.r.scene);
    this.backdrop = null;
  }

  private topStats() {
    const s = this.save;
    return `
      <div class="stats">
        <div class="pill"><span class="star">★</span> ${totalStars(s)} / ${MISSIONS.length * 3}</div>
        <div class="pill"><span class="gem">◆</span> ${s.gems}</div>
        <div class="pill level"><span class="avatar">🧑‍🚀</span><span><small>Niveau</small><b>${playerLevel(s)}</b></span></div>
      </div>`;
  }

  showTitle() {
    this.clearGame();
    this.ensureBackdrop();
    this.screen = 'title';
    this.ui.innerHTML = `
      <div class="title-screen">
        <div class="logo">
          <div class="logo-ring"></div>
          <h1>PHYSICS<br/>UNIVERSE</h1>
          <p>Comprends les lois de l’univers<br/>en jouant avec elles.</p>
        </div>
        <nav class="main-menu">
          <button data-go="missions" class="primary"><span>🎯</span> Résoudre</button>
          <button data-go="sandbox"><span>🧪</span> Expérimenter</button>
          <button data-go="build"><span>🧊</span> Construire</button>
          <button data-go="worlds"><span>🧭</span> Explorer</button>
          <button data-go="defis"><span>🏆</span> Défis</button>
        </nav>
        ${this.topStats()}
        <div class="tagline"><span class="atom">⚛</span> Explore. Expérimente. <b>Apprends.</b></div>
      </div>`;
    this.ui.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        const go = b.dataset.go!;
        if (go === 'missions') this.showMissions();
        else if (go === 'worlds') this.showWorlds();
        else if (go === 'defis') this.showDefis();
        else this.startMission(SANDBOX, go === 'build');
      }),
    );
  }

  private header(title: string) {
    return `<header class="screen-head"><button class="round" data-back>‹</button><h2>${title}</h2>${this.topStats()}</header>`;
  }

  private bindBack() {
    this.ui.querySelector('[data-back]')?.addEventListener('click', () => this.showTitle());
  }

  private unlocked(i: number) {
    return i === 0 || !!this.save.stars[MISSIONS[i - 1].id]?.[0];
  }

  showMissions() {
    this.clearGame();
    this.ensureBackdrop();
    this.screen = 'missions';
    const cards = MISSIONS.map((m, i) => {
      const st = this.save.stars[m.id] ?? [false, false, false];
      const open = this.unlocked(i);
      return `
        <button class="mcard ${open ? '' : 'locked'}" data-m="${i}" ${open ? '' : 'disabled'}>
          <div class="mnum">${m.num}</div>
          <div class="mtitle">${esc(m.title)}</div>
          <div class="mconcept">${esc(m.concept)}</div>
          <div class="mstars">${st.map((s) => `<span class="${s ? 'on' : ''}">★</span>`).join('')}</div>
          ${open ? '' : '<div class="lock">🔒</div>'}
        </button>`;
    }).join('');
    this.ui.innerHTML = `<div class="panel-screen">${this.header('🌍 Terra · La planète vivante')}<div class="mgrid">${cards}</div></div>`;
    this.bindBack();
    this.ui.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => b.addEventListener('click', () => this.startMission(MISSIONS[+b.dataset.m!])));
  }

  showWorlds() {
    this.ensureBackdrop();
    this.screen = 'worlds';
    const cards = WORLDS.map(
      (w) => `
      <button class="wcard ${w.open ? '' : 'locked'}" ${w.open ? 'data-terra' : 'disabled'}>
        <div class="wicon">${w.icon}</div>
        <div class="mtitle">${w.name}</div>
        <div class="mconcept">${w.theme}</div>
        <div class="wphys">⚙ ${w.physics}</div>
        <div class="wstate">${w.open ? `${MISSIONS.length} missions` : '🔒 Bientôt'}</div>
      </button>`,
    ).join('');
    this.ui.innerHTML = `<div class="panel-screen">${this.header('🧭 Les mondes')}<div class="wgrid">${cards}</div></div>`;
    this.bindBack();
    this.ui.querySelector('[data-terra]')?.addEventListener('click', () => this.showMissions());
  }

  showDefis() {
    this.ensureBackdrop();
    this.screen = 'defis';
    const rows = MISSIONS.map((m) => {
      const st = this.save.stars[m.id] ?? [false, false, false];
      return `<div class="defi ${st[2] ? 'done' : ''}"><b>${m.num}. ${esc(m.title)}</b><span>${esc(m.bonus.text)}</span><i>${st[2] ? '★' : '☆'}</i></div>`;
    }).join('');
    this.ui.innerHTML = `<div class="panel-screen">${this.header('🏆 Défis')}<div class="defis"><p class="muted">Chaque mission cache un défi bonus : il rapporte la 3e étoile.</p>${rows}</div></div>`;
    this.bindBack();
  }

  // ================================================================ game

  startMission(m: Mission, buildFirst = false) {
    this.clearGame();
    this.dropBackdrop();
    this.screen = 'game';
    this.game = new Game(this.r, m, {
      onWin: (res) => this.onWin(m, res.stars),
      onChange: () => this.refreshHud(),
      toast: (t) => this.toast(t),
      hint: (t) => this.hint(t),
    });
    this.lastInsightCount = 0;
    this.renderHud();
    if (buildFirst) this.game.enterBuild();
    if (m !== SANDBOX) this.showIntro(m);
  }

  private showIntro(m: Mission) {
    const inv = Object.entries(m.inventory)
      .map(([k, n]) => `<span class="chip">${PARTS[k as PartKind].icon} ${PARTS[k as PartKind].label}${n! > 1 ? ' ×' + n : ''}</span>`)
      .join('');
    this.modal(`
      <div class="intro">
        <div class="kicker">Mission ${m.num} · ${esc(m.concept)}</div>
        <h2>${esc(m.title)}</h2>
        <p>${esc(m.intro)}</p>
        ${inv ? `<div class="inv-list"><small>Dans ton sac</small>${inv}</div>` : ''}
        <div class="bonus">🏆 Défi bonus : ${esc(m.bonus.text)}</div>
        <button class="primary big" data-close>C’est parti !</button>
      </div>`);
  }

  private renderHud() {
    const g = this.game!;
    const m = g.mission;
    this.ui.innerHTML = `
      <div class="hud">
        <div class="hud-top">
          <button class="round" id="btn-menu">☰</button>
          <div class="mission-box">
            <div class="kicker">${m === SANDBOX ? 'Expériences libres' : `Mission ${m.num} · ${esc(m.concept)}`}</div>
            <div class="goal">${esc(m.goal)}</div>
          </div>
          <div class="hud-right">
            <div class="pill" id="hud-crystals"></div>
            <div class="mode-chip" id="mode-chip"></div>
          </div>
        </div>
        <div class="hint" id="hint"><div class="hint-t">💡 Indice</div><div id="hint-text"></div></div>
        <div class="toast" id="toast"></div>
        <div class="side">
          <button class="comprendre" id="btn-comprendre"><span>💡</span>COMPRENDRE</button>
          <button class="etsi-btn" id="btn-etsi"><span>⚙</span> Et si… ?</button>
        </div>
        <div class="joystick" id="joystick"><div class="knob" id="knob"></div></div>
        <div class="actions">
          <button class="act" id="btn-retry">↺<small>Réessayer</small></button>
          <button class="act build" id="btn-build"></button>
          <button class="act jump" id="btn-jump">⤒<small>Sauter</small></button>
        </div>
        <div class="buildbar" id="buildbar"></div>
        <div class="selbar" id="selbar"></div>
      </div>`;
    const $ = (id: string) => this.ui.querySelector<HTMLElement>('#' + id)!;
    $('btn-menu').onclick = () => this.pauseMenu();
    $('btn-comprendre').onclick = () => this.openComprendre();
    $('btn-etsi').onclick = () => this.openWhatIf();
    $('btn-build').onclick = () => {
      if (g.mode === 'play') g.enterBuild();
      else g.test();
    };
    $('btn-retry').onclick = () => g.retry();
    const jump = $('btn-jump');
    const press = (e: Event) => {
      e.preventDefault();
      this.jumpQueued = true;
    };
    jump.addEventListener('pointerdown', press);
    this.bindJoystick($('joystick'), $('knob'));
    this.refreshHud();
  }

  refreshHud() {
    const g = this.game;
    if (!g || this.screen !== 'game') return;
    const $ = (id: string) => this.ui.querySelector<HTMLElement>('#' + id);
    const taken = g.level.crystals.filter((c) => c.taken).length;
    const cr = $('hud-crystals');
    if (cr) cr.innerHTML = `<span class="gem">◆</span> ${taken} / ${g.level.crystals.length}`;
    const chip = $('mode-chip');
    if (chip) {
      chip.textContent = g.mode === 'build' ? '⏸ Temps figé' : g.whatIf.size ? '⚙ Lois modifiées' : '';
      chip.className = 'mode-chip ' + (g.mode === 'build' ? 'frozen' : g.whatIf.size ? 'mod' : 'hidden');
    }
    const b = $('btn-build');
    if (b) {
      const canBuild = g.mission === SANDBOX || Object.keys(g.mission.inventory).length > 0 || g.level.entities.some((e) => e.movable);
      b.innerHTML = g.mode === 'play' ? '🔧<small>Construire</small>' : '▶<small>Tester</small>';
      b.classList.toggle('testing', g.mode === 'build');
      b.style.display = canBuild ? '' : 'none';
    }
    const retry = $('btn-retry');
    if (retry) retry.style.display = g.tested && g.mode === 'play' ? '' : 'none';
    const jump = $('btn-jump');
    if (jump) jump.style.display = g.mode === 'play' ? '' : 'none';
    const etsi = $('btn-etsi');
    if (etsi) etsi.classList.toggle('on', g.whatIf.size > 0);

    // Build bar: inventory
    const bar = $('buildbar');
    if (bar) {
      if (g.mode !== 'build') {
        bar.innerHTML = '';
        bar.style.display = 'none';
      } else {
        bar.style.display = '';
        const items = PART_ORDER.filter((k) => g.inventory[k] !== undefined);
        bar.innerHTML = items.length
          ? items
              .map((k) => {
                const n = g.inventory[k] ?? 0;
                return `<button class="tool ${g.tool === k ? 'on' : ''} ${n ? '' : 'empty'}" data-tool="${k}" title="${PARTS[k].info}"><span class="ti">${PARTS[k].icon}</span><span class="tn">${n > 9 ? '∞' : n}</span><small>${PARTS[k].label}</small></button>`;
              })
              .join('') + `<div class="tool-tip">${g.tool ? `Touche le décor pour poser : ${PARTS[g.tool].info}` : 'Choisis une pièce, ou touche un objet pour le déplacer.'}</div>`
          : `<div class="tool-tip">Rien à poser ici : touche un objet pour le déplacer.</div>`;
        bar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((t) =>
          t.addEventListener('click', () => {
            const k = t.dataset.tool as PartKind;
            if ((g.inventory[k] ?? 0) <= 0) return;
            g.setTool(g.tool === k ? null : k);
          }),
        );
      }
    }
    // Selection controls
    const sel = $('selbar');
    if (sel) {
      const e = g.selected;
      if (g.mode !== 'build' || !e) {
        sel.style.display = 'none';
        sel.innerHTML = '';
      } else {
        sel.style.display = '';
        sel.innerHTML = `
          <div class="sel-name">${esc(g.massLabel(e))}</div>
          <button data-a="yaw-">⟲</button><button data-a="yaw+">⟳</button>
          <button data-a="tilt+">⤾</button><button data-a="tilt-">⤿</button>
          <span class="sep"></span>
          <button data-a="up">▲</button><span class="lift" id="lift-val">${fmt(e.lift)} m</span><button data-a="down">▼</button>
          ${e.fromInventory ? '<span class="sep"></span><button data-a="del" class="danger">🗑</button>' : ''}
          <span class="sep"></span><button data-a="ok">✓</button>`;
        sel.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((btn) =>
          btn.addEventListener('click', () => {
            const a = btn.dataset.a!;
            if (a === 'yaw-') g.rotateSelected(-15);
            else if (a === 'yaw+') g.rotateSelected(15);
            else if (a === 'tilt+') g.tiltSelected(10);
            else if (a === 'tilt-') g.tiltSelected(-10);
            else if (a === 'up') g.liftSelected(0.5);
            else if (a === 'down') g.liftSelected(-0.5);
            else if (a === 'del') g.removeSelected();
            else if (a === 'ok') g.select(null);
          }),
        );
      }
    }
  }

  private pauseMenu() {
    const g = this.game!;
    this.modal(`
      <div class="pause">
        <h2>Pause</h2>
        <button class="primary" data-close>▶ Reprendre</button>
        <button data-act="restart">↺ Recommencer la mission</button>
        ${g.mission !== SANDBOX ? '<button data-act="missions">🗺 Missions</button>' : ''}
        <button data-act="title">⌂ Menu principal</button>
      </div>`);
    this.ui.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.act;
        if (a === 'restart') this.startMission(g.mission);
        else if (a === 'missions') this.showMissions();
        else this.showTitle();
      }),
    );
  }

  private onWin(m: Mission, stars: [boolean, boolean, boolean]) {
    if (m === SANDBOX) return;
    const prev = this.save.stars[m.id] ?? [false, false, false];
    const merged = prev.map((p, i) => p || stars[i]) as [boolean, boolean, boolean];
    const newStars = merged.filter(Boolean).length - prev.filter(Boolean).length;
    const crystals = this.game!.stats.crystals;
    const gems = crystals * 10 + newStars * 15 + (prev[0] ? 0 : 20);
    this.save.stars[m.id] = merged;
    this.save.gems += gems;
    writeSave(this.save);
    const idx = MISSIONS.indexOf(m);
    const next = MISSIONS[idx + 1];
    setTimeout(() => {
      this.modal(
        `
        <div class="win">
          <div class="kicker">Mission ${m.num} réussie !</div>
          <h2>${esc(m.title)}</h2>
          <div class="win-stars">${stars.map((s, i) => `<span class="${s ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</span>`).join('')}</div>
          <div class="win-rows">
            <div>★ Mission accomplie</div>
            <div class="${stars[1] ? '' : 'miss'}">★ Tous les cristaux</div>
            <div class="${stars[2] ? '' : 'miss'}">★ ${esc(m.bonus.text)}</div>
          </div>
          <div class="reward">+${gems} <span class="gem">◆</span></div>
          <div class="lesson"><b>🔬 ${esc(m.lesson.title)}</b><p>${esc(m.lesson.text)}</p></div>
          <div class="row">
            <button data-act="comprendre">💡 Comprendre</button>
            <button data-act="replay">↺ Rejouer</button>
            ${next ? '<button class="primary" data-act="next">Mission suivante ▶</button>' : '<button class="primary" data-act="missions">Terminer ▶</button>'}
          </div>
        </div>`,
        false,
      );
      this.ui.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
        b.addEventListener('click', () => {
          const a = b.dataset.act;
          if (a === 'comprendre') this.openComprendre(m.conceptKey, true);
          else if (a === 'replay') this.startMission(m);
          else if (a === 'next' && next) this.startMission(next);
          else this.showMissions();
        }),
      );
    }, 900);
  }

  // ================================================================ 💡 Comprendre

  private pickExplanation(): string {
    const g = this.game!;
    const recent = g.insights.find((i) => EXPLAIN[i.key] && g.level.time - i.at < 25);
    return recent ? recent.key : g.mission.conceptKey;
  }

  openComprendre(key?: string, fromWin = false) {
    const g = this.game!;
    const k = key ?? this.pickExplanation();
    const ex: Explanation = EXPLAIN[k] ?? EXPLAIN[g.mission.conceptKey];
    const data = g.insights.find((i) => i.key === k)?.data ?? {};
    this.ui.querySelector('#btn-comprendre')?.classList.remove('pulse');
    const topics = [g.mission.conceptKey, ...g.mission.related].filter((t, i, a) => EXPLAIN[t] && a.indexOf(t) === i && t !== k);
    this.modal(
      `
      <div class="comprendre-card">
        <div class="kicker">💡 Comprendre</div>
        <h2>${esc(ex.title)}</h2>
        <div class="cc-body">
          <canvas id="anim" width="300" height="190"></canvas>
          <div class="cc-text">
            <p>${esc(ex.text(data))}</p>
            ${ex.formula ? `<details><summary>Voir la formule</summary><pre>${esc(ex.formula)}</pre></details>` : ''}
            <div class="experiment"><b>🧪 Expérience</b><p>${esc(ex.experiment)}</p></div>
          </div>
        </div>
        ${topics.length ? `<div class="topics"><small>Aller plus loin</small>${topics.map((t) => `<button data-topic="${t}">${esc(EXPLAIN[t].title)}</button>`).join('')}</div>` : ''}
        <button class="primary" data-close>${fromWin ? 'Fermer' : 'Retour au jeu'}</button>
      </div>`,
      true,
      () => {
        if (fromWin) this.onWinReopen();
      },
    );
    this.ui.querySelectorAll<HTMLButtonElement>('[data-topic]').forEach((b) => b.addEventListener('click', () => this.openComprendre(b.dataset.topic, fromWin)));
    const canvas = this.ui.querySelector<HTMLCanvasElement>('#anim')!;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio);
    canvas.width = 300 * dpr;
    canvas.height = 190 * dpr;
    ctx.scale(dpr, dpr);
    const t0 = performance.now();
    cancelAnimationFrame(this.animRaf);
    const loop = () => {
      if (!canvas.isConnected) return;
      drawAnim(ex.anim, ctx, (performance.now() - t0) / 1000, 300, 190);
      this.animRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  private onWinReopen() {
    // after reading the explanation from the win screen, go back to the mission list
    const g = this.game;
    if (g?.won) this.showMissions();
  }

  // ================================================================ Et si… ?

  private openWhatIf() {
    const g = this.game!;
    const items = WHATIF.map((w) => {
      const allowed = g.mission.whatIf.includes(w.key);
      const on = g.whatIf.has(w.key);
      return `<button class="wi ${on ? 'on' : ''} ${allowed ? '' : 'off'}" data-wi="${w.key}" ${allowed ? '' : 'disabled'}><span class="wi-i">${w.icon}</span>${w.label}${allowed ? '' : '<small>🔒</small>'}</button>`;
    }).join('');
    this.modal(`
      <div class="etsi">
        <div class="kicker">⚙ Mode « Et si… ? »</div>
        <h2>Modifie les lois de la physique !</h2>
        <div class="wi-grid">${items}</div>
        <p class="muted">Tes bottes gravitationnelles te gardent toujours au sol.</p>
        <button class="primary" data-close>OK</button>
      </div>`);
    this.ui.querySelectorAll<HTMLButtonElement>('[data-wi]').forEach((b) =>
      b.addEventListener('click', () => {
        g.toggleWhatIf(b.dataset.wi as WhatIf);
        b.classList.toggle('on', g.whatIf.has(b.dataset.wi as WhatIf));
        this.refreshHud();
      }),
    );
  }

  // ================================================================ overlays

  private modal(html: string, closable = true, onClose?: () => void) {
    this.ui.querySelector('.modal')?.remove();
    const el = document.createElement('div');
    el.className = 'modal';
    el.innerHTML = `<div class="modal-card">${html}</div>`;
    this.ui.appendChild(el);
    const close = () => {
      el.remove();
      cancelAnimationFrame(this.animRaf);
      onClose?.();
    };
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    if (closable)
      el.addEventListener('pointerdown', (e) => {
        if (e.target === el) close();
      });
  }

  private modalOpen() {
    return !!this.ui.querySelector('.modal');
  }

  toast(text: string) {
    const el = this.ui.querySelector<HTMLElement>('#toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 2600);
  }

  hint(text: string) {
    const el = this.ui.querySelector<HTMLElement>('#hint');
    const t = this.ui.querySelector<HTMLElement>('#hint-text');
    if (!el || !t) return;
    t.textContent = text;
    el.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => el.classList.remove('show'), 9000);
  }

  // ================================================================ input

  private bindKeyboard() {
    addEventListener('keydown', (e) => {
      if (!this.game || this.modalOpen()) return;
      const g = this.game;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        if (!e.repeat) this.jumpQueued = true;
        e.preventDefault();
      } else if (e.code === 'KeyB' || e.code === 'Enter') {
        if (g.mode === 'play') g.enterBuild();
        else g.test();
      } else if (e.code === 'KeyR') g.retry();
      else if (e.code === 'KeyC') this.openComprendre();
      else if (g.mode === 'build') {
        if (e.code === 'Delete' || e.code === 'Backspace') g.removeSelected();
        else if (e.code === 'PageUp') g.liftSelected(0.5);
        else if (e.code === 'PageDown') g.liftSelected(-0.5);
        else if (e.code === 'KeyT') g.rotateSelected(15);
        else if (e.code === 'KeyY') g.tiltSelected(10);
        else if (e.code === 'KeyH') g.tiltSelected(-10);
        else if (e.code === 'Escape') {
          g.setTool(null);
          g.select(null);
        }
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  private bindJoystick(base: HTMLElement, knob: HTMLElement) {
    let id: number | null = null;
    const R = 46;
    const move = (e: PointerEvent) => {
      const r = base.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const v = new THREE.Vector2(dx, dy);
      if (v.length() > R) v.setLength(R);
      knob.style.transform = `translate(${v.x}px, ${v.y}px)`;
      this.joy.set(v.x / R, -v.y / R);
    };
    base.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      base.setPointerCapture(id);
      move(e);
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) move(e);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      this.joy.set(0, 0);
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
  }

  private bindPointer() {
    const canvas = this.r.renderer.domElement;
    const pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; dragObj: boolean }>();
    let pinch = 0;
    const ndc = (x: number, y: number) => new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.game) return;
      canvas.setPointerCapture(e.pointerId);
      const g = this.game;
      let dragObj = false;
      if (g.mode === 'build' && g.selected && !g.tool) {
        const hit = g.pick(ndc(e.clientX, e.clientY));
        dragObj = !!hit?.entity && hit.entity === g.selected;
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), dragObj });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.game) return;
      const g = this.game;
      const p = pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse' && g.mode === 'build') g.hover(ndc(e.clientX, e.clientY));
        return;
      }
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) g.zoom(pinch / d);
        pinch = d;
        return;
      }
      if (p.dragObj) g.dragTo(ndc(e.clientX, e.clientY));
      else g.orbit(dx, dy);
      if (e.pointerType === 'mouse' && g.mode === 'build') g.hover(ndc(e.clientX, e.clientY));
    });
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (!p || !this.game) return;
      const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (moved < 10 && performance.now() - p.t < 500 && !p.dragObj) this.game.tap(ndc(e.clientX, e.clientY));
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      if (!this.game) return;
      e.preventDefault();
      this.game.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
