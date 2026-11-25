// Original toy-style theme. Role IDs and event cues are independent of fruit.
export const monsterIds=Object.freeze(['fire-dragon','ice-dragon','robot','electric','dinosaur','horn','wing','bat','octopus','deep-sea','rock','lava','alien','slime']);
export const heroIds=Object.freeze(['guardian-red','guardian-blue','guardian-gold','guardian-green','guardian-violet','guardian-silver']);
const monsterLabels=['火焰龙','冰晶龙','机械兽','闪电兽','恐龙兽','巨角兽','风翼兽','夜空兽','章鱼兽','深海兽','岩石兽','熔岩兽','外星兽','果冻兽'];
const heroLabels=['红星守护者','蓝星守护者','金星守护者','绿星守护者','紫星守护者','银星守护者'];
const palette=['#ff9759','#b5e9ff','#a7c9da','#ffdd7c','#a4dd8b','#ffe4b5','#95d8fc','#d2a5f9','#fbaccc','#86dbd9','#c9c6d3','#ffc28a','#d4bbf9','#a5ec92'];
export const roleById=Object.freeze(Object.fromEntries([
  ...monsterIds.map((id,i)=>[id,Object.freeze({id,kind:'monster',ordinal:i,label:monsterLabels[i],appearanceCue:`appear-${id}`,defeatCue:`defeat-${id}`})]),
  ...heroIds.map((id,i)=>[id,Object.freeze({id,kind:'hero',ordinal:i,label:heroLabels[i],wrongCue:`wrong-${id}`,shield:true})]),
]));
const sprites=new Map();
function sprite(id){
  if(sprites.has(id))return sprites.get(id);
  if(typeof Image==='undefined')return null;
  const record={image:new Image(),state:'loading'};sprites.set(id,record);
  record.image.onload=()=>{record.state='ready';};record.image.onerror=()=>{record.state='missing';};
  record.image.src=new URL(`../assets/monster/art/${id}.png`,import.meta.url).href;return record;
}
export function prepareMonsterArt(){for(const id of [...monsterIds,...heroIds])sprite(id);}
export function monsterArtStatus(){const records=[...sprites.values()];return {ready:records.filter(x=>x.state==='ready').length,missing:records.filter(x=>x.state==='missing').length,total:monsterIds.length+heroIds.length};}

function shieldMark(ctx,r){
  ctx.save();ctx.translate(0,.64*r);ctx.fillStyle='#142946';ctx.strokeStyle='#ecf7ff';ctx.lineWidth=Math.max(1.5,r*.035);ctx.beginPath();ctx.arc(0,0,.33*r,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Shield silhouette and slash mark: distinguish by shape and text, never only color.
  ctx.strokeStyle='#b6e3ff';ctx.lineWidth=Math.max(2,r*.065);ctx.beginPath();ctx.moveTo(-.13*r,-.14*r);ctx.lineTo(.13*r,-.14*r);ctx.lineTo(.11*r,.06*r);ctx.lineTo(0,.18*r);ctx.lineTo(-.11*r,.06*r);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(-.18*r,.18*r);ctx.lineTo(.18*r,-.18*r);ctx.stroke();ctx.restore();
}
function drawRole(ctx,entity,presentation){
  const {r,type}=entity,role=roleById[type];if(!role)return;
  ctx.save();ctx.translate(entity.x,entity.y);ctx.scale(presentation.scale,presentation.scale);ctx.globalAlpha=presentation.opacity;
  const rec=sprite(type);
  if(rec?.state==='ready'){
    const im=rec.image,w=im.naturalWidth,h=im.naturalHeight,scale=Math.min(2*r/w,2*r/h);
    if(Number.isFinite(scale)&&scale>0)ctx.drawImage(im,-w*scale/2,-h*scale/2,w*scale,h*scale);
  }else{
    // Explicit diagnostic placeholder, never pretend missing art is finished.
    ctx.beginPath();ctx.arc(0,0,r*.86,0,Math.PI*2);ctx.fillStyle=role.kind==='hero'?'#7aa9e8':palette[role.ordinal];ctx.fill();
    ctx.strokeStyle='#32496c';ctx.lineWidth=Math.max(2,r*.04);ctx.stroke();ctx.fillStyle='#18283c';ctx.font=`bold ${Math.max(10,r*.29)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(role.label,0,-.08*r);ctx.font=`${Math.max(9,r*.2)}px sans-serif`;ctx.fillText('素材待载入',0,.26*r);
  }
  if(role.kind==='hero'){
    ctx.strokeStyle='#d4f0ff';ctx.lineWidth=Math.max(2,r*.035);ctx.beginPath();ctx.arc(0,0,r*.98,0,Math.PI*2);ctx.stroke();shieldMark(ctx,r);
    ctx.fillStyle='#142946';ctx.fillRect(-r*.69,-r*.99,r*1.38,r*.3);ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(11,r*.23)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('不要切',0,-r*.84);
  }
  ctx.restore();
}
function drawEffect(ctx,e,reduced){
  const role=roleById[e.type];if(!role)return;
  const progress=Math.max(0,Math.min(1,e.age/e.duration)),fade=(1-progress)*(reduced?.34:.72);if(!fade)return;
  ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=fade;const radius=e.r*(reduced?1.02:.73+.46*progress);
  ctx.strokeStyle=e.kind==='shield'?'#bfeaff':palette[role.ordinal];ctx.lineWidth=Math.max(2,e.r*.075);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();
  if(e.kind==='shield'){shieldMark(ctx,e.r*.9);}else if(!reduced){
    // Distinct role signatures via color, radial count, rotation and shape. Soft
    // trails are bounded behind live targets. No screen flash, hitbox or RNG.
    const count=4+role.ordinal%5,offset=role.ordinal*.37,spread=e.r*(.62+.53*progress);ctx.lineCap='round';ctx.lineWidth=Math.max(1.5,e.r*.044);
    for(let i=0;i<count;i++){const a=offset+i*2*Math.PI/count,x=Math.cos(a),y=Math.sin(a);ctx.beginPath();ctx.moveTo(x*spread*.75,y*spread*.75);ctx.lineTo(x*spread,y*spread);ctx.stroke();if(role.ordinal%3===0){ctx.beginPath();ctx.arc(x*spread,y*spread,e.r*.042,0,2*Math.PI);ctx.stroke();}else if(role.ordinal%3===1){ctx.beginPath();ctx.moveTo(x*spread-y*e.r*.08,y*spread+x*e.r*.08);ctx.lineTo(x*spread+y*e.r*.08,y*spread-x*e.r*.08);ctx.stroke();}}
  }
  ctx.restore();
}
function drawFlame(ctx,e,reduced){
  if(reduced||!['fire-dragon','lava'].includes(e.type))return;const age=e.themeAge??0;
  if(age<.28||age>1.04)return;const p=(age-.28)/.76,alpha=Math.sin(Math.PI*p)*.4;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(e.x,e.y);ctx.fillStyle='#ffad69';ctx.beginPath();ctx.moveTo(-e.r*.12,e.r*.08);ctx.quadraticCurveTo(-e.r*1.16,-e.r*.56,-e.r*1.44,e.r*.15);ctx.quadraticCurveTo(-e.r*.72,e.r*.4,-e.r*.12,e.r*.19);ctx.closePath();ctx.fill();ctx.restore();
}
export const MONSTER_THEME=Object.freeze({id:'monster',targetTypes:monsterIds,obstacleTypes:heroIds,roleById,burstColor:type=>palette[roleById[type]?.ordinal]??'#fff3b6',draw:drawRole,drawEffect,drawFlame});

// Theme scoped records; keep the V1.7 60-second and 180-second keys intact.
export function monsterBestKey(mode){return ['active','easy'].includes(mode)?`fruit-planet-monster-best-180-${mode}`:null;}
export function monsterBestForMode(storage,mode,score){const safe=v=>Number.isFinite(v)?Math.max(0,Math.trunc(v)):0;const current=safe(score),key=monsterBestKey(mode);if(!storage||!key)return current;
  let previous=0;try{previous=safe(Number(storage.getItem(key)));}catch{}const best=Math.max(current,previous);try{storage.setItem(key,String(best));}catch{}return best;}
