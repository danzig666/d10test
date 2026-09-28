'use strict';
// ---------------------------------------------------------------------------
// Pixel art. All sprites are original drawings for this remake.
// Colour keys: w white, c cyan, m magenta, k black, '.' transparent.
// Every sprite faces right; drawSprite() mirrors it when needed.
// ---------------------------------------------------------------------------

const CAT_HEAD = [
  '..w........w...w',
  '.w.........wwwww',
  '.w.........wkwkw',
  '..w........wwmww',
  '..w.........www.',
  '...wwwwwwwwcwww.',
  '..wwwwwwwwwcwww.',
  '..wwwwwwwwwwwww.',
  '...wwwwwwwwwww..',
];

const CAT_LEGS = {
  stand: ['...w.w.....w.w..', '...w.w.....w.w..', '...w.w.....w.w..'],
  walk1: ['...ww.......ww..', '...w.w.....w.w..', '..w...w...w...w.'],
  walk2: ['....ww....ww....', '....ww....ww....', '....w.w...w.w...'],
  jump: ['..w..........w..', '.w............w.', 'w..............w'],
};

function catFrames(remap) {
  const f = {};
  for (const k in CAT_LEGS) f[k] = makeSprite(CAT_HEAD.concat(CAT_LEGS[k]), remap);
  return f;
}

// Swimming pose: stretched out, paws paddling.
const CAT_SWIM_ROWS = [
  [
    '..............w...w',
    '..............wwwww',
    'ww............wkwkw',
    '..wwwwwwwwwwwwwwmww',
    '..wwwwwwwwwwwwwwww.',
    '...wwwwwwwwwwwwww..',
    '..w..w......w..w...',
  ],
  [
    '..............w...w',
    '..............wwwww',
    '..............wkwkw',
    'wwwwwwwwwwwwwwwwmww',
    '..wwwwwwwwwwwwwwww.',
    '...wwwwwwwwwwwwww..',
    '....w..w..w..w.....',
  ],
];

// Little head used for the lives counter.
const LIFE_ICON = ['w...w', 'wwwww', 'wkwkw', 'wwmww', '.www.'];

const DOG_RUN = [
  [
    '...............ww...',
    '..............wccw..',
    '..............cckcc.',
    'c.............cccckc',
    '.c...........ccccccc',
    '..cccccccccccmmmccw.',
    '.cccccccccccccccccw.',
    '.cccccccccccccccc...',
    '.cccccccccccccccc...',
    '..cccccccccccccc....',
    '..cc.cc.....cc.cc...',
    '..cc.cc.....cc.cc...',
    '.ccc.ccc...ccc.ccc..',
  ],
  [
    '...............ww...',
    '..............wccw..',
    '..............cckcc.',
    '..............cccckc',
    'cc...........ccccccc',
    '..cccccccccccmmmccw.',
    '.cccccccccccccccccw.',
    '.cccccccccccccccc...',
    '.cccccccccccccccc...',
    '..cccccccccccccc....',
    '...cc..cc...cc..cc..',
    '..cc....cc.cc....cc.',
    '.ccc....ccccc....ccc',
  ],
];

const DOG_SLEEP = [
  '......................ww..',
  '.....................wccw.',
  '.....ccccccccccccc..ccccc.',
  '...cccccccccccccccccckkcc.',
  '..ccccccccccccccccccccccck',
  '.cccccccccccccccccmmmccccc',
  'ccccccccccccccccccccccccw.',
  '.cccccccccccccccccccccc...',
  'cc..cccc........cccc.cccc.',
];

const MOUSE = [
  ['.....cc.', '..ccccwc', '.cccccck', 'c.c..c..'],
  ['.....cc.', '..ccccwc', '.cccccck', 'c..cc...'],
];

const FISH = makeSprite([
  '...mmmm...',
  'm.mmmmmmw.',
  'mmmmmmmmmm',
  'm.mmmmmmm.',
  '...mmmm...',
]);

const SPIDER = [
  makeSprite([
    'm.m.m.m',
    '.mmmmm.',
    'mmwmwmm',
    '.mmmmm.',
    'm.m.m.m',
  ]),
  makeSprite([
    '.m.m.m.',
    'mmmmmmm',
    '.mwmwm.',
    'mmmmmmm',
    '.m.m.m.',
  ]),
];

const BIRD = [
  makeSprite([
    'w......w..',
    '.w....w...',
    '..wccw....',
    '.ccccccwm.',
    'cccccccc..',
    '...m.m....',
  ]),
  makeSprite([
    '..........',
    '..........',
    '..ccccc...',
    '.ccccccwm.',
    'cwwwwwcc..',
    '..wwm.m...',
  ]),
];

// Thrown junk. Small, drawn procedurally in a 7x7 box centred on (x, y).
const JUNK = {
  boot: makeSprite(['..ww...', '..ww...', '..ww...', '..www..', '.wwwwww', '.mmmmmm']),
  bottle: makeSprite(['...c...', '...c...', '..ccc..', '..ccc..', '..cwc..', '..ccc..', '..ccc..']),
  clock: makeSprite(['m.....m', '.wwwww.', 'ww.k.ww', 'ww.kkww', 'ww...ww', '.wwwww.', 'm.....m']),
  can: makeSprite(['.mmmmm.', '.wwwww.', '.wmmmw.', '.wwwww.', '.wmmmw.', '.wwwww.', '.mmmmm.']),
  bone: makeSprite(['w.....w', '.wwwww.', 'w.....w']),
};

// Cat variants: the player (white), rival toms (cyan) and the sweetheart (magenta).
const SPR = {};
function buildSprites() {
  SPR.cat = catFrames({});
  SPR.rival = catFrames({ w: 'c', c: 'm', m: 'k' });
  SPR.sweet = catFrames({ w: 'm', c: 'w', m: 'w' });
  SPR.swim = CAT_SWIM_ROWS.map((r) => makeSprite(r));
  SPR.life = makeSprite(LIFE_ICON);
  SPR.dog = DOG_RUN.map((r) => makeSprite(r));
  SPR.dogSleep = makeSprite(DOG_SLEEP);
  SPR.dogAwake = makeSprite(DOG_SLEEP.map((r, i) => (i === 3 ? r.replace('kk', 'wk') : r)));
  SPR.mouse = MOUSE.map((r) => makeSprite(r, { c: 'm' }));
  SPR.mouseWhite = MOUSE.map((r) => makeSprite(r, { c: 'w', w: 'm' }));
}
buildSprites();

// Standard animated cat drawing used by every scene.
function drawCatSprite(set, x, y, dir, state, t, opts = {}) {
  let f = set.stand;
  if (state === 'air') f = set.jump;
  else if (state === 'walk') f = Math.floor(t * 8) % 2 ? set.walk1 : set.walk2;
  drawSprite(f, x, y, dir < 0, !!opts.upsideDown);
}

// A bow for the sweetheart.
function drawBow(x, y) {
  px(x - 2, y, 'w'); px(x - 1, y + 1, 'w'); px(x, y, 'c'); px(x + 1, y + 1, 'w'); px(x + 2, y, 'w');
  px(x - 2, y + 1, 'w'); px(x + 2, y + 1, 'w');
}

// A big pixel heart centred on (x, y).
function drawHeart(x, y, s, c) {
  const rows = s > 1
    ? ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...']
    : ['x.x', 'xxx', '.x.'];
  const w = rows[0].length;
  rows.forEach((r, j) => {
    for (let i = 0; i < w; i++) if (r[i] === 'x') px(x - (w >> 1) + i, y - 3 + j, c);
  });
}

// The broom that chases the cat out of rooms.
function drawBroom(x, y, t, dir) {
  const sway = Math.round(Math.sin(t * 10) * 3);
  line(x + sway * 2 + dir * 10, y - 44, x + sway, y - 12, 'w');
  line(x + sway * 2 + dir * 10 + 1, y - 44, x + sway + 1, y - 12, 'w');
  rect(x + sway - 3, y - 13, 8, 3, 'm');
  for (let i = -8; i <= 9; i++) {
    const top = y - 10;
    line(x + sway + Math.round(i / 3), top, x + i + sway, y, i % 2 ? 'c' : 'w');
  }
}
