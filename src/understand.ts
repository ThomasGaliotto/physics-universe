/**
 * 💡 COMPRENDRE — explanations of what the player just saw.
 * Each entry: a simple explanation (may use live measurements), an animation, an optional formula,
 * and an experiment to check it yourself.
 */

type Data = Record<string, number | string>;

export interface Explanation {
  title: string;
  text: (d: Data) => string;
  anim: AnimKey;
  formula?: string;
  experiment: string;
}

const n = (v: number | string | undefined, digits = 1) => (typeof v === 'number' ? v.toFixed(digits).replace('.', ',') : String(v ?? '?'));

export const EXPLAIN: Record<string, Explanation> = {
  gravite: {
    title: 'Pourquoi je retombe ?',
    text: () =>
      'La planète attire tout ce qui a une masse vers son centre : c’est la gravité. Quand tu sautes, ta vitesse vers le haut diminue de 9,8 m/s chaque seconde. Elle s’annule au sommet, puis tu redescends de plus en plus vite. Ton saut dessine une courbe : une parabole.',
    anim: 'parabole',
    formula: 'Poids : P = m × g   (g = 9,8 m/s²)\nToi : 60 kg × 9,8 = 588 N',
    experiment: 'Saute sur place, puis en courant : tu montes exactement à la même hauteur ! Avancer ne change rien à la chute.',
  },
  tombe: {
    title: 'Tu es tombé !',
    text: () =>
      'Plus rien ne te soutenait : ton poids t’a tiré vers le bas. En chute, tu accélères : après 1 s tu tombes à 9,8 m/s, après 2 s à 19,6 m/s. Sur Terra, les îles flottent… mais pas toi !',
    anim: 'chute1',
    formula: 'Vitesse : v = g × t\nDistance : h = ½ × g × t²',
    experiment: 'Active ⚙ « Temps ralenti » et laisse-toi tomber : regarde comme tu vas de plus en plus vite.',
  },
  chute: {
    title: 'Le lourd tombe-t-il plus vite ?',
    text: () =>
      'Non ! Sans air pour freiner, un boulet de 50 kg et un ballon de 1 kg lâchés de la même hauteur arrivent en même temps. Le boulet est plus attiré, mais il est aussi plus difficile à mettre en mouvement : les deux effets s’annulent exactement. Seule la hauteur compte.',
    anim: 'galilee',
    formula: 'Temps de chute : t = √(2 × h ÷ g)\nDe 5 m : t = √(10 ÷ 9,8) ≈ 1,01 s',
    experiment: 'Lâche les deux de 3 m, puis de 6 m : le temps change avec la hauteur, jamais avec la masse.',
  },
  'chute-ok': {
    title: 'En même temps !',
    text: (d) =>
      `Plaque A : ${n(d.ta, 2)} s, plaque B : ${n(d.tb, 2)} s. Boulet lâché de ${n(d.hb)} m, ballon de ${n(d.hl)} m. Même hauteur, même temps : la masse ne change rien à la vitesse de chute. Galilée l’a montré il y a 400 ans !`,
    anim: 'galilee',
    formula: 't = √(2 × h ÷ g)   (la masse n’apparaît pas !)',
    experiment: 'Active ⚙ « Double masse » et recommence : le résultat ne change pas.',
  },
  'chute-rate': {
    title: 'Pas en même temps…',
    text: (d) =>
      d.ta !== undefined && d.hb !== undefined
        ? `Plaque A : ${n(d.ta, 2)} s, plaque B : ${n(d.tb, 2)} s. Le boulet est parti de ${n(d.hb)} m et le ballon de ${n(d.hl)} m. Le temps de chute ne dépend que de la hauteur : pour arriver ensemble, il faut lâcher les deux de la même hauteur.`
        : 'Une seule plaque a été touchée. Il faut un objet au-dessus de chaque plaque.',
    anim: 'galilee',
    formula: 't = √(2 × h ÷ g)',
    experiment: 'Mets le boulet et le ballon exactement à la même hauteur (▲▼ affiche la hauteur).',
  },
  masse: {
    title: 'Masse et poids',
    text: () =>
      'La masse (en kg) mesure la quantité de matière. Le poids (en newtons) est la force avec laquelle la planète t’attire. Doubler la masse double le poids… mais double aussi l’inertie : un objet lourd est plus dur à lancer, à freiner, à pousser.',
    anim: 'galilee',
    formula: 'P = m × g',
    experiment: 'Active ⚙ « Double masse » : les chutes ne changent pas, mais pousser devient deux fois plus dur.',
  },
  pente: {
    title: 'Pourquoi la rampe aide ?',
    text: () =>
      'Sur une pente, seule une partie de ton poids te tire vers le bas de la rampe. Plus la pente est douce, plus cette partie est petite : chaque pas demande moins d’effort. En échange, le chemin est plus long. On ne gagne jamais sur tout : moins de force, mais plus de distance.',
    anim: 'pente',
    formula: 'Force le long de la pente : F = P × sin(α)\nÀ 30° : F = P ÷ 2',
    experiment: 'Incline la planche davantage (⤾) : au-delà d’environ 50°, impossible de monter.',
  },
  appuis: {
    title: 'Comment tient un pont ?',
    text: () =>
      'Ton poids appuie sur la planche. La planche appuie à son tour sur les deux bords du ravin, et chaque bord la repousse vers le haut : ce sont les réactions d’appui. Leur somme compense exactement le poids. S’il manque un appui, plus rien ne compense : tout tombe.',
    anim: 'pont',
    formula: 'Équilibre : R₁ + R₂ = P',
    experiment: 'Pose la planche avec un seul bord sur la falaise, puis marche dessus…',
  },
  equilibre: {
    title: 'Le centre de gravité',
    text: () =>
      'La planche tourne autour du bord de la falaise. Ton poids au bout la fait tourner vers le vide ; un contrepoids à l’arrière la fait tourner dans l’autre sens. Ce qui compte, c’est le poids multiplié par la distance au bord (le moment). Le côté au moment le plus grand gagne.',
    anim: 'balance',
    formula: 'Équilibre : m₁ × d₁ = m₂ × d₂\nToi : 60 kg × 2,8 m = 168\nEnclume : 100 kg × 2,5 m = 250 ✓',
    experiment: 'Compare la caisse (25 kg) et l’enclume (100 kg) comme contrepoids.',
  },
  bascule: {
    title: 'La planche a basculé !',
    text: () =>
      'Quand tu avances vers le bout, ton poids fait tourner la planche autour du bord de la falaise. Rien à l’arrière ne compensait : le centre de gravité de l’ensemble planche + toi est passé au-dessus du vide, et tout a basculé.',
    anim: 'balance',
    formula: 'Ça bascule si : m_toi × d_toi > m_arrière × d_arrière',
    experiment: 'Ajoute un poids sur l’arrière de la planche, le plus loin possible du bord.',
  },
  ressort: {
    title: 'L’énergie du ressort',
    text: (d) =>
      d.v !== undefined
        ? `Tu es arrivé sur le ressort à ${n(d.vin)} m/s et il t’a renvoyé à ${n(d.v)} m/s. En s’écrasant, il a stocké l’énergie de ta chute, puis te l’a rendue en y ajoutant la sienne. Tomber de plus haut, c’est rebondir plus haut !`
        : 'Un ressort comprimé stocke de l’énergie (énergie élastique), puis la rend en se détendant. Il te renvoie l’énergie de ta chute, plus la sienne.',
    anim: 'ressort',
    formula: 'Énergie élastique : E = ½ × k × x²\nHauteur atteinte : h = v² ÷ (2g)',
    experiment: 'Saute sur le ressort depuis le sol, puis depuis la falaise : compare les hauteurs.',
  },
  'ressort-objet': {
    title: 'Le ressort lance aussi les objets',
    text: (d) => `Le ressort a lancé ${String(d.label ?? 'l’objet').toLowerCase()} à ${n(d.v)} m/s. Il pousse le long de son axe : penche-le (⤾) et il lancera de biais.`,
    anim: 'ressort',
    formula: 'v = √(v_arrivée² + v_ressort²)',
    experiment: 'Penche le ressort de 20° et pose une caisse dessus.',
  },
  levier: {
    title: 'La catapulte',
    text: (d) =>
      `${d.v !== undefined ? `Le bout du grand bras t’a lancé à ${n(d.v)} m/s ! ` : ''}La bascule tourne autour du pivot. Le bras long est 4 fois plus long que le bras court : quand le bras court descend de 1 m, le bout du bras long monte de 4 m… dans le même temps, donc 4 fois plus vite.`,
    anim: 'levier',
    formula: 'v_long = v_court × (d_long ÷ d_court)',
    experiment: 'Lâche l’enclume de plus haut (▲), ou essaie la caisse : compare la hauteur atteinte.',
  },
  energie: {
    title: 'Hauteur ↔ vitesse',
    text: () =>
      'En haut de la pente, le chariot a de l’énergie « en réserve » grâce à sa hauteur : l’énergie potentielle. En descendant, elle se transforme en vitesse : l’énergie cinétique. En remontant, la vitesse redevient hauteur. Sans frottement, il remonte exactement à sa hauteur de départ, jamais plus.',
    anim: 'energie',
    formula: 'm × g × h = ½ × m × v²   →   v = √(2 × g × h)\n(la masse s’annule !)',
    experiment: 'Pose le chariot plus bas sur la pente : jusqu’où remonte-t-il en face ?',
  },
  'energie-rate': {
    title: 'Pas assez haut !',
    text: (d) =>
      `Le wagonnet est parti d’environ ${n(d.h)} m de haut. En roulant, les frottements lui volent un peu d’énergie : il remonte toujours moins haut que son point de départ. Toute sa vitesse est redevenue hauteur avant d’atteindre le plateau (2,5 m), alors il redescend.`,
    anim: 'energie',
    formula: 'Hauteur atteinte ≤ hauteur de départ\n(égale seulement sans frottement)',
    experiment: 'Place le wagonnet plus haut sur la pente, ou essaie ⚙ « Sans frottement ».',
  },
  'energie-ok': {
    title: 'Livré !',
    text: () => 'Parti assez haut, le wagonnet avait assez d’énergie pour remonter de l’autre côté, malgré les frottements. Ce qu’il restait de vitesse s’est arrêté contre le mur.',
    anim: 'energie',
    formula: 'Ep (haut) → Ec (bas) → Ep (en face)',
    experiment: 'Active ⚙ « Double masse » : arrive-t-il plus loin ? (indice : non !)',
  },
  frottement: {
    title: 'Le frottement',
    text: () =>
      'Les surfaces ne sont jamais parfaitement lisses : leurs petites bosses s’accrochent. Pour faire glisser un objet, il faut vaincre ce frottement, qui augmente avec le poids. Le bloc de fonte pèse 260 kg : il faudrait plus de 1 500 N pour le pousser, et tu n’en as que 520.',
    anim: 'frottement',
    formula: 'Frottement : F = μ × m × g\n0,6 × 260 × 9,8 ≈ 1 530 N',
    experiment: 'Active ⚙ « Sans frottement » : même un petit effort le fait glisser… et il ne s’arrête plus tout seul !',
  },
  'frottement-bloque': {
    title: 'Le bloc ne bouge pas !',
    text: () =>
      'Tu pousses avec 520 N, mais le frottement entre le bloc et le sol le retient avec jusqu’à 1 530 N. Tant que ta force est plus petite, le frottement l’annule exactement : rien ne bouge.',
    anim: 'frottement',
    formula: 'Le bloc glisse si : F_poussée > μ × m × g',
    experiment: 'Ouvre ⚙ « Et si… ? » et supprime le frottement.',
  },
  fusee: {
    title: 'Action, réaction',
    text: () =>
      'La fusée éjecte ses gaz vers l’arrière à toute vitesse. En retour, les gaz poussent la fusée vers l’avant, avec la même force : c’est l’action et la réaction (3e loi de Newton). Plus l’objet poussé est léger, plus il accélère.',
    anim: 'fusee',
    formula: 'Accélération : a = F ÷ m\n350 N sur 50 kg : a = 7 m/s²',
    experiment: 'Essaie une fusée, puis deux, ou retire le chariot : la distance change.',
  },
  'fusee-ok': {
    title: 'Livré par la voie des airs !',
    text: () =>
      'La poussée de la fusée a donné de la vitesse au chariot ; la rampe l’a orienté vers le haut. Ensuite, comme toi quand tu sautes, il a suivi une parabole jusqu’à l’autre bord.',
    anim: 'fusee',
    formula: 'Portée ≈ v² × sin(2α) ÷ g',
    experiment: 'Réessaie avec une seule fusée, ou en changeant l’angle de la rampe.',
  },
  'fusee-rate': {
    title: 'Dans le canyon…',
    text: (d) =>
      `Le noyau a parcouru environ ${n(d.x)} m au-dessus du canyon, qui en fait 12. Il lui fallait plus de vitesse, ou un meilleur angle de départ. Attention aussi à bien l’attacher : s’il tombe du chariot, il ne profite pas de la poussée.`,
    anim: 'fusee',
    formula: 'Plus de vitesse → parabole plus longue',
    experiment: 'Ajoute une deuxième fusée, ou vérifie que la fusée pointe vers l’avant.',
  },
  aimant: {
    title: 'Le magnétisme',
    text: (d) =>
      `L’aimant attire le métal${d.label ? ` (ici : ${String(d.label).toLowerCase()})` : ''} sans le toucher. Cette force augmente très vite quand on se rapproche : deux fois plus près, quatre fois plus fort. Le bois et les ballons, eux, ne sont pas attirés.`,
    anim: 'aimant',
    formula: 'F ∝ 1 ÷ d²',
    experiment: 'Pose un boulet à 2 m, puis à 6 m de l’aimant.',
  },
  'etsi-gravite': {
    title: 'Et si la gravité s’inversait ?',
    text: () =>
      'Les objets « tombent » maintenant vers le ciel, avec la même accélération de 9,8 m/s². Tes bottes gravitationnelles te gardent au sol. Dans la réalité, la gravité attire toujours : elle ne repousse jamais.',
    anim: 'chute1',
    formula: 'g = + 9,8 m/s² (vers le haut)',
    experiment: 'Pose une caisse et un ballon : ils montent ensemble, eux aussi !',
  },
  'etsi-frottement': {
    title: 'Et s’il n’y avait plus de frottement ?',
    text: () =>
      'Tout glisse comme sur de la glace parfaite. Un objet poussé ne s’arrête plus tout seul : sans frottement, rien ne le freine (1re loi de Newton). Dans l’espace, c’est ce qui arrive vraiment.',
    anim: 'frottement',
    formula: 'Sans force, la vitesse reste constante',
    experiment: 'Pousse un objet, puis lâche-le : il continue à la même vitesse.',
  },
  'etsi-ralenti': {
    title: 'Le temps ralenti',
    text: () => 'Tout se déroule 4 fois plus lentement : idéal pour observer une chute, un rebond ou un lancer. Les lois de la physique, elles, ne changent pas.',
    anim: 'parabole',
    formula: '1 seconde de jeu = 4 secondes réelles',
    experiment: 'Lance une expérience en ralenti et observe les trajectoires.',
  },
  'etsi-masse': {
    title: 'Et si tout pesait deux fois plus lourd ?',
    text: () =>
      'Les objets sont deux fois plus lourds, donc deux fois plus difficiles à pousser et à soulever. Mais ils tombent exactement à la même vitesse : la chute ne dépend pas de la masse !',
    anim: 'galilee',
    formula: 'P = m × g   mais   t = √(2h ÷ g)',
    experiment: 'Refais une chute en double masse : chronomètre-la.',
  },
};

// ------------------------------------------------------------------ animations

export type AnimKey = 'parabole' | 'chute1' | 'galilee' | 'pente' | 'pont' | 'balance' | 'ressort' | 'levier' | 'energie' | 'frottement' | 'fusee' | 'aimant';

const C = { line: 'rgba(255,255,255,0.85)', soft: 'rgba(255,255,255,0.35)', cyan: '#5fe6ff', gold: '#ffd36b', pink: '#ff7ab8', red: '#ff5a5a', green: '#6dff9e', dark: '#2b2f45' };

function arrow(g: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string, label?: string) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  g.strokeStyle = g.fillStyle = color;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + dx, y + dy);
  g.stroke();
  const a = Math.atan2(dy, dx);
  g.beginPath();
  g.moveTo(x + dx, y + dy);
  g.lineTo(x + dx - 9 * Math.cos(a - 0.45), y + dy - 9 * Math.sin(a - 0.45));
  g.lineTo(x + dx - 9 * Math.cos(a + 0.45), y + dy - 9 * Math.sin(a + 0.45));
  g.closePath();
  g.fill();
  if (label) {
    g.font = 'bold 13px "Baloo 2", system-ui';
    g.fillText(label, x + dx + 6, y + dy + 4);
  }
}

function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function ground(g: CanvasRenderingContext2D, y: number, x0: number, x1: number) {
  g.strokeStyle = C.soft;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, color = C.line, size = 13) {
  g.fillStyle = color;
  g.font = `bold ${size}px "Baloo 2", system-ui`;
  g.fillText(s, x, y);
}

/** Draws frame `t` (seconds) of an explanation animation in a w×h canvas. */
export function drawAnim(key: AnimKey, g: CanvasRenderingContext2D, t: number, w: number, h: number) {
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  const gy = h - 24;
  switch (key) {
    case 'parabole': {
      ground(g, gy, 10, w - 10);
      const T = 2.2;
      const k = (t % (T + 0.6)) / T;
      const x0 = 30;
      const span = w - 70;
      const H = h - 70;
      const pos = (u: number) => ({ x: x0 + u * span, y: gy - 12 - 4 * H * u * (1 - u) });
      g.setLineDash([3, 6]);
      g.strokeStyle = C.soft;
      g.beginPath();
      for (let u = 0; u <= Math.min(k, 1); u += 0.02) {
        const p = pos(u);
        if (u === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke();
      g.setLineDash([]);
      const u = Math.min(k, 1);
      const p = pos(u);
      ball(g, p.x, p.y, 11, C.cyan);
      const vy = -4 * H * (1 - 2 * u) * 0.25;
      arrow(g, p.x, p.y, span * 0.25 * 0.5, vy * 0.5, C.cyan, 'v');
      arrow(g, p.x, p.y, 0, 34, C.gold, 'P');
      break;
    }
    case 'chute1': {
      ground(g, gy, 10, w - 10);
      const k = (t % 2.4) / 1.6;
      const top = 20;
      for (let i = 0; i <= 5; i++) {
        const u = i / 5;
        const y = top + (gy - 12 - top) * u * u;
        g.globalAlpha = 0.25;
        ball(g, w / 2 - 50, y, 9, C.cyan);
        g.globalAlpha = 1;
        text(g, `${(u * 1.0).toFixed(1).replace('.', ',')} s`, w / 2 - 95, y + 4, C.soft, 11);
      }
      const u = Math.min(k, 1);
      const y = top + (gy - 12 - top) * u * u;
      ball(g, w / 2 + 30, y, 11, C.cyan);
      arrow(g, w / 2 + 30, y, 0, 10 + 50 * u, C.cyan, 'v');
      arrow(g, w / 2 + 70, y, 0, 30, C.gold, 'P');
      break;
    }
    case 'galilee': {
      ground(g, gy, 10, w - 10);
      const k = Math.min(1, (t % 2.6) / 1.4);
      const top = 26;
      const y = top + (gy - 14 - top) * k * k;
      ball(g, w * 0.35, y, 14, '#1f2330');
      g.strokeStyle = C.line;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(w * 0.35, y, 14, 0, Math.PI * 2);
      g.stroke();
      ball(g, w * 0.65, y + 3, 11, C.red);
      text(g, '50 kg', w * 0.35 - 18, top - 8, C.line, 12);
      text(g, '1 kg', w * 0.65 - 12, top - 8, C.line, 12);
      text(g, `${(k * 1.01).toFixed(2).replace('.', ',')} s`, w / 2 - 18, h / 2, C.gold, 16);
      break;
    }
    case 'pente': {
      const x0 = 20;
      const x1 = w - 20;
      const y1 = 30;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.moveTo(x0, gy);
      g.lineTo(x1, gy);
      g.lineTo(x1, y1);
      g.closePath();
      g.fill();
      g.strokeStyle = C.line;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0, gy);
      g.lineTo(x1, y1);
      g.stroke();
      const a = Math.atan2(gy - y1, x1 - x0);
      const u = ((t * 0.35) % 1) * 0.8 + 0.1;
      const bx = x0 + (x1 - x0) * u;
      const by = gy - (gy - y1) * u;
      g.save();
      g.translate(bx, by);
      g.rotate(-a);
      g.fillStyle = C.cyan;
      g.fillRect(-12, -24, 24, 24);
      g.restore();
      const cx = bx - Math.sin(a) * 12;
      const cy = by - Math.cos(a) * 12;
      arrow(g, cx, cy, 0, 44, C.gold, 'P');
      arrow(g, cx, cy, -Math.cos(a) * 44 * Math.sin(a), 44 * Math.sin(a) * Math.sin(a), C.pink, 'F');
      text(g, 'α', x0 + 34, gy - 6, C.gold, 14);
      break;
    }
    case 'pont': {
      const cyc = t % 4;
      const broken = cyc > 2.2;
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(0, gy - 30, w * 0.25, 54);
      g.fillRect(w * 0.75, gy - 30, w * 0.25, 54);
      const drop = broken ? Math.min(1, (cyc - 2.2) / 0.8) : 0;
      g.save();
      g.translate(w * 0.75, gy - 36);
      g.rotate(drop * 0.9);
      g.fillStyle = '#c98a4b';
      g.fillRect(-w * 0.58, 0, w * 0.6, 8);
      g.restore();
      if (!broken) {
        arrow(g, w / 2, gy - 50, 0, 40, C.gold, 'P');
        arrow(g, w * 0.2, gy - 10, 0, -40, C.green, 'R₁');
        arrow(g, w * 0.8, gy - 10, 0, -40, C.green, 'R₂');
      } else {
        text(g, 'Un seul appui : ça tombe !', w / 2 - 80, 20, C.red);
      }
      if (broken) {
        g.fillStyle = 'rgba(0,0,0,0)';
      }
      break;
    }
    case 'balance': {
      const cyc = t % 6;
      const withWeight = cyc > 3;
      const px = w * 0.45;
      const py = gy - 40;
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(0, py + 6, px, h - py);
      const u = Math.min(1, (cyc % 3) / 2);
      const pos = 0.15 + 0.8 * u; // explorer position along the overhang
      const tip = !withWeight && pos > 0.55;
      const ang = tip ? Math.min(0.8, (pos - 0.55) * 3) : 0;
      g.save();
      g.translate(px, py);
      g.rotate(ang);
      g.fillStyle = '#c98a4b';
      g.fillRect(-w * 0.3, -6, w * 0.62, 7);
      const ex = w * 0.3 * pos;
      ball(g, ex, -18, 10, C.cyan);
      arrow(g, ex, -8, 0, 30, C.gold);
      if (withWeight) {
        g.fillStyle = '#4a4f5c';
        g.fillRect(-w * 0.28, -26, 26, 20);
        arrow(g, -w * 0.28 + 13, -6, 0, 40, C.gold);
      }
      g.restore();
      ball(g, px, py + 4, 4, C.pink);
      text(g, withWeight ? 'Avec contrepoids : ça tient' : 'Sans contrepoids…', 12, 18, withWeight ? C.green : C.red);
      break;
    }
    case 'ressort': {
      ground(g, gy, 10, w - 10);
      const cyc = (t % 2.4) / 2.4;
      const sx = w / 2;
      let comp = 0;
      let by: number;
      const top = gy - 40;
      if (cyc < 0.35) {
        const u = cyc / 0.35;
        by = 20 + (top - 20) * u * u;
      } else if (cyc < 0.5) {
        comp = Math.sin(((cyc - 0.35) / 0.15) * Math.PI);
        by = top + comp * 18;
      } else {
        const u = (cyc - 0.5) / 0.5;
        by = top - (top - 20) * (1 - (1 - u) * (1 - u));
      }
      const springTop = top + 12 + comp * 18;
      g.strokeStyle = C.line;
      g.lineWidth = 3;
      g.beginPath();
      const turns = 6;
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const y = gy - u * (gy - springTop);
        const x = sx + Math.sin(u * Math.PI * 2 * turns) * 16;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = C.red;
      g.fillRect(sx - 24, springTop - 4, 48, 6);
      ball(g, sx, by - 12, 11, C.cyan);
      // energy bar
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(w - 40, 20, 14, gy - 30);
      g.fillStyle = C.gold;
      const e = comp;
      g.fillRect(w - 40, 20 + (gy - 30) * (1 - e), 14, (gy - 30) * e);
      text(g, 'E', w - 37, 14, C.gold, 12);
      break;
    }
    case 'levier': {
      ground(g, gy, 10, w - 10);
      const cyc = (t % 3) / 3;
      const px = w * 0.62;
      const py = gy - 30;
      const L = w * 0.42;
      const S = L / 4;
      let ang = 0.38; // long arm down
      let wy = 10;
      let by = 0;
      if (cyc < 0.35) {
        const u = cyc / 0.35;
        wy = 10 + (py - S * Math.sin(ang) - 30 - 10) * u * u;
      } else {
        const u = Math.min(1, (cyc - 0.35) / 0.12);
        ang = 0.38 - 0.76 * u;
        wy = py + S * Math.sin(-ang) - 30;
        const fly = Math.max(0, (cyc - 0.47) / 0.5);
        by = -fly * (py - 20) * (2 - fly);
      }
      g.save();
      g.translate(px, py);
      g.rotate(-ang);
      g.fillStyle = '#c98a4b';
      g.fillRect(-L, -4, L + S, 7);
      g.restore();
      g.fillStyle = C.line;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - 10, gy);
      g.lineTo(px + 10, gy);
      g.closePath();
      g.fill();
      const ex = px - L * Math.cos(ang);
      const ey = py + L * Math.sin(ang) - 14;
      ball(g, ex, Math.min(ey, ey + by), 10, C.cyan);
      g.fillStyle = '#4a4f5c';
      g.fillRect(px + S * Math.cos(ang) - 14, wy, 28, 22);
      text(g, 'd long', px - L / 2 - 16, gy + 16, C.soft, 11);
      text(g, 'd court', px + 2, gy + 16, C.soft, 11);
      break;
    }
    case 'energie': {
      const cx = w / 2;
      const R = w * 0.36;
      const cy = 18;
      g.strokeStyle = C.line;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = -1 + (2 * i) / 40;
        const x = cx + a * R;
        const y = cy + (1 - a * a) * (gy - cy - 30) + 0;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      const a = Math.cos(t * 1.6) * 0.92;
      const x = cx + a * R;
      const y = cy + (1 - a * a) * (gy - cy - 30);
      ball(g, x, y - 10, 10, C.cyan);
      const ep = a * a;
      const ec = 1 - ep;
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(12, gy - 10, 80, 10);
      g.fillRect(w - 92, gy - 10, 80, 10);
      g.fillStyle = C.gold;
      g.fillRect(12, gy - 10, 80 * ep, 10);
      g.fillStyle = C.cyan;
      g.fillRect(w - 92, gy - 10, 80 * ec, 10);
      text(g, 'hauteur', 12, gy + 14, C.gold, 12);
      text(g, 'vitesse', w - 92, gy + 14, C.cyan, 12);
      break;
    }
    case 'frottement': {
      const cyc = t % 5;
      const smooth = cyc > 2.5;
      g.strokeStyle = smooth ? C.cyan : C.line;
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 10; x < w - 10; x += 8) {
        const y = gy + (smooth ? 0 : (x / 8) % 2 ? -4 : 0);
        if (x === 10) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      const bx = smooth ? 60 + ((cyc - 2.5) / 2.5) * (w - 160) : 60;
      g.fillStyle = '#4a4f5c';
      g.fillRect(bx, gy - 46, 50, 44);
      arrow(g, bx - 46, gy - 24, 40, 0, C.cyan, '');
      text(g, 'poussée', bx - 60, gy - 34, C.cyan, 11);
      if (!smooth) {
        arrow(g, bx + 50, gy - 6, 40, 0, C.red, 'frottement');
        g.save();
        g.translate(bx + 50, gy - 6);
        g.restore();
      }
      text(g, smooth ? 'Sans frottement : ça glisse !' : 'Le frottement retient le bloc', 12, 18, smooth ? C.green : C.red);
      break;
    }
    case 'fusee': {
      const cyc = (t % 3) / 3;
      const x = 40 + cyc * (w - 120);
      const y = h / 2;
      for (let i = 0; i < 14; i++) {
        const k = ((t * 3 + i / 14) % 1);
        g.globalAlpha = 1 - k;
        ball(g, x - 30 - k * 70, y + Math.sin(i * 7) * 10 * k, 4 + k * 5, i % 2 ? C.gold : '#ff8a3d');
      }
      g.globalAlpha = 1;
      g.fillStyle = '#f2f2f2';
      g.fillRect(x - 26, y - 9, 40, 18);
      g.fillStyle = C.red;
      g.beginPath();
      g.moveTo(x + 14, y - 9);
      g.lineTo(x + 30, y);
      g.lineTo(x + 14, y + 9);
      g.closePath();
      g.fill();
      arrow(g, x + 34, y - 24, 40, 0, C.cyan, 'réaction');
      arrow(g, x - 30, y + 26, -40, 0, C.gold, 'action');
      break;
    }
    case 'aimant': {
      const cyc = (t % 3) / 3;
      const mx = 50;
      const my = h / 2;
      g.strokeStyle = C.red;
      g.lineWidth = 12;
      g.beginPath();
      g.arc(mx, my, 24, -Math.PI / 2, Math.PI / 2, true);
      g.stroke();
      g.lineWidth = 2;
      for (let i = 1; i <= 3; i++) {
        g.strokeStyle = `rgba(95,230,255,${0.5 - i * 0.12})`;
        g.beginPath();
        g.arc(mx, my, 24 + i * 22 + ((t * 30) % 22), -0.8, 0.8);
        g.stroke();
      }
      const d = 1 - cyc * cyc;
      const bx = mx + 50 + d * (w - 140);
      ball(g, bx, my, 12, '#1f2330');
      g.strokeStyle = C.line;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(bx, my, 12, 0, Math.PI * 2);
      g.stroke();
      const f = Math.min(70, 600 / Math.pow(1 + d * 9, 2) + 8);
      arrow(g, bx - 14, my, -f, 0, C.cyan, '');
      break;
    }
  }
}
