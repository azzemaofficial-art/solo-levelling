// ─────────────────────────────────────────────────────────────────────────────
// Motore del manichino MMA: pose di uno scheletro 2D (vista laterale, atleta che
// guarda a destra; "l" = lato anteriore, "r" = posteriore) e interpolazione tra
// pose con i tempi del gesto reale. Condiviso da MmaTechnique (lezioni) e
// MmaComboPlayer (combo). Tutto procedurale: qualsiasi velocità, specchiabile
// per i mancini, pochi byte invece di video.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE = {
  head: [163, 43], neck: [162, 66], sl: [175, 81], sr: [153, 81],
  el: [188, 109], fl: [181, 60], er: [133, 103], fr: [145, 57],
  hl: [172, 123], hr: [157, 123], kl: [190, 160], ftl: [212, 193], kr: [135, 158], ftr: [115, 193], dx: 0,
};
const pose = (over) => ({ ...BASE, ...over });

// Posture di partenza abbassata (montanti, colpi al corpo, schivate)
const DIP = { head: [165, 50], neck: [163, 72], sl: [176, 87], sr: [154, 87], hl: [172, 127], hr: [157, 127], kl: [192, 162], kr: [134, 161] };
const LOW = { head: [168, 58], neck: [166, 80], sl: [178, 95], sr: [156, 95], hl: [173, 130], hr: [158, 130], kl: [194, 165], kr: [136, 163] };
const REAR_SWING = { sr: [150, 83], er: [124, 98], fr: [110, 80] }; // braccio dietro che bilancia i calci

export const POSES = {
  base: BASE,
  tight: pose({ head: [165, 46], el: [186, 104], fl: [179, 55], er: [137, 100], fr: [149, 53] }),
  // pugni
  jab: pose({ head: [168, 44], neck: [165, 66], sl: [179, 80], el: [226, 77], fl: [282, 75], kl: [194, 160] }),
  cross: pose({ head: [170, 45], neck: [166, 67], sr: [162, 80], er: [222, 80], fr: [276, 79], hr: [165, 123], kr: [146, 158], ftr: [124, 190] }),
  hookLoad: pose({ sl: [176, 82], el: [202, 96], fl: [206, 72] }),
  hook: pose({ head: [166, 46], neck: [164, 67], sl: [170, 79], el: [203, 70], fl: [233, 66], hl: [170, 122], ftl: [209, 192] }),
  rearHook: pose({ head: [168, 45], neck: [166, 66], sr: [161, 80], er: [197, 72], fr: [228, 68], hr: [165, 123], kr: [146, 158], ftr: [124, 190] }),
  upperLoad: pose({ ...DIP, el: [187, 116], fl: [192, 100], er: [138, 110], fr: [150, 64] }),
  uppercut: pose({ head: [165, 44], sl: [176, 80], el: [199, 90], fl: [214, 50] }),
  rearUpperLoad: pose({ ...DIP, er: [150, 118], fr: [170, 103], el: [190, 112], fl: [184, 66] }),
  rearUpper: pose({ head: [168, 45], sr: [161, 80], er: [188, 94], fr: [207, 53], hr: [165, 123], ftr: [122, 190] }),
  bodyHook: pose({ ...LOW, el: [202, 112], fl: [228, 112], er: [136, 114], fr: [148, 72] }),
  bodyCross: pose({ ...LOW, head: [172, 58], sr: [166, 94], er: [214, 108], fr: [266, 112], el: [192, 120], fl: [186, 74], hr: [166, 130], kr: [146, 163], ftr: [124, 190] }),
  // gomiti e clinch
  leadElbow: pose({ head: [166, 45], sl: [176, 80], el: [211, 64], fl: [185, 56] }),
  rearElbow: pose({ head: [168, 45], sr: [163, 80], er: [209, 66], fr: [183, 58], hr: [165, 123], ftr: [122, 190] }),
  clinch: pose({ head: [170, 46], neck: [167, 67], el: [206, 76], fl: [229, 64], er: [196, 82], fr: [225, 70] }),
  rearKnee: pose({ head: [172, 48], neck: [168, 68], el: [204, 90], fl: [223, 82], er: [194, 94], fr: [219, 86], hr: [166, 120], kr: [209, 106], ftr: [185, 146] }),
  // calci
  teepChamber: pose({ head: [158, 44], neck: [159, 66], hl: [174, 121], kl: [208, 119], ftl: [205, 159] }),
  teep: pose({ head: [152, 46], neck: [155, 68], sl: [170, 82], hl: [176, 120], kl: [222, 120], ftl: [271, 122] }),
  lowKickChamber: pose({ head: [160, 45], neck: [160, 67], hr: [165, 122], kr: [181, 146], ftr: [168, 178], er: [128, 92], fr: [138, 72] }),
  lowKick: pose({ ...REAR_SWING, head: [156, 47], neck: [158, 68], hr: [168, 122], kr: [206, 152], ftr: [247, 168] }),
  bodyKickChamber: pose({ head: [158, 46], neck: [159, 67], hr: [166, 121], kr: [193, 128], ftr: [173, 160], er: [127, 95], fr: [132, 76] }),
  bodyKick: pose({ ...REAR_SWING, head: [152, 48], neck: [156, 69], hr: [170, 120], kr: [211, 114], ftr: [265, 110] }),
  headKickChamber: pose({ head: [154, 48], neck: [157, 69], hr: [168, 120], kr: [197, 112], ftr: [183, 140], er: [124, 98], fr: [128, 80] }),
  headKick: pose({ ...REAR_SWING, head: [146, 52], neck: [152, 72], sl: [168, 86], el: [182, 112], fl: [178, 70], hr: [172, 118], kr: [215, 92], ftr: [263, 57] }),
  switchStep: pose({ kl: [161, 160], ftl: [150, 193], kr: [172, 158], ftr: [191, 193] }),
  switchKick: pose({ head: [152, 48], neck: [156, 69], el: [176, 110], fl: [170, 76], hl: [174, 120], kl: [213, 114], ftl: [267, 110], kr: [170, 158], ftr: [188, 193] }),
  // difesa
  check: pose({ head: [161, 44], el: [186, 104], fl: [179, 55], kl: [201, 134], ftl: [209, 168] }),
  slip: pose({ head: [175, 55], neck: [171, 75], sl: [183, 89], sr: [161, 89], el: [195, 115], fl: [189, 69], er: [143, 109], fr: [155, 65], hl: [174, 125], hr: [158, 125], kl: [195, 161] }),
  roll: pose({ head: [158, 77], neck: [160, 96], sl: [172, 105], sr: [150, 105], el: [186, 131], fl: [180, 85], er: [132, 125], fr: [144, 81], hl: [170, 132], hr: [156, 132], kl: [196, 168], kr: [132, 166] }),
  parry: pose({ head: [162, 44], er: [152, 96], fr: [177, 63] }),
  feint: pose({ head: [166, 44], sl: [178, 80], el: [197, 95], fl: [198, 64] }),
  // lotta
  levelChange: pose({ head: [184, 92], neck: [178, 104], sl: [188, 110], sr: [170, 112], el: [204, 132], fl: [213, 108], er: [181, 134], fr: [195, 112], hl: [166, 142], hr: [152, 142], kl: [199, 168], kr: [138, 166] }),
  doubleLeg: pose({ dx: 26, head: [214, 118], neck: [204, 122], sl: [206, 124], sr: [190, 128], el: [229, 142], fl: [245, 132], er: [215, 150], fr: [237, 146], hl: [172, 142], hr: [160, 144], kl: [211, 176], ftl: [199, 193], kr: [169, 190], ftr: [128, 193] }),
  sprawl: pose({
    head: [103, 105], neck: [118, 112], sl: [126, 116], sr: [121, 119], el: [126, 150], fl: [122, 185], er: [118, 152], fr: [131, 186],
    hl: [182, 134], hr: [178, 138], kl: [214, 152], ftl: [262, 176], kr: [210, 160], ftr: [241, 186],
  }),
  // spostamenti
  leadStep: pose({ kl: [201, 159], ftl: [236, 193], dx: 4 }),
  stepped: pose({ dx: 24 }),
  rearBack: pose({ dx: 24, kr: [128, 158], ftr: [92, 193] }),
};

export const EASE = {
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2),
  out: (t) => 1 - (1 - t) ** 3,
};
const lerp = (a, b, t) => a + (b - a) * t;
export const mixPose = (p, q, t) => {
  const out = {};
  for (const key of Object.keys(BASE)) out[key] = Array.isArray(BASE[key]) ? [lerp(p[key][0], q[key][0], t), lerp(p[key][1], q[key][1], t)] : lerp(p[key], q[key], t);
  return out;
};

// Keyframe: { pose, move (ms), hold (ms), curve: 'io' | 'out', tag }
export const timelineDuration = (keys) => keys.reduce((sum, k) => sum + k.move + k.hold, 0);

// Posa al tempo `ms` (0 ≤ ms < durata). `from` = posa di partenza del primo keyframe.
export function sampleKeys(keys, ms, from = BASE) {
  let t = Math.max(0, ms);
  let prev = from;
  for (const k of keys) {
    const to = POSES[k.pose] || BASE;
    if (t < k.move) return { pose: mixPose(prev, to, EASE[k.curve || 'io'](t / k.move)), tag: k.tag, striking: k.curve === 'out' };
    t -= k.move;
    if (t < k.hold) return { pose: to, tag: k.tag, holding: k.curve === 'out' };
    t -= k.hold;
    prev = to;
  }
  const last = keys[keys.length - 1];
  return { pose: POSES[last?.pose] || BASE, tag: last?.tag };
}

export const isUpright = (p) => p.head[1] < 80;
