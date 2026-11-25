// W8 isolation-only combined art adaptation. Never a completed or published family game.
import {drawV23Effect} from './v23-effects.js?v=2.3-w4';
import {MONSTER_THEME,heroIds,monsterIds,roleById as original} from './monster-theme.js?v=2.0-iso';
import {validateNamedManifest as validateW7, decodeLocalImage} from './named-art-theme.js?v=2.2-w9';

const W8_HERO=Object.freeze({
  'ultraman-hero-ultraseven':'Ultraseven', 'ultraman-hero-ultraman-taro':'Ultraman Taro',
  'ultraman-hero-ultraman-zero':'Ultraman Zero', 'ultraman-hero-ultraman-mebius':'Ultraman Mebius',
  'ultraman-hero-ultraman-orb':'Ultraman Orb', 'ultraman-hero-ultraman-geed':'Ultraman Geed',
});
const W8_KAIJU=Object.freeze({
  'ultraman-kaiju-alien-baltan':'Alien Baltan','ultraman-kaiju-zetton':'Zetton',
  'ultraman-kaiju-red-king':'Red King','ultraman-kaiju-eleking':'Eleking',
  'ultraman-kaiju-king-joe':'King Joe','ultraman-kaiju-bemstar':'Bemstar',
});
const color=role=>role?.series==='ultraman-hero'?'#c0e1ff':role?.series==='ultraman-kaiju'?'#eac1fd':role?.series==='paw-patrol'?'#f8ca68':'#aec8ff';
export function validateW8(manifest){
  if(!manifest||manifest.schema!==1||!Array.isArray(manifest.rows)||manifest.rows.length!==12)throw new Error('Incomplete W8 manifest');
  const ids=new Set(),hashes=new Set(),files=new Set();
  const rows=manifest.rows.map(r=>{
    if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string')throw new Error('Unknown W8 role');
    const isHero=Object.hasOwn(W8_HERO,r.id),isKaiju=Object.hasOwn(W8_KAIJU,r.id);if(!isHero&&!isKaiju)throw new Error('Unverified W8 role: '+r.id);
    if(r.label!==(isHero?W8_HERO:W8_KAIJU)[r.id]||r.series!==(isHero?'ultraman-hero':'ultraman-kaiju')||r.hero!==isHero||r.cuttable!==!isHero)throw new Error('Conflicting W8 explicit role '+r.id);
    if(r.file!==`sprites/${r.id}.png`||!/^sprites\/[a-z0-9-]+\.png$/.test(r.file))throw new Error('Unsafe or mismatched W8 sprite path '+r.id);
    if(!/^[0-9a-f]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<=0||r.bytes>1024*1024||r.width!==256||r.height!==256)throw new Error('Invalid W8 image metadata '+r.id);
    if(ids.has(r.id)||files.has(r.file)||hashes.has(r.sha256))throw new Error('Duplicate W8 ID, file, or image');ids.add(r.id);files.add(r.file);hashes.add(r.sha256);
    return Object.freeze({id:r.id,label:r.label,series:r.series,file:r.file,cuttable:r.cuttable,hero:r.hero,sha256:r.sha256,bytes:r.bytes,width:r.width,height:r.height,source:'w8'});
  });
  if(ids.size!==12||Object.keys(W8_HERO).some(id=>!ids.has(id))||Object.keys(W8_KAIJU).some(id=>!ids.has(id)))throw new Error('Missing expected W8 named assets');
  return Object.freeze(rows);
}
export function validateCombined(manifest7,manifest8){
  const rows7=validateW7(manifest7);if(rows7.length!==12)throw new Error('Incomplete W7 cast');
  const rows=Object.freeze([...rows7.map(r=>Object.freeze({...r,source:'w7'})),...validateW8(manifest8)]);
  const ids=new Set(rows.map(r=>r.id)),hashes=new Set(rows.map(r=>r.sha256)),paths=new Set(rows.map(r=>`${r.source}/${r.file}`));
  if(rows.length!==24||ids.size!==24||hashes.size!==24||paths.size!==24||rows.filter(r=>r.cuttable).length!==18||rows.filter(r=>r.hero).length!==6)throw new Error('Combined repeated or missing role');return rows;
}
function shieldMark(ctx,r){
  ctx.save();ctx.translate(0,.64*r);ctx.fillStyle='#142946';ctx.strokeStyle='#ecf7ff';ctx.lineWidth=Math.max(1.5,r*.035);ctx.beginPath();ctx.arc(0,0,.33*r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#b6e3ff';ctx.lineWidth=Math.max(2,r*.065);ctx.beginPath();ctx.moveTo(-.13*r,-.14*r);ctx.lineTo(.13*r,-.14*r);ctx.lineTo(.11*r,.06*r);ctx.lineTo(0,.18*r);ctx.lineTo(-.11*r,.06*r);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(-.18*r,-.18*r);ctx.lineTo(.18*r,.18*r);ctx.stroke();ctx.restore();
}
function drawHeroMark(ctx,r){ctx.strokeStyle='#d4f0ff';ctx.lineWidth=Math.max(2,r*.035);ctx.beginPath();ctx.arc(0,0,r*.98,0,Math.PI*2);ctx.stroke();shieldMark(ctx,r);
  ctx.fillStyle='#142946';ctx.fillRect(-r*.69,-r*.99,r*1.38,r*.3);ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(11,r*.23)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('不要切',0,-r*.84);}
function drawEffect(ctx,e,reduced){const progress=Math.max(0,Math.min(1,e.age/e.duration));if(progress>=1)return;ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=(1-progress)*.5;ctx.strokeStyle=e.kind==='shield'?'#c0e0ff':'#ffdd9a';ctx.lineWidth=Math.max(2,e.r*.06);ctx.beginPath();ctx.arc(0,0,e.r*(reduced?1.02:.84+.32*progress),0,2*Math.PI);ctx.stroke();if(e.kind==='shield')shieldMark(ctx,e.r*.8);ctx.restore();}
export async function createCombinedArtTheme(manifest7,manifest8,{loadImage=decodeLocalImage,baseW7=new URL('../assets/family-w7/',import.meta.url),baseW8=new URL('../assets/family-w8/',import.meta.url),technicalPreview=false}={}){
  if(technicalPreview!==true)throw new Error('Incomplete required family cast, specified music, and device validation; formal start blocked');
  const rows=validateCombined(manifest7,manifest8),records=new Map();
  for(const row of rows){const base=row.source==='w7'?baseW7:baseW8,url=new URL(row.file,base);if(url.origin!==base.origin||!url.href.startsWith(base.href))throw new Error('Asset outside isolated preview');const record=await loadImage(url,row);if(!record?.image||record.width!==row.width||record.height!==row.height||record.bytes!==row.bytes||record.sha256!==row.sha256)throw new Error('Image verification failed for '+row.id);records.set(row.id,{row,image:record.image});}
  let cutIndex=0,heroIndex=0;
  const roleById=Object.freeze(Object.fromEntries(rows.map(row=>{
    const hero=row.hero;const ordinal=hero?heroIndex++:cutIndex++,reuse=original[(hero?heroIds:monsterIds)[ordinal%(hero?heroIds:monsterIds).length]];
    const cues=hero?{wrongCue:reuse.wrongCue,shield:true}:{appearanceCue:reuse.appearanceCue,defeatCue:reuse.defeatCue};
    return [row.id,Object.freeze({...row,kind:hero?'hero':'monster',ordinal,...cues,cueSource:'R2 technical reuse; not character-specific voice/recording'})];
  })));
  return Object.freeze({id:MONSTER_THEME.id,previewOnly:true,formalReady:false,
    unavailableRequestedSeries:Object.freeze(['doraemon','minions','mickey/full-cast']),remainingRequirements:Object.freeze(['all requested casts','specified song actual local file','real browser/camera/device QA']),
    targetTypes:Object.freeze(rows.filter(r=>r.cuttable).map(r=>r.id)),obstacleTypes:Object.freeze(rows.filter(r=>r.hero).map(r=>r.id)),roleById,
    burstColor(type){return color(roleById[type]);},
    draw(ctx,e,p){const role=roleById[e.type],rec=records.get(e.type);if(!role||!rec)throw new Error('Unverified role or sprite '+e.type);const scale=Math.min(2*e.r/rec.row.width,2*e.r/rec.row.height);ctx.save();ctx.translate(e.x,e.y);ctx.scale(p.scale,p.scale);ctx.globalAlpha=p.opacity;ctx.drawImage(rec.image,-rec.row.width*scale/2,-rec.row.height*scale/2,rec.row.width*scale,rec.row.height*scale);if(role.hero)drawHeroMark(ctx,e.r);ctx.restore();},
    drawEffect(ctx,e,reduced){drawV23Effect(ctx,e,reduced,{variant:'B',baseDraw:drawEffect,role:roleById[e.type]});},drawFlame(){},getVerifiedAssetSummary(){return rows.map(r=>({...r}));},
  });
}
