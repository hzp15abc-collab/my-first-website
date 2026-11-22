/* Fruit Motion — lightweight canvas game engine. No camera, DOM controls or
 * network dependency: any input adapter can supply timed points here. */

const TAU = Math.PI * 2;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const mix = (a, b, t) => a + (b - a) * t;
const random = (a, b) => mix(a, b, Math.random());
const now = () => globalThis.performance?.now?.() ?? Date.now();

export const FRUIT_POINTS = 10;
export const BOMB_PENALTY = 10;
export const TRACK_GAP_MS = 280;
export const SWIPE_WINDOW_MS = 210;
export const COLLISION_HISTORY_MS = 120;

export const FRUIT_TYPES = Object.freeze(['watermelon', 'orange', 'apple', 'kiwi', 'strawberry', 'banana', 'grape', 'pineapple', 'pear', 'peach']);
const COLORS = {
  watermelon: { skin: '#299d63', flesh: '#ff647a', fleshLight: '#ffbac0', juice: '#ff6782' },
  orange: { skin: '#ed8c1f', flesh: '#ffa623', fleshLight: '#ffe0a3', juice: '#ffd44f' },
  apple: { skin: '#d83d4f', flesh: '#ffe3a0', fleshLight: '#fff7d4', juice: '#ffd27b' },
  kiwi: { skin: '#9d7250', flesh: '#99d65a', fleshLight: '#e8f6bb', juice: '#a9eb71' },
  strawberry: { skin: '#e94564', flesh: '#ff8c9d', fleshLight: '#ffe5d8', juice: '#ff7992' },
  banana: { skin: '#f5bc30', flesh: '#ffe8aa', fleshLight: '#fff9de', juice: '#ffe169' },
  grape: { skin: '#885ac6', flesh: '#d7a2ee', fleshLight: '#f4dafa', juice: '#b58aed' },
  pineapple: { skin: '#d68b28', flesh: '#fbd35d', fleshLight: '#fff1a5', juice: '#ffcf57' },
  pear: { skin: '#75ab45', flesh: '#edf0a8', fleshLight: '#fffdd5', juice: '#bde474' },
  peach: { skin: '#ed826a', flesh: '#ffd6a6', fleshLight: '#fff1ce', juice: '#ffae92' },
};

const MODES = {
  easy: { radius: 0.105, minRadius: 35, maxRadius: 72, spawn: [1.16, 1.6], maxObjects: 3, gravity: 0.9, bombRate: 0.075, bombGrace: 10, maxDrift: 0.1, swipeSpeed: 65 },
  active: { radius: 0.1365, minRadius: 45.5, maxRadius: 93.6, spawn: [1.08, 1.32], maxObjects: 3, gravity: 0.9, bombRate: 0.15, bombGrace: 7, maxDrift: 0.06, swipeSpeed: 65 },
  normal: { radius: 0.08, minRadius: 30, maxRadius: 58, spawn: [0.8, 1.12], maxObjects: 4, gravity: 1.35, bombRate: 0.13, bombGrace: 6, maxDrift: 0.15, swipeSpeed: 95 },
  hard: { radius: 0.065, minRadius: 27, maxRadius: 48, spawn: [0.55, 0.84], maxObjects: 5, gravity: 1.8, bombRate: 0.2, bombGrace: 4, maxDrift: 0.2, swipeSpeed: 130 },
};
export const GAME_LIMITS = Object.freeze({ particles: 100, halves: 24, popups: 18 });

/** Shortest distance from a point to a finite segment (including endpoints). */
export function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-9) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / d2, 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Swept blade capsule against a circular target. All inputs in CSS pixels. */
export function segmentCircleHit(a, b, circle, bladeRadius = 0) {
  return pointSegmentDistance(circle.x, circle.y, a.x, a.y, b.x, b.y) <= circle.r + bladeRadius;
}

function ellipse(ctx, x, y, rx, ry, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), angle, 0, TAU);
}

function fillEllipse(ctx, x, y, rx, ry, color, angle = 0) {
  ellipse(ctx, x, y, rx, ry, angle);
  ctx.fillStyle = color;
  ctx.fill();
}

function bodyGradient(ctx, r, a, b, c) {
  const g = ctx.createRadialGradient(-r * .32, -r * .43, r * .02, r * .045, r * .11, r * 1.15);
  g.addColorStop(0, a); g.addColorStop(.37, b); g.addColorStop(.69, b); g.addColorStop(1, c);
  return g;
}

function thickOutline(ctx, color, r) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.7, r * .052);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function glowDot(ctx, x, y, r) {
  // Directional glaze, not an animated flare. Cached with the fruit itself.
  const g = ctx.createRadialGradient(x-r*.10,y-r*.08,0,x,y,r*.38);
  g.addColorStop(0,'rgba(255,255,255,.86)');g.addColorStop(.55,'rgba(255,255,255,.43)');g.addColorStop(1,'rgba(255,255,255,.025)');
  fillEllipse(ctx,x+r*.05,y-r*.045,r*.32,r*.125,g,-.51);
  fillEllipse(ctx,x-r*.065,y+r*.016,r*.095,r*.038,'rgba(255,255,255,.80)',-.51);
}

function skinRim(ctx,r,x,y,w,h,angle=0){
  ctx.beginPath();ctx.ellipse(x,y,w,h,angle,.21*Math.PI,.69*Math.PI);
  ctx.lineWidth=r*.026;ctx.lineCap='round';ctx.strokeStyle='rgba(255,244,190,.47)';ctx.stroke();
}

function leaf(ctx, x, y, r, angle = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(r * .15, -r * .66, r * .78, -r * .59, r * .85, -r * .2);
  ctx.bezierCurveTo(r * .5, r * .12, r * .17, r * .13, 0, 0);
  ctx.fillStyle = bodyGradient(ctx, r, '#d6fa91', '#49bb62', '#1e723e'); ctx.fill();
  ctx.strokeStyle = '#245f41'; ctx.lineWidth = Math.max(1, r * .045); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * .08, -r * .04); ctx.quadraticCurveTo(r * .38, -r * .25, r * .68, -r * .25);
  ctx.strokeStyle = 'rgba(245,255,209,.5)'; ctx.lineWidth = Math.max(1, r * .025); ctx.stroke();
  ctx.restore();
}

/** Hand-authored vector fruit illustrations. The same art is used for halves. */
function fruitArt(ctx, type, r) {
  if (type === 'watermelon') {
    ellipse(ctx, 0, 0, r * .96, r * .9, -.13);
    ctx.fillStyle = bodyGradient(ctx, r, '#dbff9e', '#65c34e', '#1a773a'); ctx.fill(); thickOutline(ctx, '#165b3a', r);
    ctx.save(); ellipse(ctx, 0, 0, r * .94, r * .88, -.13); ctx.clip();
    for (let k = -2; k <= 2; k++) {
      const x = k * r * .49;
      ctx.beginPath(); ctx.moveTo(x - r * .14, -r);
      ctx.bezierCurveTo(x + r * .27, -r * .38, x - r * .34, r * .23, x + r * .12, r);
      ctx.lineWidth = r * .108; ctx.strokeStyle = '#227a47'; ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-r*.19,-r);ctx.bezierCurveTo(x+r*.22,-r*.38,x-r*.39,r*.23,x+r*.07,r);
      ctx.lineWidth=r*.024;ctx.strokeStyle='rgba(238,255,181,.48)';ctx.stroke();
    }
    glowDot(ctx,-r*.39,-r*.43,r);skinRim(ctx,r,0,0,r*.79,r*.72,-.13);ctx.restore();
  } else if (type === 'orange') {
    ellipse(ctx, 0, r * .04, r * .93, r * .89);
    ctx.fillStyle = bodyGradient(ctx, r, '#fff4a0', '#ffb229', '#d75515'); ctx.fill(); thickOutline(ctx, '#a84f20', r);
    for (let i = 0; i < 36; i++) {
      const a = i * 2.39996, d = r * (.20 + .59*Math.sqrt((i+1)/36));
      const x=Math.cos(a)*d,y=Math.sin(a)*d+r*.05;
      fillEllipse(ctx,x,y,r*.023,r*.020,'rgba(169,70,22,.36)');fillEllipse(ctx,x-r*.010,y-r*.013,r*.011,r*.009,'rgba(255,240,172,.65)');
    }
    leaf(ctx, r * .08, -r * .78, r * .68, -.5); glowDot(ctx, -r * .39, -r * .36, r);skinRim(ctx,r,0,r*.04,r*.79,r*.73);
  } else if (type === 'apple') {
    ctx.beginPath(); ctx.moveTo(0, -r * .62);
    ctx.bezierCurveTo(-r * 1.06, -r * 1.24, -r * 1.18, r * .44, -r * .48, r * .83);
    ctx.bezierCurveTo(-r * .16, r * 1.05, -r * .08, r * .79, 0, r * .84);
    ctx.bezierCurveTo(r * .1, r * .79, r * .19, r * 1.03, r * .48, r * .83);
    ctx.bezierCurveTo(r * 1.18, r * .44, r * 1.08, -r * 1.2, 0, -r * .62);
    ctx.fillStyle = bodyGradient(ctx, r, '#ffb09a', '#f94e60', '#ad1c47'); ctx.fill(); thickOutline(ctx, '#8c2848', r);
    ctx.beginPath(); ctx.moveTo(0, -r * .7); ctx.quadraticCurveTo(-r * .06, -r * .9, r * .09, -r * 1.04);
    ctx.strokeStyle = '#825234'; ctx.lineWidth = r * .105; ctx.lineCap = 'round'; ctx.stroke();
    leaf(ctx, r * .04, -r * .86, r * .72, -.05); glowDot(ctx, -r * .49, -r * .36, r);
    ctx.beginPath();ctx.moveTo(-r*.48,r*.68);ctx.quadraticCurveTo(-r*.21,r*.88,-r*.09,r*.77);ctx.moveTo(r*.10,r*.77);ctx.quadraticCurveTo(r*.37,r*.87,r*.55,r*.60);ctx.strokeStyle='rgba(255,207,167,.48)';ctx.lineWidth=r*.029;ctx.lineCap='round';ctx.stroke();
  } else if (type === 'kiwi') {
    ellipse(ctx, 0, 0, r * .91, r * .94, -.22);
    ctx.fillStyle = bodyGradient(ctx, r, '#edc888', '#b88b58', '#80502e'); ctx.fill(); thickOutline(ctx, '#65432e', r);
    for (let i = 0; i < 34; i++) {
      const a = i * 2.39996, d = r * (.26 + .58*Math.sqrt((i+1)/34));
      fillEllipse(ctx, Math.cos(a) * d, Math.sin(a) * d, r * .018, r * .034, 'rgba(110,71,38,.52)', a);
    }
    // A little exposed green face makes this recognizably a kiwi.
    ellipse(ctx, r * .24, r * .16, r * .6, r * .58, -.12); ctx.fillStyle = bodyGradient(ctx,r,'#e3ff9b','#92d957','#4caa41'); ctx.fill();
    ctx.strokeStyle = '#806039'; ctx.lineWidth = r * .10; ctx.stroke();
    fillEllipse(ctx, r * .24, r * .16, r * .21, r * .22, '#eff8ba');
    for (let i = 0; i < 18; i++) {
      const a = i * TAU / 18, dx=Math.cos(a),dy=Math.sin(a);
      const x=r*.24+dx*r*.38,y=r*.16+dy*r*.37;
      ctx.beginPath();ctx.moveTo(r*.24+dx*r*.22,r*.16+dy*r*.23);ctx.lineTo(r*.24+dx*r*.51,r*.16+dy*r*.49);ctx.strokeStyle='rgba(239,255,172,.57)';ctx.lineWidth=r*.013;ctx.stroke();
      fillEllipse(ctx,x,y,r*.043,r*.024,'#49362d',a);
    }
    glowDot(ctx, -r * .46, -r * .45, r);
  } else if (type === 'strawberry') {
    ctx.beginPath(); ctx.moveTo(0, r * .95);
    ctx.bezierCurveTo(-r * .35, r * .95, -r * 1.02, r * .12, -r * .89, -r * .44);
    ctx.bezierCurveTo(-r * .8, -r * .96, -r * .18, -r * .81, 0, -r * .69);
    ctx.bezierCurveTo(r * .18, -r * .81, r * .8, -r * .96, r * .89, -r * .44);
    ctx.bezierCurveTo(r * 1.02, r * .12, r * .35, r * .95, 0, r * .95);
    ctx.fillStyle = bodyGradient(ctx, r, '#ffb998', '#f84772', '#b82555'); ctx.fill(); thickOutline(ctx, '#a1244c', r);
    for (let row = 0; row < 4; row++) {
      const num = 4 - Math.max(0, row - 1), y = -r * .39 + row * r * .28;
      for (let i = 0; i < num; i++) {
        const x = (i - (num - 1) / 2) * r * .32 + (row % 2 ? r * .05 : 0);
        fillEllipse(ctx,x,y,r*.061,r*.075,'rgba(157,42,59,.56)',x/r*.7);
        fillEllipse(ctx, x-r*.008, y-r*.012, r * .040, r * .053, '#ffe08b', x / r * .7);
      }
    }
    for (let k = -1; k <= 1; k++) leaf(ctx, 0, -r * .68, r * .54, k * 1.02 + 1.15);
    leaf(ctx, 0, -r * .66, r * .62, -1.25); glowDot(ctx, -r * .48, -r * .32, r);
  } else if (type === 'banana') {
    // Bright crescent silhouette with a soft peel seam.
    ctx.beginPath(); ctx.moveTo(-r*.92,-r*.63);
    ctx.bezierCurveTo(-r*.46,r*.48,r*.34,r*.71,r*.88,-r*.40);
    ctx.quadraticCurveTo(r*1.12,-r*.36,r*.86,-r*.12);
    ctx.bezierCurveTo(r*.54,r*1.05,-r*.75,r*1.12,-r*.99,-r*.38);
    ctx.quadraticCurveTo(-r*1.06,-r*.58,-r*.92,-r*.63);
    ctx.fillStyle=bodyGradient(ctx,r,'#fffbd4','#ffd43c','#dc9820'); ctx.fill(); thickOutline(ctx,'#a77525',r);
    ctx.beginPath(); ctx.moveTo(-r*.83,-r*.39); ctx.quadraticCurveTo(-r*.25,r*.86,r*.70,-r*.16);
    ctx.strokeStyle='#da9b23';ctx.lineWidth=r*.055;ctx.stroke();
    ctx.beginPath();ctx.moveTo(-r*.70,-r*.32);ctx.quadraticCurveTo(-r*.21,r*.74,r*.57,r*.03);ctx.strokeStyle='rgba(255,251,190,.72)';ctx.lineWidth=r*.033;ctx.lineCap='round';ctx.stroke();
    fillEllipse(ctx,-r*.91,-r*.60,r*.105,r*.15,'#a28c4a',-.3);
    fillEllipse(ctx,r*.88,-r*.37,r*.08,r*.14,'#a57335',.45);
    glowDot(ctx,-r*.52,r*.21,r*.8);
  } else if (type === 'grape') {
    const berries=[[-.46,-.47],[0,-.58],[.47,-.43],[-.56,.04],[-.06,-.02],[.50,.06],[-.29,.43],[.24,.43],[-.02,.78]];
    for(const [x,y] of berries){
      ctx.save();ctx.translate(x*r,y*r);ellipse(ctx,0,0,r*.36,r*.36);ctx.fillStyle=bodyGradient(ctx,r*.36,'#f0c7f8','#af72e5','#5e3a9d');ctx.fill();ctx.strokeStyle='#643fa0';ctx.lineWidth=r*.034;ctx.stroke();
      glowDot(ctx,-r*.11,-r*.12,r*.33);ctx.restore();
    }
    ctx.beginPath();ctx.moveTo(r*.03,-r*.79);ctx.quadraticCurveTo(-r*.04,-r*1.01,r*.28,-r*1.04);ctx.strokeStyle='#68873d';ctx.lineWidth=r*.09;ctx.lineCap='round';ctx.stroke();
    leaf(ctx,r*.02,-r*.87,r*.54,-.85);
  } else if (type === 'pineapple') {
    ellipse(ctx,0,r*.19,r*.70,r*.77);ctx.fillStyle=bodyGradient(ctx,r,'#fff7b2','#f4bf42','#c97524');ctx.fill();thickOutline(ctx,'#a46c22',r);
    ctx.save();ellipse(ctx,0,r*.19,r*.68,r*.75);ctx.clip();
    for(let k=-5;k<=5;k++){
      ctx.beginPath();ctx.moveTo(-r*1.1,k*r*.32-r);ctx.lineTo(r*1.1,k*r*.32+r);ctx.strokeStyle='rgba(153,93,25,.61)';ctx.lineWidth=r*.037;ctx.stroke();
      ctx.beginPath();ctx.moveTo(r*1.1,k*r*.32-r);ctx.lineTo(-r*1.1,k*r*.32+r);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-r*1.1,k*r*.32-r+r*.036);ctx.lineTo(r*1.1,k*r*.32+r+r*.036);ctx.strokeStyle='rgba(255,244,160,.55)';ctx.lineWidth=r*.018;ctx.stroke();
    }ctx.restore();
    for(let i=-2;i<=2;i++){ctx.save();ctx.translate(0,-r*.48);ctx.rotate(i*.30);ctx.beginPath();ctx.moveTo(-r*.18,0);ctx.quadraticCurveTo(-r*.30,-r*.42,0,-r*.78);ctx.quadraticCurveTo(r*.22,-r*.35,r*.16,0);ctx.fillStyle=bodyGradient(ctx,r*.60,'#d3ec8b',i%2?'#58a851':'#78bd4d','#21663e');ctx.fill();ctx.strokeStyle='#417c3e';ctx.lineWidth=r*.018;ctx.stroke();ctx.restore();}
    glowDot(ctx,-r*.30,-r*.15,r);
  } else if (type === 'pear') {
    ctx.beginPath();ctx.moveTo(0,-r*.83);ctx.bezierCurveTo(-r*.36,-r*.83,-r*.35,-r*.25,-r*.67,r*.07);ctx.bezierCurveTo(-r*1.14,r*.79,-r*.56,r*.99,0,r*.99);ctx.bezierCurveTo(r*.68,r*.99,r*1.03,r*.62,r*.67,r*.07);ctx.bezierCurveTo(r*.35,-r*.25,r*.36,-r*.83,0,-r*.83);
    ctx.fillStyle=bodyGradient(ctx,r,'#fbfcae','#adcf55','#659339');ctx.fill();thickOutline(ctx,'#5e8139',r);
    for(let i=0;i<15;i++){const a=i*2.39996,d=r*.49*Math.sqrt((i+1)/15);fillEllipse(ctx,Math.cos(a)*d,Math.sin(a)*d+r*.36,r*.018,r*.016,'rgba(100,116,38,.30)');}
    ctx.beginPath();ctx.moveTo(0,-r*.8);ctx.lineTo(r*.12,-r*1.0);ctx.strokeStyle='#966735';ctx.lineWidth=r*.09;ctx.lineCap='round';ctx.stroke();leaf(ctx,r*.09,-r*.85,r*.55,-.28);glowDot(ctx,-r*.35,r*.16,r);
  } else if(type==='peach'){
    ctx.beginPath();ctx.moveTo(0,-r*.72);ctx.bezierCurveTo(-r*.73,-r*1.08,-r*1.14,-r*.13,-r*.79,r*.43);ctx.bezierCurveTo(-r*.53,r*.85,-r*.22,r*.94,0,r*1.02);ctx.bezierCurveTo(r*.24,r*.94,r*.57,r*.84,r*.81,r*.38);ctx.bezierCurveTo(r*1.10,-r*.2,r*.67,-r*1.04,0,-r*.72);
    ctx.fillStyle=bodyGradient(ctx,r,'#fff2b6','#ffa686','#dc6171');ctx.fill();thickOutline(ctx,'#b45058',r);
    ctx.beginPath();ctx.moveTo(0,-r*.68);ctx.quadraticCurveTo(r*.38,-r*.02,r*.06,r*.72);ctx.strokeStyle='rgba(181,82,80,.45)';ctx.lineWidth=r*.05;ctx.stroke();leaf(ctx,-r*.01,-r*.78,r*.63,-.55);glowDot(ctx,-r*.43,-r*.25,r);
  }
}

// Deliberately whimsical obstacle: a round cartoon character, not a real weapon.
function bombArt(ctx, r) {
  // A softly dashed caution halo makes this distinguishable from round fruit
  // at a distance, without depicting an aggressive or realistic explosion.
  ctx.save(); ellipse(ctx, 0, 0, r * 1.05, r * .99);
  ctx.strokeStyle = '#fed16d'; ctx.lineWidth = Math.max(2, r * .075); ctx.setLineDash([r * .13, r * .1]); ctx.stroke(); ctx.restore();
  ellipse(ctx, 0, r * .035, r * .88, r * .82);
  ctx.fillStyle = bodyGradient(ctx, r, '#c9c9f0', '#7776bc', '#48436c'); ctx.fill(); thickOutline(ctx, '#382b58', r);
  ctx.beginPath(); ctx.moveTo(-r * .17, -r * .71); ctx.lineTo(-r * .12, -r * .92);
  ctx.quadraticCurveTo(r * .04, -r * .99, r * .2, -r * .89); ctx.lineTo(r * .28, -r * .7);
  ctx.fillStyle = '#e9c783'; ctx.fill();
  // Expressive little eyes and blush, so the obstacle is clearly distinct.
  fillEllipse(ctx, -r * .27, 0, r * .095, r * .13, '#fff7d8');
  fillEllipse(ctx, r * .27, 0, r * .095, r * .13, '#fff7d8');
  fillEllipse(ctx, -r * .25, r * .025, r * .047, r * .067, '#34324a');
  fillEllipse(ctx, r * .25, r * .025, r * .047, r * .067, '#34324a');
  fillEllipse(ctx, -r * .47, r * .19, r * .12, r * .07, 'rgba(245,163,182,.7)');
  fillEllipse(ctx, r * .47, r * .19, r * .12, r * .07, 'rgba(245,163,182,.7)');
  ctx.beginPath(); ctx.arc(0, r * .25, r * .13, Math.PI * 1.14, Math.PI * 1.86);
  ctx.strokeStyle = '#f7e5d3'; ctx.lineWidth = r * .052; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r * .18, -r * .92); ctx.quadraticCurveTo(r * .55, -r * 1.18, r * .7, -r * .89);
  ctx.strokeStyle = '#eacb81'; ctx.lineWidth = r * .065; ctx.stroke();
  drawStar(ctx, r * .72, -r * .88, r * .25, '#ffe797');
  glowDot(ctx, -r * .39, -r * .42, r);
  fillEllipse(ctx, r * .66, r * .61, r * .32, r * .31, '#ffdc86');
  ctx.fillStyle = '#604977'; ctx.font = `900 ${r * .46}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', r * .66, r * .61);
}

function drawStar(ctx, x, y, r, color, edge=null, edgeWidth=1) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + Math.PI * i / 5, d = i % 2 === 0 ? r : r * .45;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if(edge){ctx.lineJoin='round';ctx.strokeStyle=edge;ctx.lineWidth=edgeWidth;ctx.stroke();}
}

/** Optional presentation envelope for older/scripted entities. Ballistic
 * targets rise through the clipping boundary at their full collision size. */
export function fruitPresentation(fruit,reduceMotion=false){
  if(!Number.isFinite(fruit.age)||!Number.isFinite(fruit.life))return {scale:1,opacity:1};
  const t=clamp(fruit.age/.18,0,1);
  const scale=reduceMotion ? 1 : .84+.16*(1-(1-t)**3);
  const remain=clamp((fruit.life-fruit.age)/.26,0,1);
  return {scale,opacity:.38+.62*remain};
}

// Original illustrations are pure, deterministic art. A fixed 288px plate
// with a 96px nominal radius fits all ten fruit silhouettes, their two cut
// halves, and the toy obstacle. No camera pixels, changing DPR, or gameplay
// RNG enter this cache (31 × 288 × 288 × 4, at most 9.81 MiB RGBA backing).
export const ART_CACHE_LIMITS=Object.freeze({size:288,radius:96,entries:FRUIT_TYPES.length*3+1});
const artCache=new Map();
function artSprite(type,side=0){
  if(typeof document==='undefined'||(!FRUIT_TYPES.includes(type)&&type!=='bomb')||(type==='bomb'&&side))return null;
  side=Math.sign(side);const key=`${type}:${side}`;
  if(artCache.has(key))return artCache.get(key);
  try{
    const sprite=document.createElement('canvas'),{size,radius}=ART_CACHE_LIMITS;
    sprite.width=sprite.height=size;
    const ctx=sprite.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
    ctx.save();ctx.translate(size/2,size/2);
    if(side)drawHalfArt(ctx,type,side,radius);
    else if(type==='bomb')bombArt(ctx,radius);else fruitArt(ctx,type,radius);
    ctx.restore();
    // One soft shadow per completed silhouette, pre-rendered rather than
    // shadowing each individual seed and highlight on every animation frame.
    ctx.save();ctx.globalCompositeOperation='destination-over';ctx.shadowColor='rgba(21,25,54,.43)';ctx.shadowBlur=10;ctx.shadowOffsetY=4;ctx.drawImage(sprite,0,0);ctx.restore();
    artCache.set(key,sprite);return sprite;
  }catch{artCache.set(key,null);return null;}
}
function paintArt(ctx,type,r,side=0){
  const sprite=artSprite(type,side);
  if(sprite){const pad=ART_CACHE_LIMITS.size/(2*ART_CACHE_LIMITS.radius)*r;ctx.drawImage(sprite,-pad,-pad,pad*2,pad*2);return;}
  if(side)drawHalfArt(ctx,type,side,r);else if(type==='bomb')bombArt(ctx,r);else fruitArt(ctx,type,r);
}

function drawEntity(ctx, fruit, reduceMotion=false) {
  const presentation=fruitPresentation(fruit,reduceMotion);
  ctx.save(); ctx.translate(fruit.x, fruit.y); ctx.rotate(fruit.rot);
  ctx.scale(presentation.scale,presentation.scale);ctx.globalAlpha=presentation.opacity;
  paintArt(ctx,fruit.type,fruit.r);
  ctx.restore();
}

function drawHalfArt(ctx,type,side,r){
  const c=COLORS[type];
  // Existing split() places the two centers along the cut normal and sets
  // rot=angle−π/2. The illustration's peel must face *outward* in that
  // rotated space. Only the non-cuttable decorative silhouette changes.
  const outer=-side, fx=-outer*r*.055;
  ctx.save();ctx.beginPath();ctx.rect(outer<0?-r*1.35:0,-r*1.4,r*1.35,r*2.8);ctx.clip();fruitArt(ctx,type,r);ctx.restore();
  const fy=type==='pineapple'?r*.19:type==='banana'?r*.11:0;
  const ry=r*(type==='pineapple'?.74:type==='banana'?.64:.88),rx=r*.28;
  const rind=type==='watermelon'?'#dff0a3':c.fleshLight;
  ellipse(ctx,fx,fy,rx,ry);ctx.fillStyle=c.skin;ctx.fill();ctx.strokeStyle='#47334a';ctx.lineWidth=r*.043;ctx.stroke();
  fillEllipse(ctx,fx,fy,rx*.87,ry*.94,rind);
  const flesh=ctx.createRadialGradient(fx-r*.08,fy-r*.35,0,fx,fy,ry);
  flesh.addColorStop(0,c.fleshLight);flesh.addColorStop(.36,c.flesh);flesh.addColorStop(1,type==='watermelon'?'#e34069':c.flesh);
  fillEllipse(ctx,fx,fy,rx*.69,ry*.84,flesh);
  ctx.save();ellipse(ctx,fx,fy,rx*.69,ry*.84);ctx.clip();
  if(type==='watermelon'){
    for(let i=-2;i<=2;i++)for(const s of[-1,1]){
      if(i%2&&s===1)continue;
      const x=fx+s*r*(.075+.014*Math.sin(i*4)),y=fy+i*r*.205;
      fillEllipse(ctx,x,y,r*.039,r*.063,'#653045',s*.3+i*.11);
      fillEllipse(ctx,x-r*.008,y-r*.019,r*.014,r*.015,'rgba(255,220,184,.74)',s*.3);
    }
  }else if(type==='orange'){
    // Eight segment walls and juicy cells. The view is foreshortened along
    // the same cut plane, with the pale pith and seed pattern clearly visible.
    for(let i=0;i<8;i++){
      const a=i*TAU/8,ax=rx*.68,ay=ry*.83;
      ctx.beginPath();ctx.moveTo(fx,fy);ctx.lineTo(fx+Math.cos(a)*ax,fy+Math.sin(a)*ay);ctx.strokeStyle='#fff0b8';ctx.lineWidth=r*.026;ctx.lineCap='round';ctx.stroke();
      const z=a+TAU/16;
      for(let k=0;k<3;k++){const d=.43+k*.19;fillEllipse(ctx,fx+Math.cos(z)*ax*d,fy+Math.sin(z)*ay*d,r*.023,r*.037,'rgba(255,224,147,.62)',z);}
    }
    fillEllipse(ctx,fx,fy,r*.042,r*.077,'#fff8d9');
  }else if(type==='kiwi'){
    fillEllipse(ctx,fx,fy,r*.065,r*.29,'#f2fac0');
    for(let i=0;i<16;i++){
      const a=i*TAU/16,x=fx+Math.cos(a)*rx*.48,y=fy+Math.sin(a)*ry*.64;
      ctx.beginPath();ctx.moveTo(fx+Math.cos(a)*r*.045,fy+Math.sin(a)*r*.21);ctx.lineTo(x,y);ctx.strokeStyle='#ebf5b0';ctx.lineWidth=r*.016;ctx.stroke();
      fillEllipse(ctx,x,y,r*.026,r*.045,'#523a34',a*.25);
    }
  }else if(type==='apple'||type==='pear'){
    fillEllipse(ctx,fx,fy,r*.084,r*.33,type==='apple'?'#f5cd85':'#d9de7f');
    ctx.beginPath();ctx.moveTo(fx,fy-ry*.76);ctx.quadraticCurveTo(fx-r*.033,fy,fx,fy+ry*.74);ctx.strokeStyle='rgba(161,104,61,.39)';ctx.lineWidth=r*.031;ctx.stroke();
    for(const s of[-1,1])fillEllipse(ctx,fx+s*r*.049,fy+r*.045,r*.031,r*.071,'#744735',s*.52);
  }else if(type==='strawberry'){
    fillEllipse(ctx,fx,fy-r*.18,r*.060,r*.46,'#ffc1bf');
    for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(fx,fy+i*r*.22);ctx.lineTo(fx+i*r*.026,fy+i*r*.31);ctx.strokeStyle='#ffd7cc';ctx.lineWidth=r*.02;ctx.stroke();}
  }else if(type==='peach'){
    fillEllipse(ctx,fx,fy+r*.07,r*.112,r*.36,'#a96a46');
    fillEllipse(ctx,fx-r*.019,fy+r*.02,r*.065,r*.27,'#ce8c57');
    for(let i=-2;i<=2;i++)fillEllipse(ctx,fx+Math.sin(i*4)*r*.025,fy+i*r*.10,r*.019,r*.034,'#965a44',i*.12);
  }else if(type==='pineapple'){
    fillEllipse(ctx,fx,fy,r*.080,r*.56,'#fff2b3');
    for(let i=-3;i<=3;i++)for(const s of[-1,1])fillEllipse(ctx,fx+s*r*.15,fy+i*r*.14,r*.022,r*.036,'rgba(216,149,45,.42)',s*.35);
  }else if(type==='banana'){
    fillEllipse(ctx,fx,fy,r*.084,r*.36,'#fff6ce');
    for(let i=-2;i<=2;i++)fillEllipse(ctx,fx+Math.sin(i*5)*r*.034,fy+i*r*.13,r*.023,r*.036,'#ae8957',i*.2);
  }else if(type==='grape'){
    fillEllipse(ctx,fx,fy,r*.082,r*.43,'#f1c9ec');
    fillEllipse(ctx,fx+r*.025,fy-r*.05,r*.037,r*.105,'#9b6b8e',-.32);
  }
  ctx.restore();
  ctx.beginPath();ctx.ellipse(fx,fy,rx*.9,ry*.91,0,3.71,4.92);ctx.strokeStyle='rgba(255,255,232,.90)';ctx.lineWidth=r*.021;ctx.lineCap='round';ctx.stroke();
}

function drawHalf(ctx,half){
  ctx.save();ctx.translate(half.x,half.y);ctx.rotate(half.rot);ctx.globalAlpha=clamp(half.life/.25,0,1);
  paintArt(ctx,half.type,half.r,half.side);ctx.restore();
}

function drawJuice(ctx,p,reduceMotion=false){
  const alpha=clamp(p.life/p.maxLife,0,1);
  if(alpha<=0)return;
  ctx.save();ctx.globalAlpha=alpha;
  if(p.star){
    // Same particle, center, star radius and lifetime. A hairline ink rim
    // keeps the pale gold/lilac highlights legible over a bright room.
    drawStar(ctx,p.x,p.y,p.r*(reduceMotion?.75:1.03),p.color,'rgba(43,30,65,.80)',clamp(p.r*.24,.75,1.50));
  }
  else{
    const a=Math.atan2(p.vy,p.vx),dx=Math.cos(a),dy=Math.sin(a),r=p.r;
    if(!reduceMotion&&alpha>.28&&r>1.7){
      // Short, translucent direction streak from the existing drop—not a
      // new particle or an invented blade position.
      ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x-dx*r*2.1,p.y-dy*r*2.1);ctx.lineTo(p.x,p.y);
      ctx.globalAlpha=alpha*.28;ctx.strokeStyle='#31243f';ctx.lineWidth=r*.75+.9;ctx.stroke();
      ctx.globalAlpha=alpha*.51;ctx.strokeStyle=p.color;ctx.lineWidth=r*.75;ctx.stroke();
    }
    ctx.globalAlpha=alpha*.94;
    ellipse(ctx,p.x,p.y,r*(reduceMotion?1.04:1.30),r*.72,a);ctx.fillStyle=p.color;ctx.fill();
    ctx.lineWidth=clamp(r*.22,.75,1.4);ctx.strokeStyle='rgba(53,34,62,.82)';ctx.stroke();
    ctx.globalAlpha=alpha*.68;fillEllipse(ctx,p.x-r*.32,p.y-r*.36,r*.26,r*.21,'#fff7d8',a);
  }
  ctx.restore();
}

/* V1.6 G1c: approved C2 pressure frame/C score labels. See
 * docs/benchmarks/v1.6/visual/README.md and frozen candidate 4c2ccc30.
 * Decoration-only math, no RNG, physics or input mutations. */
const rounded=(ctx,x,y,w,h,r)=>{ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);};
const path=(ctx,pts,close=false)=>{ctx.beginPath();for(let i=0;i<pts.length;i++)i?ctx.lineTo(...pts[i]):ctx.moveTo(...pts[i]);if(close)ctx.closePath();};

// G1c-selected C2: breathable comic frame on all four sides. It is a
// separate decorative layer underneath the live targets/accepted hand marks.
// The central camera view never receives a wash, a displacement or a flash.
export function drawPressureFrame(ctx,e,w,h,reduced){
  if(!e||w<32||h<32)return;
  const t=clamp(e.age/e.duration,0,1),fade=(1-t)**1.18,short=Math.min(w,h);
  if(fade<=0)return;
  const unit=clamp(short*.021,3.4,19),depth=clamp(short*.115,22,108)*(reduced?.55:1-.44*t);
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  if(!reduced){
    // A single low-opacity edge pressure wash, no center fill: four short
    // strips end in transparent pixels < 11.5% of the short dimension.
    const band=(x,y,bw,bh,x0,y0,x1,y1)=>{
      const g=ctx.createLinearGradient?.(x0,y0,x1,y1);
      if(!g?.addColorStop)return;
      g.addColorStop(0,'rgba(49,34,63,.65)');g.addColorStop(.24,'rgba(140,72,66,.48)');g.addColorStop(.56,'rgba(254,164,83,.25)');g.addColorStop(1,'rgba(254,193,106,0)');
      ctx.globalAlpha=fade*.77;ctx.fillStyle=g;ctx.fillRect(x,y,bw,bh);
    };
    band(0,0,w,depth,0,0,0,depth);band(0,h-depth,w,depth,0,h,0,h-depth);
    band(0,depth,depth,h-2*depth,0,0,depth,0);band(w-depth,depth,depth,h-2*depth,w,0,w-depth,0);
  }
  // Rounded double rail, entirely in the periphery. No full-screen fill.
  const rail=unit*.74;
  rounded(ctx,rail,rail,w-2*rail,h-2*rail,unit*1.65);ctx.globalAlpha=fade*.74;ctx.strokeStyle='#332747';ctx.lineWidth=unit*1.6;ctx.stroke();
  ctx.globalAlpha=fade*.95;ctx.strokeStyle='#ffc56e';ctx.lineWidth=unit*.57;ctx.stroke();
  if(reduced){ctx.restore();return;}
  {
    // Outward travelling pressure front in the edge band only. Reaches all
    // four sides by .18s, then blends continuously into the fading outer
    // rail. No shake, repeated pulse, screen-center ring or white flash.
    const u=clamp(e.age/.18,0,1),inset=rail+depth*.72*(1-u)**1.6;
    if(u<1){
      rounded(ctx,inset,inset,w-2*inset,h-2*inset,unit*2.1);ctx.globalAlpha=fade*(1-u)*.66;ctx.strokeStyle='#332747';ctx.lineWidth=unit*1.0;ctx.stroke();
      ctx.globalAlpha=fade*(1-u)*.85;ctx.strokeStyle='#ffce8f';ctx.lineWidth=unit*.33;ctx.stroke();
    }
  }
  const edges=[
    {len:w,loc:e.x/w,at:(x,d)=>[x,d]},
    {len:h,loc:e.y/h,at:(x,d)=>[w-d,x]},
    {len:w,loc:1-e.x/w,at:(x,d)=>[w-x,h-d]},
    {len:h,loc:1-e.y/h,at:(x,d)=>[d,h-x]},
  ];
  for(let i=0;i<edges.length;i++){
    const{len,loc,at}=edges[i],span=clamp(len*.16,depth*2.2,depth*5.3);
    // Three angular pressure marks on each edge. Each group points toward
    // the source direction; no random consumption or flicker per frame.
    for(let j=0;j<3;j++){
      const x=clamp(len*(.21+.29*j)+len*.07*(loc-.5),span*.42,len-span*.42);
      const a=span*(j===1?.73:.58),z=depth*(j===1?1:.67),lean=clamp((loc*len-x)*.12,-a*.29,a*.29);
      const wedge=[at(x-a*.5,rail),at(x+a*.5,rail),at(x+lean+a*.16,z*.67),at(x+lean+a*.01,z*.43),at(x+lean-a*.13,z),at(x-a*.10,z*.24)];
      path(ctx,wedge,true);ctx.globalAlpha=fade*.51;ctx.fillStyle=j%2?'#67476e':'#97543f';ctx.fill();
      ctx.globalAlpha=fade*.75;ctx.strokeStyle='#332540';ctx.lineWidth=unit*.75;ctx.stroke();
      ctx.globalAlpha=fade*.90;ctx.strokeStyle=j%2?'#e8d1ff':'#ffd17c';ctx.lineWidth=unit*.42;ctx.stroke();
      // A shorter inner fracture line helps this remain recognizable across
      // light fixtures or dark TV backgrounds; all stay at the periphery.
      path(ctx,[at(x-a*.17,unit*1.15),at(x+lean*.38+a*.02,z*.31),at(x+lean-a*.09,z*.50)]);
      ctx.globalAlpha=fade*.72;ctx.strokeStyle='#ffdf9e';ctx.lineWidth=unit*.23;ctx.stroke();
    }
  }
  ctx.restore();
}

function labelContent(p){
  const delta=Number.isFinite(p.delta)?p.delta:(p.text.startsWith('+')?parseInt(p.text):p.text.startsWith('−')?-parseInt(p.text.slice(1)):0);
  const combo=p.combo??Number(/(\d+)连击/.exec(p.text)?.[1]??0);
  const isBomb=p.bomb??delta<=0;
  return {delta,bomb:isBomb,value:delta>0?`+${delta}`:delta<0?`−${-delta}`:'0',tag:combo>=2?`${combo} 连击`:isBomb?'避开！':''};
}
function textMetrics(ctx,p,width,height,scale=1,numberOnly=false){
  const size=Math.max(22,clamp(Math.min(width,height)*.075,28,68)*scale),content=labelContent(p);
  if(numberOnly)content.tag='';
  const font=`900 ${size}px ui-rounded, system-ui, sans-serif`,tagFont=`800 ${Math.round(size*.43)}px ui-rounded, "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif`;
  ctx.font=font;let valueW=ctx.measureText?.(content.value)?.width||content.value.length*size*.62;
  ctx.font=tagFont;const tagW=content.tag?(ctx.measureText?.(content.tag)?.width||content.tag.length*size*.27):0;
  return{...content,size,font,tagFont,w:Math.max(valueW,tagW)+size*.48,h:size*(content.tag?1.48:1.11)};
}
function intersectsCircle(rect,c){const x=clamp(c.x,rect.left,rect.right),y=clamp(c.y,rect.top,rect.bottom);return (x-c.x)**2+(y-c.y)**2<c.r**2;}
function intersectsRect(a,b,pad=6){return a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;}
function intersectsTrail(rect,s,pad=8){
  // Conservative finite line versus the score box expanded by trail width.
  // No sampled gaps on long genuine sweeps or expensive per-point expansion.
  let lo=0,hi=1;
  for(const [pos,delta,min,max]of[[s.a.x,s.b.x-s.a.x,rect.left-pad,rect.right+pad],[s.a.y,s.b.y-s.a.y,rect.top-pad,rect.bottom+pad]]){
    if(Math.abs(delta)<1e-7){if(pos<min||pos>max)return false;continue;}
    const t1=(min-pos)/delta,t2=(max-pos)/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;
  }
  return true;
}
function rectAt(cx,cy,m){return{left:cx-m.w/2,right:cx+m.w/2,top:cy-m.h/2,bottom:cy+m.h/2,x:cx,y:cy};}
function sourceOf(p){return {x:p.anchorX??p.x,y:p.anchorY??p.y,r:p.anchorRadius??0};}
// Cache presentation placement only; no accepted hand/target or gameplay
// state is changed. The prior slot is kept while safe, even if a closer
// candidate opens up later, to prevent alternating sides from frame to frame.
const priorScorePlacement=new WeakMap();
const scoreMetricsCache=new WeakMap();
function cachedScoreMetrics(ctx,p,width,height){
  const prior=scoreMetricsCache.get(p);
  if(prior&&prior.width===width&&prior.height===height)return prior.options;
  const options=[textMetrics(ctx,p,width,height),textMetrics(ctx,p,width,height,1,true),textMetrics(ctx,p,width,height,.84,true),textMetrics(ctx,p,width,height,.72,true)];
  scoreMetricsCache.set(p,{width,height,options});return options;
}
function prepareLabelSlot(m,s,safe,lift){
  if(m.w>safe.right-safe.left||m.h>safe.bottom-safe.top)return null;
  const loX=safe.left+m.w/2,hiX=safe.right-m.w/2,loY=safe.top+m.h/2,hiY=safe.bottom-m.h/2;
  const gap=m.size*.27,dx=s.r+gap+m.w/2,dy=s.r+gap+m.h/2;
  return {loX,hiX,loY,hiY,dx,dy,toRect:(x,y)=>rectAt(clamp(x,loX,hiX),clamp(y-lift,loY,hiY),m)};
}

// G1c-selected C: deterministic adjacent free placement around the actual
// cut point. Reject all live-target/hand/score intersections; only crowded
// cases need the bounded free-space search.
export function layoutScoreLabels(ctx,popups,game,time=now()){
  if(!popups.length)return[];
  const {width,height,playArea:area}=game,placed=[],obstacles=[],trails=[];
  for(const f of game.fruits)obstacles.push({x:f.x,y:f.y,r:f.r*1.17+5});
  if(!game.paused)for(const hand of game.hands.values())if(hand.stroke.some(p=>time-p.t<=210)){
    obstacles.push({x:hand.point.x,y:hand.point.y,r:15});
    // Accepted, recent stroke is another exclusion (using its actual samples
    // and finite interpolation, never inventing a new hand/target).
    const trailWindow=game.shouldReduceMotion?85:hand.force?190:145,stroke=hand.stroke.filter(p=>time-p.t<=trailWindow);
    for(let i=1;i<stroke.length;i++)trails.push({a:stroke[i-1],b:stroke[i]});
  }
  const blockedByPlay=r=>obstacles.some(c=>intersectsCircle(r,c))||trails.some(s=>intersectsTrail(r,s));
  const safe={left:Math.max(7,area.left+7),right:Math.min(width-7,area.right-7),top:Math.max(7,area.top+7),bottom:Math.min(height-7,area.bottom-7)};
  ctx.save();
  // Oldest first: newly appearing numbers cannot dislodge an existing score
  // badge unnecessarily; they get their own next free adjacent position.
  for(const p of popups){
    const options=cachedScoreMetrics(ctx,p,width,height),s=sourceOf(p);let m=options[0];
    const lift=game.shouldReduceMotion?0:clamp((.86-p.life)*18,0,12);
    const directions=[[1,0],[0,-1],[-1,0],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]];
    let rect,mode=0;
    const good=r=>!blockedByPlay(r)&&!placed.some(b=>intersectsRect(r,b.rect));
    const beside=r=>!intersectsCircle(r,{x:s.x,y:s.y,r:s.r*.62});
    // A preference for side positions keeps the score next to (not over)
    // the two cut halves. Stable tie order avoids randomized dance/jitter.
    const distance=r=>Math.hypot(r.x-s.x,r.y-s.y);
    const cost=r=>(beside(r)?0:10000)+distance(r);
    const slots=options.map(opt=>prepareLabelSlot(opt,s,safe,lift));
    const prior=priorScorePlacement.get(p);
    if(prior&&prior.width===width&&prior.height===height&&prior.reduced===game.shouldReduceMotion&&slots[prior.mode]){
      const slot=slots[prior.mode],opt=options[prior.mode],r=slot.toRect(s.x+prior.dx,s.y+prior.dy);
      if(good(r)){rect=r;mode=prior.mode;m=opt;}
    }
    if(!rect)for(let i=0;i<slots.length;i++){
      const slot=slots[i];if(!slot)continue;let best=Infinity,candidate;
      for(const mult of[1,1.45])for(const [a,b]of directions){const r=slot.toRect(s.x+a*slot.dx*mult,s.y+b*slot.dy*mult),c=cost(r);if(c<best&&beside(r)&&good(r)){candidate=r;best=c;}}
      if(candidate){rect=candidate;mode=i;m=options[i];break;}
    }
    if(!rect){
      // No full-sized adjacent slot? Keep trying the real numeric delta,
      // discarding the secondary combo/obstacle caption then using a
      // legible smaller size. Search nearby free space first, then the
      // bounded real play area. Never conceal a live fruit or hand.
      let best=Infinity;
      for(let i=0;i<slots.length;i++){
        const slot=slots[i];if(!slot)continue;const opt=options[i],{loX,hiX,loY,hiY}=slot,cell=Math.max(12,opt.size*.55);
        // Include both exact outer safe bounds even when grid cells do not
        // divide evenly. Compare by anchor distance, then prefer size.
        for(let yy=loY;yy<hiY+cell*.5;yy+=cell)for(let xx=loX;xx<hiX+cell*.5;xx+=cell){
          const r=rectAt(Math.min(xx,hiX),Math.min(yy,hiY),opt),c=cost(r)+i*opt.size*.35;
          if(c<best&&good(r)){rect=r;mode=i;m=opt;best=c;}
        }
      }
    }
    if(!rect)continue;
    priorScorePlacement.set(p,{width,height,reduced:game.shouldReduceMotion,mode,dx:rect.x-s.x,dy:rect.y+lift-s.y});
    placed.push({p,m,rect,anchor:s,mode,blocked:blockedByPlay(rect)||placed.some(b=>intersectsRect(rect,b.rect))});
  }
  ctx.restore();return placed;
}

export function paintScoreLabels(ctx,placed){
  for(const {p,m,rect:r} of placed){
    const alpha=clamp(p.life/.24,0,1),accent=m.bomb?'#ffc98e':'#ffe385',radius=m.size*.27;
    ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    // Actual numeric delta always dominates. A separate compact label never
    // inflates it with the combo count or changes the score represented.
    rounded(ctx,r.left,r.top,m.w,m.h,radius);ctx.fillStyle=m.bomb?'#392839':'#252541';ctx.fill();ctx.strokeStyle='#191628';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle=accent;ctx.lineWidth=clamp(m.size*.055,1.5,3);ctx.stroke();
    ctx.font=m.font;ctx.fillStyle=accent;ctx.fillText(m.value,r.x,r.top+m.size*.57);
    if(m.tag){ctx.font=m.tagFont;ctx.fillStyle='#fff5d9';ctx.fillText(m.tag,r.x,r.bottom-m.size*.27);}
    ctx.restore();
  }
}

export class FruitGame {
  constructor({ canvas, onScore = () => {}, onTime = () => {}, onEnd = () => {}, onSlice = () => {}, onBomb = () => {}, onWave = () => {} } = {}) {
    if (!canvas?.getContext) throw new TypeError('FruitGame requires a canvas element.');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D is unavailable.');
    this.onScore = onScore; this.onTime = onTime; this.onEnd = onEnd; this.onSlice = onSlice; this.onBomb = onBomb; this.onWave=onWave;
    this.width = 1; this.height = 1; this.dpr = 1;
    this.running = false; this.paused = false;
    this.score = 0; this.remaining = 0; this.elapsed = 0; this.difficulty = 'easy';
    this.fruits = []; this.halves = []; this.particles = []; this.popups = [];
    this.hands = new Map();
    this.reachZone = null;
    this.cameraBounds = null;
    this.frameHistory = [];
    this.spawnIn = 0; this.nextId = 1; this.lastTime = 0; this.lastBombAge = -100;
    this.activeBag=[]; this.spawnSeq=0; this.combo=0; this.lastSliceAge=-100;
    this.bombEffect=null; this.reducedMotion=null;this.motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.resize();
  }

  get mode() { return MODES[this.difficulty] ?? MODES.easy; }
  get active() { return this.difficulty==='active'; }
  get activeCapacity() {
    const { minX, maxX } = this.horizontalSpawnRange(this.targetRadius);
    const narrowReach=this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30;
    return this.playArea.width < 360 || narrowReach || maxX-minX < this.targetRadius*2.5 ? 2 : this.mode.maxObjects;
  }
  get maxObjects() { return this.active ? this.activeCapacity : this.mode.maxObjects; }
  get targetRadius() {
    return Math.min(this.playArea.height*.19,this.cameraBounds?this.playArea.width*.18:Infinity,clamp(Math.min(this.width,this.height)*this.mode.radius,this.mode.minRadius,this.mode.maxRadius));
  }
  setReducedMotion(value=null) { this.reducedMotion=value===null ? null : Boolean(value); }
  get shouldReduceMotion() {
    return this.reducedMotion===true || Boolean(this.motionPreference?.matches);
  }
  get shakeOffset(){
    if(!this.bombEffect || this.shouldReduceMotion || this.bombEffect.age>=.18)return {x:0,y:0};
    const t=this.bombEffect.age/.18,amp=2.4*(1-t);
    return {x:Math.sin(t*Math.PI*4)*amp,y:Math.cos(t*Math.PI*3)*amp*.55};
  }

  get playArea() {
    const baseTop = Math.min(Math.max(60, this.height * .12), this.height * .22);
    const baseBottom = this.height - Math.min(Math.max(48, this.height * .10), this.height * .18);
    const left = this.cameraBounds?.left??0, right=this.cameraBounds?.right??this.width;
    const top = Math.max(baseTop,this.cameraBounds?.top??0), bottom=Math.min(baseBottom,this.cameraBounds?.bottom??this.height);
    return { left,right,top,bottom,width:Math.max(1,right-left),height:Math.max(1,bottom-top) };
  }

  /** Use the actual visible video rectangle when the camera is letterboxed.
   * The full-viewport default (null) remains exactly the V1.2 practice area.
   * Invalidate old targets/trajectories if camera composition changes. */
  setCameraBounds(rect=null) {
    let next=null;
    if(rect&&['left','top','right','bottom'].every(k=>Number.isFinite(rect[k]))){
      const left=clamp(rect.left,0,this.width),right=clamp(rect.right,0,this.width);
      const top=clamp(rect.top,0,this.height),bottom=clamp(rect.bottom,0,this.height);
      if(right>left&&bottom>top&&(left>.01||top>.01||right<this.width-.01||bottom<this.height-.01))next={left,right,top,bottom};
    }
    const old=this.cameraBounds;
    if((!old&&!next)||(old&&next&&['left','right','top','bottom'].every(k=>Math.abs(old[k]-next[k])<.01)))return false;
    this.cameraBounds=next;this.clearHands();this.frameHistory=[];
    if(this.running){
      this.fruits=[];this.halves=[];this.particles=[];this.popups=[];this.bombEffect=null;
      if(this.active){this.spawnActiveWave();this.spawnIn=random(...this.mode.spawn);}
      else this.spawnIn=.16;
    }
    return true;
  }

  /** Store a normalized horizontal reach calibration, independent of viewport.
   * An excessively narrow sample is widened around its center for playability;
   * null restores the ordinary full playfield (e.g. practice/touch mode).
   */
  setReachZone(zone = null) {
    if (!zone || !Number.isFinite(zone.minX) || !Number.isFinite(zone.maxX)) {
      this.reachZone = null;
      return null;
    }
    let minX = clamp(Math.min(zone.minX, zone.maxX), 0, 1);
    let maxX = clamp(Math.max(zone.minX, zone.maxX), 0, 1);
    if (maxX - minX < .22) {
      minX = clamp((minX + maxX) / 2 - .11, 0, .78);
      maxX = minX + .22;
    }
    this.reachZone = { minX, maxX };
    // Optional measured vertical reach. Existing adapters can continue passing
    // only horizontal calibration; the active layout then uses a middle band.
    if(Number.isFinite(zone.minY)&&Number.isFinite(zone.maxY)){
      let minY=clamp(Math.min(zone.minY,zone.maxY),.08,.92),maxY=clamp(Math.max(zone.minY,zone.maxY),.08,.92);
      if(maxY-minY<.30){minY=clamp((minY+maxY)/2-.15,.08,.62);maxY=minY+.30;}
      Object.assign(this.reachZone,{minY,maxY});
    }
    return { ...this.reachZone };
  }

  /** CSS-pixel center bounds, combining calibrated reach with safe margins. */
  horizontalSpawnRange(radius) {
    const {left,right,width}=this.playArea;
    const normalMargin=Math.min(width*.25,radius+width*.12);
    const margin=this.cameraBounds?Math.min(width*.5,Math.max(radius*1.32+2,normalMargin)):normalMargin;
    const safeMin = left+margin;
    const safeMax = right-margin;
    if (!this.reachZone) return { minX: safeMin, maxX: safeMax };
    let minX = clamp(this.width * this.reachZone.minX, safeMin, safeMax);
    let maxX = clamp(this.width * this.reachZone.maxX, safeMin, safeMax);
    // Edge-biased/incomplete calibration still needs a useful lane. Prefer the
    // nearest safe lane; a fruit's generous hit radius covers its reach edge.
    const minSpan = Math.min(width * .16, safeMax - safeMin);
    if (maxX - minX < minSpan) {
      minX = clamp((minX + maxX) / 2 - minSpan / 2, safeMin, safeMax - minSpan);
      maxX = minX + minSpan;
    }
    return { minX, maxX };
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect?.() ?? {};
    const w = bounds.width || this.canvas.clientWidth || this.canvas.width / this.dpr || 1;
    const h = bounds.height || this.canvas.clientHeight || this.canvas.height / this.dpr || 1;
    const dpr = clamp(globalThis.devicePixelRatio || 1, 1, 2);
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    const layoutChanged=w!==this.width||h!==this.height;
    const sx = w / this.width, sy = h / this.height, scale = Math.min(sx, sy);
    if(this.cameraBounds){const b=this.cameraBounds;this.cameraBounds={left:b.left*sx,right:b.right*sx,top:b.top*sy,bottom:b.bottom*sy};}
    // Rescale on rotation, and never bridge old tracking coordinates.
    for (const e of [...this.fruits, ...this.halves, ...this.particles, ...this.popups]) {
      e.x *= sx; e.y *= sy;
      if ('vx' in e) e.vx *= sx;
      if ('vy' in e) e.vy *= sy;
      if ('g' in e) e.g *= sy;
      if ('r' in e) e.r *= scale;
      if ('minX' in e) e.minX *= sx;
      if ('maxX' in e) e.maxX *= sx;
      // Only decorative score-origin metadata. Preserve the real source
      // through rotation, without touching targets or accepted hand paths.
      if ('anchorX' in e) { e.anchorX *= sx; e.anchorY *= sy; e.anchorRadius *= scale; }
    }
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.clearHands();this.frameHistory=[];
    if(layoutChanged&&this.active&&this.running){
      // A newly oriented screen has a different trajectory geometry. Restart
      // with one launch in its safe lane rather than stretching old targets.
      this.fruits=[];this.bombEffect=null;
      this.spawnActiveWave();this.spawnIn=random(...this.mode.spawn);
    }
  }

  start({ duration = 45, difficulty = 'easy' } = {}) {
    const numeric = Number(duration);
    this.remaining = Number.isFinite(numeric) ? Math.max(1, numeric) : 45;
    this.difficulty = Object.hasOwn(MODES, difficulty) ? difficulty : 'easy';
    this.running = true; this.paused = false; this.score = 0; this.elapsed = 0;
    this.fruits = []; this.halves = []; this.particles = []; this.popups = [];
    this.spawnIn = .16; this.lastTime = Math.ceil(this.remaining); this.lastBombAge = -100;
    this.activeBag=[];this.spawnSeq=0;this.combo=0;this.lastSliceAge=-100;this.bombEffect=null;
    this.clearHands();this.frameHistory=[]; this.onScore(0); this.onTime(this.lastTime);
    if(this.active){this.spawnActiveWave();this.spawnIn=random(...this.mode.spawn);}
  }

  pause() { if (this.running) { this.paused = true; this.clearHands();this.frameHistory=[];this.combo=0;this.lastSliceAge=-100;this.bombEffect=null; } }
  resume() { if (this.running) { this.paused = false; this.clearHands();this.frameHistory=[]; } }
  stop() {
    this.running = false; this.paused = false;
    this.fruits = []; this.halves = []; this.particles = []; this.popups = [];
    this.combo=0;this.lastSliceAge=-100;this.bombEffect=null;
    this.clearHands();this.frameHistory=[];
  }
  clearHands() { this.hands.clear(); }
  /** Camera composition changes invalidate both strokes and old target
   * coordinates even when the canvas backing dimensions themselves did not. */
  resetInputHistory() { this.clearHands(); this.frameHistory=[]; }

  /**
   * Update one input source. A missing sample or stale timestamp breaks the
   * stroke. Forced (touch/mouse/demo) input is namespaced separately from real
   * hands and can tap directly; genuine input requires deliberate movement.
   */
  setHand(id, point, timestamp = now(), { force = false, receivedAt } = {}) {
    const key = `${force ? 'sim' : 'hand'}:${String(id)}`;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) { this.hands.delete(key); return; }
    if (!this.running || this.paused) return;
    const t = Number.isFinite(timestamp) ? timestamp : now();
    const next = { x: clamp(point.x, -this.width, this.width * 2), y: clamp(point.y, -this.height, this.height * 2), t };
    const prevState = this.hands.get(key);
    const prev = prevState?.point;
    const gap = prev ? t - prev.t : Infinity;
    const distance = prev ? Math.hypot(next.x - prev.x, next.y - prev.y) : 0;
    const jumped = distance > Math.hypot(this.width, this.height) * .56;
    const timely=force||!Number.isFinite(receivedAt)||receivedAt-t<=COLLISION_HISTORY_MS;
    const connected = prev && gap > 0 && gap <= TRACK_GAP_MS && (!jumped || force)&&timely&&prevState?.timely!==false;
    const stroke = connected ? [...prevState.stroke.filter(p => t - p.t < 210), next].slice(-14) : [next];
    const pending=connected?[...(prevState.pending??[prev]).filter(p=>t-p.t<=SWIPE_WINDOW_MS),next].slice(-16):[next];
    const state={point:next,stroke,force,pending,timely};this.hands.set(key,state);
    if (force) {
      this.sliceAlong(connected ? prev : next, next);
      return;
    }
    if (!connected) return;
    // Reject frame-to-frame jitter. A short coherent motion can accumulate
    // across samples, so natural slow movement is not penalized by high FPS.
    // A fast deliberate sweep still qualifies from just two samples.
    const threshold=clamp(Math.min(this.width,this.height)*.020,12,13);
    let length=0,first=-1;
    for(let i=pending.length-2;i>=0;i--){
      const a=pending[i],b=pending[i+1];length+=Math.hypot(b.x-a.x,b.y-a.y);
      const net=Math.hypot(next.x-a.x,next.y-a.y),ms=next.t-a.t;
      if(ms>0&&net>=threshold&&net*1000/ms+1e-6>=this.mode.swipeSpeed&&net>=length*.70&&
         (pending.length-i>=3||net>=threshold*1.55))first=i;
    }
    if(first<0)return;
    // Consume only observed segments; never re-use an old swipe to hit a
    // fruit that appeared later. Timestamp-aware collisions are for camera
    // input only; direct programmatic/test and forced touch paths remain.
    for(let i=first;i<pending.length-1;i++){
      if(Number.isFinite(receivedAt))this.sliceAtSampleTime(pending[i],pending[i+1],receivedAt);
      else this.sliceAlong(pending[i],pending[i+1]);
      if(!this.running||this.paused)break;
    }
    state.pending=[next];
  }

  /** Record actual rendered targets and their times, NOT camera pixels.
   * Keep one boundary snapshot to interpolate recent motion; never invent
   * a future target or a target before its first appearance. */
  recordFrame(timestamp=now()) {
    if(!this.running||this.paused||!Number.isFinite(timestamp))return;
    const last=this.frameHistory.at(-1);
    if(last&&timestamp<=last.t)return;
    const targets=new Map();
    for(const f of this.fruits)targets.set(f,{x:f.x,y:f.y,r:f.r*fruitPresentation(f,this.shouldReduceMotion).scale});
    this.frameHistory.push({t:timestamp,targets});
    const cutoff=timestamp-COLLISION_HISTORY_MS;
    while(this.frameHistory.length>2&&(this.frameHistory[1].t<cutoff||this.frameHistory.length>40))this.frameHistory.shift();
  }

  /** Relative-motion swept collision over known recent display snapshots.
   * The hand and the fruit are compared at the same sample times, not at
   * inference completion. Current live entities alone can receive hits. */
  sliceAtSampleTime(a,b,receivedAt){
    if(!this.frameHistory.length||b.t<=a.t)return;
    const start=Math.max(a.t,receivedAt-COLLISION_HISTORY_MS),end=Math.min(b.t,receivedAt);
    if(end<start)return;
    const bladeRadius=clamp(Math.min(this.width,this.height)*.026,8,18);
    const area=this.playArea;
    const handAt=t=>{const f=(t-a.t)/(b.t-a.t);return {x:mix(a.x,b.x,f),y:mix(a.y,b.y,f)};};
    for(const fruit of [...this.fruits]){
      let hit=false;
      for(let i=0;i<this.frameHistory.length;i++){
        const frame=this.frameHistory[i],after=this.frameHistory[i+1],from=frame.targets.get(fruit);
        if(!from)continue;
        const until=after?.t??receivedAt;
        const t0=Math.max(start,frame.t),t1=Math.min(end,until);
        if(t1<t0)continue;
        // Interpolate only between two closely spaced actual snapshots of
        // the same fruit. A throttled/stalled display really holds the old
        // frame; don't invent a path through a location never shown.
        const to=after&&after.t-frame.t<=80?after.targets.get(fruit)??from:from;
        const at=t=>{const f=until>frame.t?clamp((t-frame.t)/(until-frame.t),0,1):0;return {x:mix(from.x,to.x,f),y:mix(from.y,to.y,f),r:mix(from.r,to.r,f)};};
        const p=at(t0),q=at(t1);
        let low=0,high=1;
        for(const [k,min,max] of [['x',area.left,area.right],['y',area.top,area.bottom]]){
          const delta=q[k]-p[k];
          if(Math.abs(delta)<1e-8){if(p[k]<min||p[k]>max){low=1;high=0;}continue;}
          const f0=(min-p[k])/delta,f1=(max-p[k])/delta;
          low=Math.max(low,Math.min(f0,f1));high=Math.min(high,Math.max(f0,f1));
        }
        if(high<low)continue;
        const u=mix(t0,t1,low),v=mix(t0,t1,high),c=at(u),d=at(v),h=handAt(u),j=handAt(v);
        // The fruit may be rising through the bottom clip; compare only the
        // visible portion of its known centre path with the observed hand.
        if(pointSegmentDistance(0,0,h.x-c.x,h.y-c.y,j.x-d.x,j.y-d.y)<=Math.min(c.r,d.r)+bladeRadius){hit=true;break;}
      }
      if(hit){this.hit(fruit,a,b);if(!this.running||this.paused)break;}
    }
  }

  sliceAlong(a, b) {
    const bladeRadius = clamp(Math.min(this.width, this.height) * .026, 8, 18);
    const { left,right,top,bottom } = this.playArea;
    // Copy candidates because every successful hit removes its entity before
    // callback. Thus repeated overlapping input cannot score the same item.
    for (const fruit of [...this.fruits]) {
      const visibleRadius=fruit.r*fruitPresentation(fruit,this.shouldReduceMotion).scale;
      if (fruit.y < top || fruit.y > bottom || fruit.x<left||fruit.x>right||!segmentCircleHit(a, b, {...fruit,r:visibleRadius}, bladeRadius)) continue;
      this.hit(fruit, a, b);
      if (!this.running || this.paused) break;
    }
  }

  hit(fruit, a, b) {
    const index = this.fruits.indexOf(fruit);
    if (index < 0) return;
    this.fruits.splice(index, 1);
    const bomb = fruit.type === 'bomb';
    if (bomb) {
      const before = this.score;
      this.score = Math.max(0, this.score - BOMB_PENALTY);
      this.combo=0;this.lastSliceAge=-100;
      this.beginBombEffect(fruit.x,fruit.y);
      this.burst(fruit, true);
      this.popups.push({ x: fruit.x, y: fruit.y, text: before === this.score ? '0' : `−${before - this.score}`, life: .86, color: '#ffdca1',
        anchorX:fruit.x,anchorY:fruit.y,anchorRadius:fruit.r,delta:this.score-before,bomb:true,combo:0 });
      this.onScore(this.score); this.onBomb(fruit, before - this.score);
    } else {
      const before = this.score;
      this.score += FRUIT_POINTS;
      this.combo=this.elapsed-this.lastSliceAge<=1.15 ? this.combo+1 : 1;
      this.lastSliceAge=this.elapsed;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      this.split(fruit, angle);
      this.burst(fruit, false);
      this.popups.push({ x: fruit.x, y: fruit.y - fruit.r * .5, text: this.active&&this.combo>=2 ? `+${FRUIT_POINTS} · ${this.combo}连击` : `+${FRUIT_POINTS}`, life: .85, color: this.combo>=2&&this.active?'#e6ff9a':'#fff0a1',
        anchorX:fruit.x,anchorY:fruit.y,anchorRadius:fruit.r,delta:this.score-before,bomb:false,combo:this.active?this.combo:0 });
      this.onScore(this.score); this.onSlice(fruit, FRUIT_POINTS,{combo:this.combo});
    }
    if(this.popups.length>GAME_LIMITS.popups)this.popups.splice(0,this.popups.length-GAME_LIMITS.popups);
    if(this.active&&!this.fruits.some(f=>f.type!=='bomb'))this.spawnIn=Math.min(this.spawnIn,.23);
  }

  split(fruit, angle) {
    for (const side of [-1, 1]) {
      const perpendicular = angle + Math.PI / 2;
      const speed = side * random(fruit.r * 2.8, fruit.r * 4.0);
      this.halves.push({ ...fruit, side, rot: angle - Math.PI / 2, vr: side * random(1.7, 3.6),
        vx: fruit.vx * .28 + Math.cos(perpendicular) * speed, vy: fruit.vy * .2 + Math.sin(perpendicular) * speed - fruit.r * .8,
        life: .68, x: fruit.x + side * Math.cos(perpendicular) * fruit.r * .1, y: fruit.y + side * Math.sin(perpendicular) * fruit.r * .1 });
    }
    if(this.halves.length>GAME_LIMITS.halves)this.halves.splice(0,this.halves.length-GAME_LIMITS.halves);
  }

  burst(fruit, bomb) {
    const count = bomb ? 14 : 16;
    for (let i = 0; i < count; i++) {
      const a = random(0, TAU), speed = fruit.r * random(1.8, 4.7), life = random(.28, .65);
      this.particles.push({ x: fruit.x, y: fruit.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - fruit.r * .7,
        r: random(fruit.r * .04, fruit.r * .11), life, maxLife: life, star: i % 4 === 0 || bomb,
        color: bomb ? (i % 2 ? '#f2d89f' : '#c6b8f0') : (i % 4 === 0 ? '#fff3b6' : COLORS[fruit.type].juice) });
    }
    // Keep GPU/CPU work bounded even during two-handed rapid demo play.
    if (this.particles.length > GAME_LIMITS.particles) this.particles.splice(0, this.particles.length - GAME_LIMITS.particles);
  }

  beginBombEffect(x,y){
    // A whimsical illustrated fracture, not a physical blast. Each ray is
    // fixed at creation, so there is no random flicker, hard flash or full-
    // screen brightness oscillation. One bounded effect per hit.
    const ox=clamp(x,0,this.width),oy=clamp(y,0,this.height),rays=[];
    for(let i=0;i<10;i++){
      const a=i*TAU/10+random(-.16,.16),dx=Math.cos(a),dy=Math.sin(a);
      const tx=dx>1e-5?(this.width-ox)/dx:dx< -1e-5?-ox/dx:Infinity;
      const ty=dy>1e-5?(this.height-oy)/dy:dy< -1e-5?-oy/dy:Infinity;
      const length=Math.min(tx,ty),points=[{x:ox,y:oy}];
      for(let k=1;k<=4;k++){
        const f=k/4,jitter=k===4?0:random(-.036,.036)*Math.min(this.width,this.height);
        points.push({x:clamp(ox+dx*length*f-dy*jitter,0,this.width),y:clamp(oy+dy*length*f+dx*jitter,0,this.height)});
      }
      rays.push(points);
    }
    this.bombEffect={x:ox,y:oy,age:0,duration:.58,rays};
  }

  drawBombEffect(ctx){
    const effect=this.bombEffect;
    if(!effect)return;
    const progress=clamp(effect.age/effect.duration,0,1);
    const shortSide=Math.min(this.width,this.height),reduced=this.shouldReduceMotion;
    const radius=Math.max(15,shortSide*(reduced?.15:.085+.205*progress));
    const fade=(1-progress)*(reduced?.35:.65);
    ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';ctx.lineJoin='round';
    // Keep the original deterministic event/rays and RNG sequence, but
    // use them only as a local toy-fracture pattern. No screen-sized
    // cracks, white/colored fill, flashing opacity, or full-screen shake in
    // this local layer. V1.6 has a separate decorative perimeter layer.
    if(!reduced)for(let i=0;i<effect.rays.length;i++){
      const ray=effect.rays[i],last=ray.at(-1);
      const length=Math.max(1,Math.hypot(last.x-effect.x,last.y-effect.y));
      const limit=Math.min(shortSide*.33,radius*(.83+(i%3)*.13));
      const at=p=>{
        const dx=p.x-effect.x,dy=p.y-effect.y,d=Math.hypot(dx,dy);
        const factor=Math.min(limit/length,limit/Math.max(1,d));
        return {x:effect.x+dx*factor,y:effect.y+dy*factor};
      };
      const first=at(ray[1]);ctx.beginPath();ctx.moveTo(first.x,first.y);
      for(let k=2;k<ray.length;k++){const p=at(ray[k]);ctx.lineTo(p.x,p.y);}
      // Fine contrasting under-stroke, not longer/brighter-area rays.
      ctx.globalAlpha=fade*.82;ctx.strokeStyle='#35264a';ctx.lineWidth=i%2?2.8:4.0;ctx.stroke();
      ctx.globalAlpha=fade;ctx.strokeStyle=i%2?'#d9c2ff':'#fed16d';ctx.lineWidth=i%2?1.4:2.3;ctx.stroke();
    }
    const ringWidth=2.5*(1-progress)+.9;
    ctx.beginPath();ctx.arc(effect.x,effect.y,radius,0,TAU);
    ctx.globalAlpha=fade*.94;ctx.strokeStyle='#302344';ctx.lineWidth=ringWidth+2.0;ctx.stroke();
    ctx.globalAlpha=fade;ctx.strokeStyle='#fed16d';ctx.lineWidth=ringWidth;ctx.stroke();
    if(!reduced){
      ctx.beginPath();ctx.arc(effect.x,effect.y,radius*.83,0,TAU);ctx.setLineDash([6,8]);
      ctx.globalAlpha=fade*.49;ctx.strokeStyle='#3a2b50';ctx.lineWidth=2.5;ctx.stroke();
      ctx.globalAlpha=fade*.42;ctx.strokeStyle='#e9c3f8';ctx.lineWidth=1.25;ctx.stroke();
    }
    ctx.restore();
  }

  nextActiveType() {
    if(!this.activeBag.length){
      this.activeBag=[...FRUIT_TYPES];
      for(let i=this.activeBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.activeBag[i],this.activeBag[j]]=[this.activeBag[j],this.activeBag[i]];}
    }
    const present=new Set(this.fruits.map(f=>f.type));
    const index=this.activeBag.findIndex(type=>!present.has(type));
    if(index<0)return FRUIT_TYPES.find(type=>!present.has(type))??this.activeBag.shift();
    return this.activeBag.splice(index,1)[0];
  }

  activeBounds(r){
    const {left,right,top,bottom,height}=this.playArea;
    // At the apex, leave room for leaves/stems and respect measured reach.
    const pad=r*1.32+2;
    const horizontal=this.horizontalSpawnRange(r);
    let xMin=Math.max(horizontal.minX,left+pad),xMax=Math.min(horizontal.maxX,right-pad);
    if(xMin>xMax)xMin=xMax=(left+right)/2;
    let yMin=Math.max(top+pad,this.reachZone?.minY!==undefined?this.height*this.reachZone.minY:this.cameraBounds?top+height*.16:this.height*.25);
    let yMax=Math.min(bottom-pad,this.reachZone?.maxY!==undefined?this.height*this.reachZone.maxY:this.cameraBounds?bottom-height*.15:this.height*.79);
    if(yMin>yMax){const nearest=clamp((yMin+yMax)/2,top+pad,bottom-pad);yMin=yMax=nearest;}
    return {minX:xMin,maxX:xMax,minY:yMin,maxY:yMax};
  }

  /** Predict a launch against the remaining visible portions of existing
   * trajectories. A narrow play area may need to wait for the next lane. */
  activePathClear(candidate, flight){
    const {top,bottom}=this.playArea;
    for(const other of this.fruits){
      const spacing=(candidate.r+other.r)*1.08+3;
      for(let t=0;t<=flight;t+=1/40){
        const y=candidate.y+candidate.vy*t+.5*candidate.g*t*t;
        const oy=other.y+other.vy*t+.5*other.g*t*t;
        if(y>bottom+candidate.r||oy>bottom+other.r||y<top-candidate.r||oy<top-other.r)continue;
        const x=candidate.x+candidate.vx*t,ox=clamp(other.x+other.vx*t,other.minX??0,other.maxX??this.width);
        if(Math.hypot(x-ox,y-oy)<spacing)return false;
      }
    }
    return true;
  }

  placeActive(r){
    const bounds=this.activeBounds(r), {minX,maxX,minY,maxY}=bounds;
    const {bottom,height}=this.playArea;
    const y=bottom+r*1.02;
    const peak=mix(minY,maxY,random(.32,.56));
    const rise=Math.max(1,y-peak);
    const g=Math.max(120,height*this.mode.gravity);
    const vy=-Math.sqrt(2*g*rise);
    // Continue the same physical trajectory until the fruit falls completely
    // outside the game area. Horizontal travel is bounded for the whole flight.
    const flight=(-vy+Math.sqrt(vy*vy+2*g*r*.48))/g;
    const right=this.spawnSeq%2!==0;
    const order=right?[1,.75,.5,.25,0]:[0,.25,.5,.75,1];
    const drift=Math.min(this.width*this.mode.maxDrift*1.6,(maxX-minX)*.2);
    for(const fx of order){
      const x=mix(minX,maxX,fx);
      for(const dx of [right?-drift:drift,0,right?drift:-drift]){
        const endX=clamp(x+dx,minX,maxX);
        const candidate={x,y,r,g,vy,vx:(endX-x)/flight,minX,maxX};
        if(this.activePathClear(candidate,flight))return candidate;
      }
    }
    return null;
  }

  spawnActive(){
    if(this.fruits.length>=this.maxObjects)return false;
    // One optional obstacle, only if a real positive target is within reach
    // when the bomb arrives. A tight lane is allowed to skip the obstacle.
    const {top,bottom}=this.playArea;
    const canBomb=this.elapsed>=this.mode.bombGrace&&this.elapsed-this.lastBombAge>=4.5&&
      this.fruits.some(f=>f.type!=='bomb'&&f.y>=top&&f.y<=bottom&&f.y+f.vy*.35+.5*f.g*.35*.35<=bottom)&&
      !this.fruits.some(f=>f.type==='bomb');
    let bomb=canBomb&&(this.elapsed-this.lastBombAge>=13||Math.random()<this.mode.bombRate);
    let place=this.placeActive(this.targetRadius*(bomb ? .83 : 1));
    if(!place&&bomb){bomb=false;place=this.placeActive(this.targetRadius);}
    if(!place)return false;
    this.spawnSeq++;
    if(bomb)this.lastBombAge=this.elapsed;
    this.fruits.push({...place,id:this.nextId++,type:bomb?'bomb':this.nextActiveType(),
      rot:random(-.24,.24),vr:this.shouldReduceMotion?0:random(-.42,.42)});
    return true;
  }

  spawnActiveWave(){
    if(!this.spawnActive())return false;
    this.onWave({count:1});
    return true;
  }

  spawn() {
    if(this.active)return this.spawnActive();
    const { top, bottom, height } = this.playArea;
    const mode = this.mode;
    const r = this.targetRadius;
    const { minX, maxX } = this.horizontalSpawnRange(r);
    const x = random(minX, maxX);
    const y = bottom + r * 1.02;
    const minPeak = top + r * 1.18;
    const peak = Math.min(bottom - r * 1.3, minPeak + height * random(.14, .39));
    const gravity = Math.max(120, height * mode.gravity);
    const rise = Math.max(r * 2, y - peak);
    const vy = -Math.sqrt(2 * gravity * rise);
    const apexTime = -vy / gravity;
    // Constrain the whole flight, not just the apex; otherwise the falling
    // fruit might leave the reachable lane after it passes peak height.
    const endX = clamp(x + random(-this.width * mode.maxDrift * 2, this.width * mode.maxDrift * 2), minX, maxX);
    const canBomb = this.elapsed > mode.bombGrace && this.elapsed - this.lastBombAge >= 5 && this.fruits.some(f => f.type !== 'bomb');
    const bomb = canBomb && Math.random() < mode.bombRate;
    if (bomb) this.lastBombAge = this.elapsed;
    this.fruits.push({ id: this.nextId++, type: bomb ? 'bomb' : FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)],
      x, y, r, minX, maxX, vx: (endX - x) / (2 * apexTime), vy, g: gravity, rot: random(-.35, .35), vr: random(-.72, .72) });
  }

  /** Advance real play time, not a frame-count-dependent 75 ms cap. When a
   * launch falls inside a frame, advance it for just the remaining time. */
  updateActiveFlight(dtSeconds) {
    const {bottom}=this.playArea;
    const advance=(dt)=>{
      for(const f of this.fruits){
        f.x=clamp(f.x+f.vx*dt,f.minX??0,f.maxX??this.width);
        f.y+=f.vy*dt+.5*f.g*dt*dt;
        f.vy+=f.g*dt;f.rot+=f.vr*dt;
      }
      const before=this.fruits.length;
      this.fruits=this.fruits.filter(f=>f.vy<0||f.y<bottom+f.r*1.5);
      if(this.fruits.length<before&&!this.fruits.some(f=>f.type!=='bomb'))this.spawnIn=Math.min(this.spawnIn,.18);
    };
    let left=dtSeconds;
    while(left>1e-8){
      const step=Math.min(left,Math.max(0,this.spawnIn));
      // Subtract before movement so an expiry can shorten the next launch.
      this.spawnIn-=step;
      if(step>0)advance(step);
      left-=step;
      if(this.spawnIn<=1e-8){
        this.spawnIn=this.spawnActiveWave()?random(...this.mode.spawn):.18;
      }
    }
  }

  update(dtSeconds) {
    if (!this.running || this.paused || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    const dt = Math.min(dtSeconds, .075);
    this.elapsed += dtSeconds; this.remaining = Math.max(0, this.remaining - dtSeconds);
    const time = Math.ceil(this.remaining);
    if (time !== this.lastTime) { this.lastTime = time; this.onTime(time); }
    if (this.remaining <= 0) {
      this.running = false; this.clearHands();this.bombEffect=null;
      this.onEnd({ score: this.score });
      return;
    }
    if(this.active)this.updateActiveFlight(dtSeconds);
    else {
      this.spawnIn-=dt;
      if(this.spawnIn<=0){
        if(this.fruits.length<this.mode.maxObjects)this.spawn();
        this.spawnIn=random(...this.mode.spawn);
      }
      const {bottom}=this.playArea;
      for(const fruit of this.fruits){
        fruit.x+=fruit.vx*dt;
        if(Number.isFinite(fruit.minX)&&Number.isFinite(fruit.maxX))fruit.x=clamp(fruit.x,fruit.minX,fruit.maxX);
        fruit.y+=fruit.vy*dt;fruit.vy+=fruit.g*dt;fruit.rot+=fruit.vr*dt;
      }
      this.fruits=this.fruits.filter(f=>f.vy<0||f.y<bottom+f.r*1.5);
    }
    for (const h of this.halves) { h.x += h.vx * dt; h.y += h.vy * dt; h.vy += (h.g || 420) * dt; h.rot += h.vr * dt; h.life -= dt; }
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 350 * dt; p.life -= dt; }
    for (const p of this.popups) { p.y -= 38 * dt; p.life -= dt; }
    this.halves = this.halves.filter(h => h.life > 0);
    this.particles = this.particles.filter(p => p.life > 0);
    this.popups = this.popups.filter(p => p.life > 0);
    if(this.bombEffect){this.bombEffect.age+=dtSeconds;if(this.bombEffect.age>=this.bombEffect.duration)this.bombEffect=null;}
    if(this.elapsed-this.lastSliceAge>1.15)this.combo=0;
    // A lost input source cannot leave a glowing cursor or an active blade.
    const t = now();
    for (const [key, hand] of this.hands) if (t - hand.point.t > TRACK_GAP_MS) this.hands.delete(key);
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.running && !this.fruits.length) return;
    const { left,top,width,bottom } = this.playArea;
    const reduceMotion=this.shouldReduceMotion;
    // The short edge feedback intentionally covers the entire viewport, not
    // just the calibrated launch rectangle. It is behind all play objects
    // and hand marks and never translates or recolors the real camera.
    drawPressureFrame(ctx,this.bombEffect,this.width,this.height,reduceMotion);
    ctx.save(); ctx.beginPath(); ctx.rect(left,top,width,bottom-top); ctx.clip();
    // Decorative obstacle feedback sits behind still-live cuttable fruit and
    // the accepted hand marker, never suppressing either one.
    this.drawBombEffect(ctx);
    // Non-cuttable decorations are behind *all* live targets. A separated
    // half or a juice drop may travel through a neighbor's exact position,
    // but cannot cover the next target. Isolate decorative shake so live
    // centers, clipping, camera, hand markers and history never move.
    ctx.save();
    const shake=this.shakeOffset;if(shake.x||shake.y)ctx.translate(shake.x,shake.y);
    for (const half of this.halves) drawHalf(ctx, half);
    for (const p of this.particles) drawJuice(ctx, p,reduceMotion);
    ctx.restore();
    // Real delta badges are anchored to their actual cuts, avoiding all
    // still-live targets/hand traces. Paint them below live truth as a
    // second protection against occlusion; their own slots are not targets.
    paintScoreLabels(ctx,layoutScoreLabels(ctx,this.popups,this));
    for (const fruit of this.fruits) drawEntity(ctx, fruit, reduceMotion);
    ctx.restore();
    if (!this.paused) this.drawHands();
  }

  drawHands() {
    const ctx=this.ctx,t=now(),reduced=this.shouldReduceMotion;
    for (const hand of this.hands.values()) {
      // Preserve the accepted V1.3 current-point display window EXACTLY.
      // Only the decorative tapered trace is shorter; it cannot predict a
      // point, bridge an input break, or change what the collision uses.
      const accepted=hand.stroke.filter(p=>t-p.t<=210);
      if(!accepted.length)continue;
      const trailWindowMs=reduced?85:hand.force?190:145;
      const trail=accepted.filter(p=>t-p.t<=trailWindowMs);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const age=clamp(1-(t-b.t)/trailWindowMs,0,1),v=i/trail.length;
        const line=mix(2.2,reduced?7:12.6,age)*mix(.4,1,v);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        if(!reduced){ctx.globalAlpha=age*.37;ctx.strokeStyle='#171a36';ctx.lineWidth=line+2.4;ctx.stroke();}
        ctx.globalAlpha=age*.72;ctx.strokeStyle='#77e9f7';ctx.lineWidth=line;ctx.stroke();
        ctx.globalAlpha=age*.90;ctx.strokeStyle='#fffef3';ctx.lineWidth=Math.max(1,line*.30);ctx.stroke();
      }
      const p = hand.point;
      ctx.globalAlpha=.88;ellipse(ctx,p.x,p.y,10,10);
      ctx.strokeStyle='#171a36';ctx.lineWidth=4;ctx.stroke();
      ctx.strokeStyle='#eafff5';ctx.lineWidth=2;ctx.stroke();
      fillEllipse(ctx, p.x, p.y, 4.5, 4.5, '#fffce1'); ctx.restore();
    }
  }
}
