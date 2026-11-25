// W7 isolation-only art adapter. This is not a complete family pack nor a production route.
import { MONSTER_THEME, heroIds, monsterIds, roleById as original } from './monster-theme.js?v=2.0-iso';

const LABELS = Object.freeze({
  'paw-patrol-chase':'Chase','paw-patrol-marshall':'Marshall','paw-patrol-skye':'Skye',
  'paw-patrol-rubble':'Rubble','paw-patrol-rocky':'Rocky','paw-patrol-zuma':'Zuma',
  'super-wings-jett':'Jett','super-wings-dizzy':'Dizzy','super-wings-donnie':'Donnie',
  'super-wings-jerome':'Jerome','super-wings-paul':'Paul','super-wings-mira':'Mira',
});
const isManifestRow=(r)=>r&&typeof r==='object'&&!Array.isArray(r);
const color=(role)=>role.series==='paw-patrol'?'#f8ca68':'#aec8ff';

export function validateNamedManifest(manifest){
  if(!manifest||manifest.schema!==1||!Array.isArray(manifest.rows)||!manifest.rows.length||manifest.rows.length>Object.keys(LABELS).length)throw new Error('Invalid W7 manifest');
  const ids=new Set(),files=new Set(),hashes=new Set();
  return Object.freeze(manifest.rows.map((r)=>{
    if(!isManifestRow(r)||typeof r.id!=='string'||!(Object.hasOwn(LABELS,r.id))||LABELS[r.id]!==r.label)throw new Error('Unverified named role or label');
    const expectedSeries=r.id.startsWith('paw-patrol-')?'paw-patrol':'super-wings';
    if(r.series!==expectedSeries||r.cuttable!==true||r.hero!==false)throw new Error('Conflicting explicit category '+r.id);
    if(r.file!==`sprites/${r.id}.png`||!/^sprites\/[a-z0-9-]+\.png$/.test(r.file))throw new Error('Unsafe or mismatched sprite path '+r.id);
    if(ids.has(r.id)||files.has(r.file)||hashes.has(r.sha256))throw new Error('Duplicate id, file or image');
    if(!/^[0-9a-f]{64}$/.test(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<=0||r.bytes>1024*1024||r.width!==256||r.height!==256)throw new Error('Invalid image metadata '+r.id);
    ids.add(r.id);files.add(r.file);hashes.add(r.sha256);
    return Object.freeze({id:r.id,label:r.label,series:r.series,file:r.file,cuttable:true,hero:false,sha256:r.sha256,bytes:r.bytes,width:r.width,height:r.height});
  }));
}

// Local scratch preview only. The load callback verifies all bytes before any game theme is made.
// Browser implementation remains UNVERIFIED; tests inject an actual Pillow PNG decoder, not fake artwork.
export async function decodeLocalImage(url){
  if(typeof fetch!=='function'||typeof Image!=='function'||!globalThis.crypto?.subtle)throw new Error('Browser image loading unavailable');
  if(url.origin!==new URL(import.meta.url).origin)throw new Error('Non-local asset origin');
  const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error('Image missing: '+url.pathname);
  const bytes=await response.arrayBuffer();if(bytes.byteLength<33||bytes.byteLength>1024*1024)throw new Error('Invalid PNG size');
  const magic=new Uint8Array(bytes,0,8);if(![137,80,78,71,13,10,26,10].every((v,i)=>magic[i]===v))throw new Error('Invalid PNG header');
  const head=new DataView(bytes);if(head.getUint32(16)!==256||head.getUint32(20)!==256||head.getUint8(24)!==8||head.getUint8(25)!==6)throw new Error('Expected 256x256 8-bit RGBA PNG');
  const digest=await crypto.subtle.digest('SHA-256',bytes);const sha256=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const objectURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));const image=new Image();
  try{image.src=objectURL;await image.decode();if(image.naturalWidth!==256||image.naturalHeight!==256)throw new Error('Unexpected decoded dimensions');
    const probe=document.createElement('canvas');probe.width=256;probe.height=256;const px=probe.getContext('2d',{willReadFrequently:true});if(!px)throw new Error('Image alpha verification unavailable');px.drawImage(image,0,0);const rgba=px.getImageData(0,0,256,256).data;let hasContent=false;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){const alpha=rgba[(y*256+x)*4+3];if(alpha){hasContent=true;if(x<8||x>=248||y<8||y>=248)throw new Error('Missing transparent safety margin');}}
    if(!hasContent)throw new Error('Blank image');return {image,width:image.naturalWidth,height:image.naturalHeight,bytes:bytes.byteLength,sha256};}finally{URL.revokeObjectURL(objectURL);}
}

function drawTechHero(ctx,e,presentation,label){
  const r=e.r;ctx.save();ctx.translate(e.x,e.y);ctx.scale(presentation.scale,presentation.scale);ctx.globalAlpha=presentation.opacity;
  ctx.beginPath();ctx.arc(0,0,r*.9,0,2*Math.PI);ctx.fillStyle='#dae5f3';ctx.fill();ctx.lineWidth=Math.max(2,r*.06);ctx.strokeStyle='#355072';ctx.stroke();
  ctx.fillStyle='#172a4a';ctx.textBaseline='middle';ctx.textAlign='center';ctx.font=`bold ${Math.max(9,r*.22)}px sans-serif`;ctx.fillText('原R2技术对照',0,-r*.18);ctx.fillText('非奥特曼 · 勿切',0,r*.10);ctx.font=`${Math.max(8,r*.14)}px sans-serif`;ctx.fillText(label,0,r*.4);ctx.restore();
}
function drawEffect(ctx,e,reduced){const progress=Math.max(0,Math.min(1,e.age/e.duration));if(progress>=1)return;ctx.save();ctx.translate(e.x,e.y);ctx.globalAlpha=(1-progress)*.5;ctx.strokeStyle=e.kind==='shield'?'#c0e0ff':'#ffdd9a';ctx.lineWidth=Math.max(2,e.r*.06);ctx.beginPath();ctx.arc(0,0,e.r*(reduced?1.02:.84+.32*progress),0,2*Math.PI);ctx.stroke();ctx.restore();}

export async function createNamedArtTheme(manifest,{loadImage=decodeLocalImage,baseURL=new URL('./',import.meta.url),technicalPreview=false}={}){
  if(technicalPreview!==true)throw new Error('Incomplete requested family cast and no genuine named hero images; formal start blocked');
  const rows=validateNamedManifest(manifest),records=new Map();
  for(const row of rows){const url=new URL(row.file,baseURL);if(url.origin!==baseURL.origin||!url.href.startsWith(baseURL.href))throw new Error('Asset outside preview');
    const image=await loadImage(url,row);if(!image?.image||image.width!==row.width||image.height!==row.height||image.bytes!==row.bytes||image.sha256!==row.sha256)throw new Error('Image verification failed for '+row.id);
    records.set(row.id,{row,image:image.image});
  }
  const roleEntries=[];
  for(const [ordinal,r] of rows.entries()){
    const reuse=original[monsterIds[ordinal%monsterIds.length]];
    // These are existing R2 technical cues, not character-specific voice/audio assets.
    roleEntries.push([r.id,Object.freeze({...r,kind:'monster',ordinal,appearanceCue:reuse.appearanceCue,defeatCue:reuse.defeatCue,cueSource:'R2 technical reuse'})]);
  }
  for(const id of heroIds){const r=original[id];roleEntries.push([id,Object.freeze({...r,cuttable:false,hero:true,series:'r2-technical-control',file:null,technicalControl:true,label:r.label+'（R2技术对照，非奥特曼）'})]);}
  const roleById=Object.freeze(Object.fromEntries(roleEntries));
  return Object.freeze({
    id:MONSTER_THEME.id,previewOnly:true,formalReady:false,technicalControls:true,
    unavailableSeries:Object.freeze(['doraemon','minions','ultraman-hero','ultraman-kaiju']),
    targetTypes:Object.freeze(rows.map(x=>x.id)),obstacleTypes:Object.freeze([...heroIds]),roleById,
    burstColor(type){const role=roleById[type];return role?.technicalControl?'#c0e0ff':color(role??{});},
    draw(ctx,e,p){const role=roleById[e.type];if(!role)throw new Error('Unknown target id '+e.type);if(role.technicalControl)return drawTechHero(ctx,e,p,original[e.type].label);
      const rec=records.get(e.type);if(!rec)throw new Error('Verified sprite absent '+e.type);const scale=Math.min(2*e.r/rec.row.width,2*e.r/rec.row.height);
      ctx.save();ctx.translate(e.x,e.y);ctx.scale(p.scale,p.scale);ctx.globalAlpha=p.opacity;ctx.drawImage(rec.image,-rec.row.width*scale/2,-rec.row.height*scale/2,rec.row.width*scale,rec.row.height*scale);ctx.restore();},
    drawEffect,drawFlame(){},
    // No mutable record/Map exported: each requested ID is bound to its verified named image.
    getVerifiedAssetSummary(){return rows.map(r=>({...r}));},
  });
}
