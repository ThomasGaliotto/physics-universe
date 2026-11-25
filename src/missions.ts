import * as THREE from 'three';
import type { Level } from './core/level';
import type { Entity, PartKind } from './core/physics';
import type { Game, WhatIf } from './game';
import { createPart } from './parts';
import { RAPIER } from './core/physics';
import { MAT } from './world/materials';

export interface RunStats {
  falls: number;
  tests: number;
  time: number;
  maxY: number;
  partsUsed: number;
  crystals: number;
  launches: number;
}

export interface MissionApi {
  level: Level;
  game: Game;
  emit: (key: string, data?: Record<string, number | string>) => void;
  openGate: (id: string) => void;
  toast: (t: string) => void;
  hint: (t: string) => void;
}

export interface MissionSetup {
  spawn: THREE.Vector3;
  facing?: number;
  goal: THREE.Vector3 | null;
  killY?: number;
  camYaw?: number;
}

export interface Hint {
  id: string;
  text: string;
  when: (api: MissionApi, feet: THREE.Vector3) => boolean;
}

export interface Mission {
  id: string;
  num: number;
  title: string;
  /** Physics idea, shown on the card */
  concept: string;
  /** Key of the main explanation in 💡 Comprendre */
  conceptKey: string;
  /** Other explanations that fit this mission */
  related: string[];
  intro: string;
  goal: string;
  inventory: Partial<Record<PartKind, number>>;
  whatIf: WhatIf[];
  bonus: { text: string; check: (s: RunStats, api: MissionApi) => boolean };
  hints?: Hint[];
  build: (level: Level) => MissionSetup;
  onStep?: (api: MissionApi, dt: number) => void;
  onTest?: (api: MissionApi) => void;
  onRetry?: (api: MissionApi) => void;
  canFinish?: (api: MissionApi) => boolean;
  /** What the player learns at the end */
  lesson: { title: string; text: string };
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A mission object the player didn't bring (can still be moved in build mode if `movable`). */
function obj(level: Level, kind: PartKind, x: number, y: number, z: number, movable = true, tag?: string) {
  const e = createPart(level, kind, v3(x, y, z));
  e.fromInventory = false;
  e.movable = movable;
  e.tag = tag;
  return e;
}


// ---------------------------------------------------------------------------
// Terra — la planète vivante (gravité)
// ---------------------------------------------------------------------------

const m1: Mission = {
  id: 'terra-1',
  num: 1,
  title: 'Premiers pas',
  concept: 'La gravité',
  conceptKey: 'gravite',
  related: ['tombe', 'etsi-ralenti'],
  intro: 'Bienvenue sur Terra ! Les îles flottent, mais toi, tu retombes toujours. Saute d’île en île jusqu’au drapeau.',
  goal: 'Atteindre le drapeau en sautant d’île en île.',
  inventory: {},
  whatIf: ['ralenti'],
  bonus: { text: 'Arriver en moins de 45 s', check: (s) => s.time <= 45 },
  hints: [
    { id: 'move', text: 'Déplace-toi avec le joystick (ou ZQSD / flèches). Saute avec ⤒ (ou Espace).', when: () => true },
    { id: 'gap', text: 'Pendant un saut, tu montes de moins en moins vite, puis tu retombes : c’est la gravité. Touche 💡 Comprendre pour voir pourquoi.', when: (_a, f) => f.x > 7 },
  ],
  build(l) {
    l.island(0, 0, 10, 8, 0, 3, { trees: 3, waterfall: true });
    l.island(9, 0, 5, 6, 0.6, 2.5, { trees: 1 });
    l.island(15.5, 0, 4, 5, 1.4, 2.5);
    l.island(22, 0, 5, 6, 0.8, 2.5, { trees: 1, waterfall: true });
    l.island(22, -4.6, 2.2, 2.2, 1.6, 1.6, { flowers: false });
    l.island(30.5, 0, 7, 8, 0, 3, { trees: 2 });
    l.crystal(12.3, 2.55, 0);
    l.crystal(22, 2.45, -4.6);
    l.sign(-1.5, -2.6, 0, 'Terra →');
    return { spawn: v3(-3, 0, 0), goal: l.flag(32.5, 0, 0) };
  },
  lesson: {
    title: 'La gravité',
    text: 'La Terre attire tout ce qui a une masse vers son centre. Quand tu sautes, ta vitesse vers le haut diminue de 9,8 m/s chaque seconde, jusqu’à s’inverser : tu retombes. Ton saut dessine une courbe appelée parabole.',
  },
};

const m2: Mission = {
  id: 'terra-2',
  num: 2,
  title: 'La rampe',
  concept: 'Le plan incliné',
  conceptKey: 'pente',
  related: ['gravite'],
  intro: 'Cette falaise fait 2,8 m : bien trop haut pour sauter, même depuis une caisse. Mais avec une planche…',
  goal: 'Monter sur la falaise et atteindre le drapeau.',
  inventory: { planche: 1, caisse: 1 },
  whatIf: ['ralenti', 'frottement'],
  bonus: { text: 'Réussir dès le premier essai', check: (s) => s.tests <= 1 },
  hints: [
    { id: 'cliff', text: 'Trop haut ! Touche 🔧 Construire : pose la planche contre la falaise pour faire une rampe (⤾ pour l’incliner).', when: (_a, f) => f.x > 3 },
  ],
  build(l) {
    l.island(0, 0, 14, 8, 0, 3, { trees: 3, waterfall: true });
    l.island(12, 0, 10, 8, 2.8, 6, { trees: 2 });
    l.crystal(-6, 0.9, -3);
    l.crystal(16, 3.7, 3);
    return { spawn: v3(-4, 0, 0), goal: l.flag(15, 2.8, 0) };
  },
  lesson: {
    title: 'Le plan incliné',
    text: 'Monter tout droit demande de soulever tout ton poids d’un coup. Sur une rampe, tu montes la même hauteur, mais sur une plus grande distance : chaque pas demande moins de force. Plus la pente est douce, plus c’est facile… et plus c’est long.',
  },
};

const m3: Mission = {
  id: 'terra-3',
  num: 3,
  title: 'Le pont',
  concept: 'Les appuis',
  conceptKey: 'appuis',
  related: ['gravite', 'equilibre'],
  intro: 'Un ravin de 4,6 m te sépare de l’autre île. Trop large pour sauter.',
  goal: 'Traverser le ravin.',
  inventory: { planche: 1, ballon: 1 },
  whatIf: ['ralenti', 'masse'],
  bonus: { text: 'Traverser sans tomber', check: (s) => s.falls === 0 },
  hints: [
    { id: 'edge', text: 'Un pont tient s’il repose sur ses DEUX bords. La planche fait 6 m : pose-la au bord, puis fais-la glisser à cheval sur le ravin.', when: (_a, f) => f.x > 2 },
  ],
  build(l) {
    l.island(0, 0, 12, 8, 0, 3, { trees: 3 });
    l.island(14.6, 0, 8, 8, 0, 3, { trees: 2, waterfall: true });
    l.crystal(8.3, 1.15, 0);
    l.crystal(17.6, 0.9, -3);
    return { spawn: v3(-3, 0, 0), goal: l.flag(16.6, 0, 0) };
  },
  lesson: {
    title: 'Les appuis',
    text: 'Ton poids appuie sur la planche, et la planche appuie sur ses deux bords. Chaque bord la repousse vers le haut : c’est la réaction d’appui. Si un bord manque, rien ne compense le poids et tout tombe.',
  },
};

const m4: Mission = {
  id: 'terra-4',
  num: 4,
  title: 'Le contrepoids',
  concept: 'Le centre de gravité',
  conceptKey: 'equilibre',
  related: ['levier', 'gravite'],
  intro: 'Ce ravin fait 6,5 m : la planche (6 m) ne suffit pas. Il faudra qu’elle dépasse dans le vide… sans basculer.',
  goal: 'Passer le grand ravin.',
  inventory: { planche: 1, caisse: 1, enclume: 1 },
  whatIf: ['ralenti', 'masse'],
  bonus: { text: 'N’utiliser que 2 pièces', check: (s) => s.partsUsed <= 2 },
  hints: [
    { id: 'edge', text: 'Pose la planche en porte-à-faux au-dessus du vide, avance au bout… puis saute !', when: (_a, f) => f.x > 3 },
    { id: 'tip', text: 'Ça bascule ? Mets un poids sur l’arrière de la planche : un contrepoids.', when: (a) => a.game.insights.some((i) => i.key === 'bascule') },
  ],
  build(l) {
    l.island(0, 0, 14, 8, 0, 3, { trees: 3 });
    l.island(16.5, 0, 6, 8, 0, 3, { trees: 1, waterfall: true });
    l.crystal(11.3, 1.7, 0);
    l.crystal(-5, 0.9, 3);
    return { spawn: v3(-4, 0, 0), goal: l.flag(17.5, 0, 0) };
  },
  onStep(api) {
    // Plank tipping over while the explorer is on it
    for (const e of api.game.placed) {
      if (e.part !== 'planche') continue;
      const r = e.pieces[0].body.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      if (up.y < 0.82 && !api.game.vars['tip' + e.id]) {
        api.game.vars['tip' + e.id] = 1;
        api.emit('bascule', {});
      }
    }
  },
  onRetry(api) {
    for (const k of Object.keys(api.game.vars)) if (k.startsWith('tip')) delete api.game.vars[k];
  },
  lesson: {
    title: 'Le centre de gravité',
    text: 'Tout se passe comme si le poids d’un objet était concentré en un point : son centre de gravité. Tant qu’il reste au-dessus de l’appui, l’objet tient. Ton poids au bout de la planche la fait tourner autour du bord. Un contrepoids lourd à l’arrière fait tourner dans l’autre sens : ça s’équilibre.',
  },
};

const m5: Mission = {
  id: 'terra-5',
  num: 5,
  title: 'La chute',
  concept: 'La chute libre',
  conceptKey: 'chute',
  related: ['gravite', 'masse'],
  intro: 'La porte s’ouvre si les deux plaques sont touchées EXACTEMENT en même temps. Tu as un boulet de 50 kg et un ballon de 1 kg. Lequel tombe le plus vite ?',
  goal: 'Toucher les deux plaques en même temps (lâcher d’au moins 2 m).',
  inventory: { boulet: 1, ballon: 1 },
  whatIf: ['ralenti', 'masse', 'gravite'],
  bonus: { text: 'Lâcher les deux de 5 m ou plus', check: (_s, api) => (api.game.vars.hMin ?? 0) >= 4.95 },
  hints: [
    { id: 'plates', text: 'Pose le boulet et le ballon au-dessus des plaques, puis monte-les avec ▲. Choisis bien leurs hauteurs !', when: (_a, f) => f.x > -1 },
  ],
  build(l) {
    l.island(4, 0, 24, 10, 0, 3, { trees: 3, waterfall: true });
    l.plate('A', 3, -1.6, 0, 1.4, 0.5);
    l.plate('B', 3, 1.6, 0, 1.4, 0.5);
    l.gate('porte', 8, 0, 0.6, 10, 3.4, 3.4);
    l.crystal(0, 0.9, 4);
    l.crystal(14, 0.9, -3);
    l.sign(1, -3.6, 0, 'Plaques ↓');
    return { spawn: v3(-5, 0, 0), goal: l.flag(13, 0, 0) };
  },
  onTest(api) {
    const g = api.game;
    g.vars.done = 0;
    const hs = g.placed.filter((e) => e.part === 'boulet' || e.part === 'ballon').map((e) => e.pieces[0].body.translation().y - 0.35);
    g.vars.hMin = hs.length === 2 ? Math.min(...hs) : 0;
    for (const e of g.placed) if (e.part === 'boulet' || e.part === 'ballon') g.vars['h_' + e.part] = e.pieces[0].body.translation().y - 0.35;
  },
  onStep(api) {
    const g = api.game;
    if (!g.tested || g.vars.done) return;
    const [a, b] = api.level.plates;
    if (a.firstPress === null || b.firstPress === null) {
      // Give up after a while if only one plate got hit
      if ((a.firstPress ?? b.firstPress) !== null && Math.max(a.firstPress ?? 0, b.firstPress ?? 0) > 0 && g.stats.time > 0) {
        const first = (a.firstPress ?? b.firstPress)!;
        if (api.level.time - (g.vars.firstSeen ?? (g.vars.firstSeen = api.level.time)) > 2.5) {
          g.vars.done = 1;
          api.emit('chute-rate', { ta: +(a.firstPress ?? -1).toFixed(2), tb: +(b.firstPress ?? -1).toFixed(2), first: +first.toFixed(2) });
          api.toast('Une seule plaque touchée… ↺ Réessaie !');
        }
      }
      return;
    }
    g.vars.done = 1;
    delete g.vars.firstSeen;
    const diff = Math.abs(a.firstPress - b.firstPress);
    const hb = g.vars.h_boulet ?? 0;
    const hl = g.vars.h_ballon ?? 0;
    const data = { ta: +a.firstPress.toFixed(2), tb: +b.firstPress.toFixed(2), hb: +hb.toFixed(1), hl: +hl.toFixed(1), diff: +diff.toFixed(2) };
    if (diff <= 0.1 && (g.vars.hMin ?? 0) >= 1.95) {
      api.openGate('porte');
      api.emit('chute-ok', data);
      api.toast('Même hauteur, même temps de chute : la porte s’ouvre !');
    } else {
      api.emit('chute-rate', data);
      api.toast(diff > 0.1 ? `Écart de ${data.diff.toFixed(2).replace('.', ',')} s : pas en même temps…` : 'Lâche-les d’au moins 2 m !');
    }
  },
  onRetry(api) {
    api.game.vars.done = 0;
    delete api.game.vars.firstSeen;
  },
  lesson: {
    title: 'La chute libre',
    text: 'Sans air pour freiner, tous les objets tombent à la même vitesse, quelle que soit leur masse ! Le boulet est 50 fois plus lourd, mais il est aussi 50 fois plus dur à mettre en mouvement : les deux effets s’annulent. Seule la hauteur compte : t = √(2h/g).',
  },
};

const m6: Mission = {
  id: 'terra-6',
  num: 6,
  title: 'Le ressort',
  concept: 'L’énergie élastique',
  conceptKey: 'ressort',
  related: ['energie', 'gravite'],
  intro: 'Une falaise de 5 m ! Un ressort comprimé garde de l’énergie… et la rend d’un coup.',
  goal: 'Atteindre le haut de la falaise.',
  inventory: { ressort: 1, caisse: 1 },
  whatIf: ['ralenti', 'masse', 'gravite'],
  bonus: {
    text: 'Envoyer la caisse sur la falaise',
    check: (_s, api) => api.game.placed.some((e) => e.part === 'caisse' && e.pieces[0].body.translation().x > 6.3 && e.pieces[0].body.translation().y > 4.8),
  },
  hints: [
    { id: 'spring', text: 'Pose le ressort au pied de la falaise et saute dessus !', when: (_a, f) => f.x > 1 },
    { id: 'high', text: 'Le cristal tout là-haut ? Plus tu tombes de haut sur le ressort, plus il te renvoie haut…', when: (a) => a.game.insights.some((i) => i.key === 'ressort') },
  ],
  build(l) {
    l.island(0, 0, 12, 8, 0, 3, { trees: 2, waterfall: true });
    l.island(11, 0, 10, 8, 5, 7, { trees: 2 });
    l.crystal(14.5, 5.9, 3);
    l.crystal(4.5, 12.3, 0);
    return { spawn: v3(-3, 0, 0), goal: l.flag(14, 5, 0) };
  },
  lesson: {
    title: 'L’énergie élastique',
    text: 'En s’écrasant, le ressort stocke de l’énergie, puis il la rend en se détendant. Il te renvoie l’énergie de ta chute, plus la sienne : tomber de haut sur un ressort, c’est rebondir encore plus haut. Et un ressort penché lance de biais !',
  },
};

const m7: Mission = {
  id: 'terra-7',
  num: 7,
  title: 'La catapulte',
  concept: 'Le levier',
  conceptKey: 'levier',
  related: ['energie', 'equilibre'],
  intro: 'Une vieille bascule, et une corniche à 3,5 m. Place-toi au bout du grand bras… et fais tomber quelque chose de lourd sur le petit.',
  goal: 'Te faire catapulter sur la corniche.',
  inventory: { enclume: 1, caisse: 1 },
  whatIf: ['ralenti', 'masse'],
  bonus: { text: 'Monter à plus de 6 m', check: (s) => s.maxY >= 6 },
  hints: [
    { id: 'lever', text: 'Mets-toi au bout du bras LONG (à gauche). Puis 🔧 : pose un poids au-dessus du bras COURT et monte-le avec ▲.', when: (_a, f) => f.x < 9 },
  ],
  build(l) {
    l.island(4, 0, 20, 8, 0, 3, { trees: 2, waterfall: true });
    l.island(-2.2, 0, 7.6, 8, 3.5, 6, { trees: 1 });
    l.seesaw(6, 0, 0.9, 6, 1, 0.21, 30);
    l.crystal(-1, 6.6, 0);
    l.crystal(12, 0.9, 3);
    return { spawn: v3(11, 0, 0), facing: -Math.PI / 2, goal: l.flag(-4.5, 3.5, 0), camYaw: -0.1 };
  },
  lesson: {
    title: 'Le levier',
    text: 'Une bascule tourne autour d’un pivot. Quand le bras court descend un peu, le bras long monte beaucoup… et donc beaucoup plus vite. Une lourde enclume qui tombe sur le bras court transmet son énergie au bout du bras long, et te propulse.',
  },
};

const m8: Mission = {
  id: 'terra-8',
  num: 8,
  title: 'La descente',
  concept: 'Énergie et hauteur',
  conceptKey: 'energie',
  related: ['pente', 'masse'],
  intro: 'Ce wagonnet transporte un noyau d’énergie. Il doit arriver sur le plateau d’en face, à 2,5 m de haut. D’où faut-il le lâcher ?',
  goal: 'Faire arriver le wagonnet sur le plateau d’en face, puis l’y rejoindre.',
  inventory: {},
  whatIf: ['ralenti', 'masse', 'frottement'],
  bonus: { text: 'Réussir du premier essai', check: (s) => s.tests <= 1 },
  hints: [
    { id: 'cart', text: 'Touche 🔧 Construire, touche le wagonnet et fais-le glisser sur la pente. Plus il part haut, plus il ira vite en bas.', when: () => true },
  ],
  build(l) {
    l.island(0, 0, 8, 8, 6, 9, { trees: 2, waterfall: true });
    l.island(17, 0, 6, 8, 0, 3, { flowers: false });
    l.island(32, 0, 10, 8, 2.5, 6, { trees: 2 });
    l.block(36.8, 0, 0.4, 8, 4, 1.5, MAT.stone);
    // Smooth roller-coaster-like track: down from 6 m, flat, up to 2.5 m
    const down = (x: number) => 3 + 3 * Math.cos((Math.PI * (x - 4)) / 10);
    const up = (x: number) => 1.25 - 1.25 * Math.cos((Math.PI * (x - 20)) / 7);
    l.profile(down, 4, 14, 0, 4);
    l.profile(up, 20, 27, 0, 4);
    // Guard rails keep the wagon on the track
    for (const z of [-2.1, 2.1]) {
      l.profile((x) => down(x) + 1, 3, 14, z, 0.16, MAT.brass, 1.2, true);
      l.profile(() => 1, 14, 20, z, 0.16, MAT.brass, 1.2, true);
      l.profile((x) => up(x) + 1, 20, 28, z, 0.16, MAT.brass, 1.2, true);
    }
    makeWagon(l, -1.2, 6.4);
    l.crystal(17, 0.9, 1.2);
    l.crystal(30, 3.4, -3);
    return { spawn: v3(-2.8, 6, -2), goal: l.flag(34, 2.5, 2.6), camYaw: -0.25 };
  },
  canFinish: (api) => !!api.game.vars.delivered,
  onStep(api) {
    const g = api.game;
    const w = api.level.entities.find((e) => e.tag === 'wagon');
    if (!w || !g.tested) return;
    const t = w.pieces[0].body.translation();
    const v = w.pieces[0].body.linvel();
    g.vars.maxX = Math.max(g.vars.maxX ?? -99, t.x);
    if (!g.vars.delivered && t.x > 27.5 && t.y > 2.3 && Math.hypot(v.x, v.y, v.z) < 0.6) {
      g.vars.delivered = 1;
      api.emit('energie-ok', {});
      api.toast('Wagonnet livré ! Rejoins-le sur le plateau.');
    }
    // Rolled back down: not enough energy to climb
    if (!g.vars.delivered && !g.vars.rolledBack && g.vars.maxX > 20.5 && g.vars.maxX < 27.3 && t.x < g.vars.maxX - 1) {
      g.vars.rolledBack = 1;
      api.emit('energie-rate', { h: +(g.vars.h0 ?? 0).toFixed(1) });
      api.toast('Le wagonnet redescend : pas assez d’énergie…');
    }
  },
  onTest(api) {
    const w = api.level.entities.find((e) => e.tag === 'wagon');
    api.game.vars.h0 = w ? w.pieces[0].body.translation().y - 0.5 : 0;
    api.game.vars.maxX = -99;
    api.game.vars.rolledBack = 0;
  },
  lesson: {
    title: 'Énergie et hauteur',
    text: 'En haut, le wagonnet a de l’énergie « en réserve » grâce à sa hauteur (énergie potentielle). En descendant, elle se transforme en vitesse (énergie cinétique), puis de nouveau en hauteur en remontant. Les frottements en volent un peu : il remonte toujours un peu moins haut que son point de départ.',
  },
};

const m9: Mission = {
  id: 'terra-9',
  num: 9,
  title: 'Le bloc de fonte',
  concept: 'Le frottement',
  conceptKey: 'frottement',
  related: ['masse', 'etsi-frottement'],
  intro: 'Il te faudrait une marche pour grimper. Ce bloc de fonte ferait l’affaire… mais il pèse 260 kg. Et si tu changeais les lois de la physique ?',
  goal: 'Pousser le bloc contre la falaise et grimper.',
  inventory: {},
  whatIf: ['ralenti', 'frottement', 'masse', 'gravite'],
  bonus: { text: 'Finir en moins de 60 s', check: (s) => s.time <= 60 },
  hints: [
    { id: 'push', text: 'Pousse le bloc en marchant contre lui.', when: (_a, f) => f.x > -2 },
    { id: 'whatif', text: 'Il ne bouge pas ? Ouvre ⚙ « Et si… ? » et essaie « Sans frottement ».', when: (a) => !!a.game.vars.stuck },
  ],
  build(l) {
    l.island(0, 0, 16, 8, 0, 3, { trees: 3, waterfall: true });
    l.island(13, 0, 10, 8, 2, 5, { trees: 2 });
    const b = obj(l, 'caisse', 2.5, 0.52, 0, false, 'bloc');
    makeIronBlock(l, b);
    l.crystal(16, 2.9, 3);
    l.crystal(-6, 0.9, -3);
    return { spawn: v3(-4, 0, 0), goal: l.flag(15, 2, 0) };
  },
  onStep(api, dt) {
    const g = api.game;
    const b = api.level.entities.find((e) => e.tag === 'bloc');
    if (!b) return;
    const t = b.pieces[0].body.translation();
    const v = b.pieces[0].body.linvel();
    const f = g.player.feet;
    // Walking into the block but not moving: `vel` is the intended velocity, so compare with the real displacement
    const moved = Math.hypot(f.x - (g.vars.lastFx ?? f.x), f.z - (g.vars.lastFz ?? f.z));
    g.vars.lastFx = f.x;
    g.vars.lastFz = f.z;
    const touching = Math.abs(f.x - t.x) < 1.2 && Math.abs(f.z - t.z) < 1.1 && Math.hypot(g.player.vel.x, g.player.vel.z) > 1 && moved < 0.3 * dt;
    if (touching && Math.hypot(v.x, v.z) < 0.05 && !g.whatIf.has('frottement')) {
      g.vars.pushT = (g.vars.pushT ?? 0) + dt;
      if (g.vars.pushT > 1.2 && !g.vars.stuck) {
        g.vars.stuck = 1;
        api.emit('frottement-bloque', {});
      }
    } else g.vars.pushT = 0;
  },
  lesson: {
    title: 'Le frottement',
    text: 'Quand deux surfaces glissent l’une sur l’autre, leurs petites aspérités s’accrochent : c’est le frottement. Il est proportionnel au poids. Pour 260 kg, il faut plus de 1 500 N pour faire glisser le bloc : bien trop pour toi. Sans frottement, même une petite force le met en mouvement !',
  },
};

const m10: Mission = {
  id: 'terra-10',
  num: 10,
  title: 'La fusée',
  concept: 'Action et réaction',
  conceptKey: 'fusee',
  related: ['gravite', 'energie', 'masse'],
  intro: 'Un canyon de 12 m. Le pont d’énergie se déploiera quand le noyau arrivera de l’autre côté. À toi de l’y envoyer !',
  goal: 'Envoyer le noyau de l’autre côté du canyon.',
  inventory: { chariot: 1, fusee: 2, planche: 1 },
  whatIf: ['ralenti', 'masse', 'gravite', 'frottement'],
  bonus: { text: 'Avec une seule fusée', check: (_s, api) => api.game.placed.filter((e) => e.part === 'fusee').length <= 1 },
  hints: [
    { id: 'rocket', text: 'Pose le chariot, mets le noyau dedans, puis colle une fusée à l’arrière du chariot (elle s’accroche toute seule).', when: (_a, f) => f.x > -4 },
  ],
  build(l) {
    l.island(-1, 0, 14, 8, 0, 3, { trees: 2 });
    l.ramp(1.6, 0, 6, 1.4, 0, 3, MAT.stone, 0.4);
    l.block(5.6, 0, 0.3, 2.6, 1.05, 1.05, MAT.stone); // pillar under the ramp lip
    l.island(24, 0, 12, 8, 0, 3, { trees: 2, waterfall: true });
    l.block(29.8, 0, 0.4, 8, 3, 3, MAT.stone);
    l.hiddenGate('pont', 12, 0, 12, 2.4, 0, 0.3);
    const n = obj(l, 'ballon', -4, 0.4, 0, true, 'noyau');
    makeCore(n);
    l.crystal(12, 4.5, 0);
    l.crystal(-6.5, 0.9, 3);
    return { spawn: v3(-6, 0, -2), goal: l.flag(27, 0, 0) };
  },
  canFinish: (api) => !!api.game.vars.delivered,
  onStep(api, dt) {
    const g = api.game;
    const n = api.level.entities.find((e) => e.tag === 'noyau');
    if (!n) return;
    const t = n.pieces[0].body.translation();
    g.vars.maxX = Math.max(g.vars.maxX ?? -99, t.x);
    // On the far side for a moment (it may still be rolling: that's fine)
    g.vars.farT = t.x > 18.5 && t.y > -0.5 && t.y < 3 ? (g.vars.farT ?? 0) + dt : 0;
    if (!g.vars.delivered && g.vars.farT > 0.25) {
      g.vars.delivered = 1;
      api.level.revealGate('pont');
      api.emit('fusee-ok', {});
      api.toast('Noyau livré ! Le pont d’énergie se déploie.');
    }
    if (t.y < -10 && !g.vars.lost && !g.vars.delivered) {
      g.vars.lost = 1;
      api.emit('fusee-rate', { x: +((g.vars.maxX ?? 0) - 6).toFixed(1) });
      api.toast('Le noyau est tombé dans le canyon… ↺ Réessaie !');
    }
  },
  onTest(api) {
    api.game.vars.lost = 0;
    api.game.vars.maxX = -99;
  },
  lesson: {
    title: 'Action et réaction',
    text: 'Une fusée éjecte des gaz très vite vers l’arrière ; en retour, les gaz la poussent vers l’avant. C’est la troisième loi de Newton : à chaque action correspond une réaction égale et opposée. Plus l’ensemble est léger, plus cette poussée le fait accélérer.',
  },
};

/** Free play: every part, every "What if". */
export const SANDBOX: Mission = {
  id: 'sandbox',
  num: 0,
  title: 'Bac à sable',
  concept: 'Expériences libres',
  conceptKey: 'gravite',
  related: ['chute', 'ressort', 'levier', 'fusee', 'aimant', 'frottement', 'masse'],
  intro: 'Toutes les pièces, toutes les lois à modifier. Expérimente !',
  goal: 'Expérimente librement.',
  inventory: { planche: 20, caisse: 20, boulet: 10, ballon: 10, enclume: 10, chariot: 6, ressort: 10, aimant: 6, fusee: 10 },
  whatIf: ['gravite', 'frottement', 'ralenti', 'masse'],
  bonus: { text: '—', check: () => false },
  build(l) {
    l.island(0, 0, 40, 30, 0, 4, { trees: 8, waterfall: true });
    l.island(26, 6, 10, 10, 3, 5, { trees: 2 });
    l.ramp(10, 0, 20, 4, -9, 4);
    l.block(22, -9, 4, 4, 4, 4, MAT.stone);
    l.seesaw(-8, 8, 0.9, 6, 1, 0.21, 30);
    l.plate('A', 6, 6, 0);
    l.plate('B', 6, 9, 0);
    for (let i = 0; i < 6; i++) l.crystal(-14 + i * 5, 0.9, -12);
    return { spawn: v3(0, 0, 0), goal: null };
  },
  lesson: { title: 'Bac à sable', text: '' },
};

export const MISSIONS: Mission[] = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10];

// ---------------------------------------------------------------- special objects

/** Turn a ball into the glowing energy core (5 kg). */
function makeCore(e: Entity) {
  e.label = 'Noyau d’énergie';
  e.mass = 5;
  const p = e.pieces[0];
  p.body.collider(0).setShape(new RAPIER.Ball(0.26));
  e.half.set(0.26, 0.26, 0.26);
  p.body.collider(0).setMass(5);
  p.body.collider(0).setRestitution(0.05);
  p.body.collider(0).setFriction(1);
  p.mesh.clear();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), MAT.glow);
  const shell = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 24), MAT.brass);
  const shell2 = shell.clone();
  shell2.rotation.y = Math.PI / 2;
  p.mesh.add(core, shell, shell2);
  e.part = null;
}

/**
 * The mission 8 wagon: one rigid body sliding on a rounded skid (stable on curves),
 * kept on the track's plane. Its wheels only turn for show.
 */
function makeWagon(l: Level, x: number, y: number) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.1), MAT.wood);
  deck.position.y = 0.05;
  const side = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.08), MAT.brass);
  side.position.set(0, 0.3, 0.51);
  const side2 = side.clone();
  side2.position.z = -0.51;
  const end = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 1.1), MAT.brass);
  end.position.set(-0.86, 0.3, 0);
  const end2 = end.clone();
  end2.position.x = 0.86;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), MAT.glow);
  core.position.y = 0.45;
  g.add(deck, side, side2, end, end2, core);
  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [[0.62, 0.6], [0.62, -0.6], [-0.62, 0.6], [-0.62, -0.6]]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 18), MAT.rubber);
    wh.rotation.x = Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.position.set(wx, -0.05, wz);
    pivot.add(wh);
    g.add(pivot);
    wheels.push(pivot);
  }
  const body = l.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, 0).setCanSleep(false).setCcdEnabled(true));
  const skid = RAPIER.ColliderDesc.capsule(0.6, 0.3)
    .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
    .setTranslation(0, -0.03, 0)
    .setMass(40)
    .setFriction(0.05)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
  l.world.createCollider(skid, body);
  body.setEnabledTranslations(true, true, false, true);
  body.setEnabledRotations(false, false, true, true);
  const e: Entity = {
    id: 0,
    part: null,
    label: 'Wagonnet + noyau',
    pieces: [{ body, mesh: g, localPos: new THREE.Vector3(), localRot: new THREE.Quaternion() }],
    joints: [],
    movable: true,
    fromInventory: false,
    metal: true,
    mass: 40,
    half: new THREE.Vector3(0.95, 0.33, 0.6),
    bottom: 0.33,
    pos: new THREE.Vector3(x, y, 0),
    yaw: 0,
    tilt: 0,
    lift: 0,
    fixed: false,
    tag: 'wagon',
    lockZ: 0,
    followSlope: true,
  };
  l.addEntity(e);
  l.animated.push((_t, dt) => {
    const v = body.linvel();
    const spin = (Math.hypot(v.x, v.y) * Math.sign(v.x) * dt) / 0.28;
    for (const w of wheels) w.rotation.z -= spin;
  });
  return e;
}

/** Turn a crate into a 260 kg cast-iron block. */
function makeIronBlock(_l: Level, e: Entity) {
  e.label = 'Bloc de fonte';
  e.mass = 260;
  e.metal = true;
  const c = e.pieces[0].body.collider(0);
  c.setMass(260);
  c.setFriction(0.6);
  const m = e.pieces[0].mesh as THREE.Mesh;
  m.material = MAT.darkMetal;
  e.part = null;
}
