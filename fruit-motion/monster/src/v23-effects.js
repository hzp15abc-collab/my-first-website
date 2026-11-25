/* V2.3 isolated W2 candidate visual effects. Render only; never score/collide/play audio. */
const TAU=Math.PI*2
const PALETTES=Object.freeze({
 'paw-patrol':Object.freeze(['#ffd77b','#fff2bf','#81ddd9','#b1e1ff']),
 'super-wings':Object.freeze(['#7adce7','#ffe7a2','#b8c5fc','#fff4d4']),
 'ultraman-kaiju':Object.freeze(['#edcaf7','#9adfe6','#ffe3a3','#cae8b1'])
})
const DEFAULT=PALETTES['paw-patrol']
export const LIMITS=Object.freeze({effects:10,particles:8,normalDuration:.50,reducedDuration:.22,ghostDuration:.14,radius:1.6})
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function hashID(id){let h=2166136261;for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function pseudo(seed,index){let x=(seed+Math.imul(index+1,0x9e3779b9))>>>0;x=Math.imul(x^(x>>>16),0x85ebca6b);x=Math.imul(x^(x>>>13),0xc2b2ae35);return ((x^(x>>>16))>>>0)/4294967296}
export function annotateImpact(base,roundSerial,fruit,kind,clock,reduced) {
 const eventId=`${roundSerial}:${fruit.id}:${kind==='shield'?'wrong':'defeat'}`
 base.eventId=eventId;base.hitClock=clock;base.seed=hashID(eventId)
 if(reduced)base.duration=LIMITS.reducedDuration
 else if(kind==='energy')base.duration=LIMITS.normalDuration
 return base
}
function ring(ctx,r,line,opacity,color){ctx.globalAlpha=opacity;ctx.strokeStyle=color;ctx.lineWidth=line;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke()}
function star(ctx,x,y,r,rot,opacity,color){ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.beginPath(); for(let i=0;i<8;i++){const a=rot+i*TAU/8,sz=i%2===0?r:r*.35;const px=x+Math.cos(a)*sz,py=y+Math.sin(a)*sz;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)}ctx.closePath();ctx.fill()}
function intensity(age,duration){if(age<=.075)return .70+.25*(age/.075);const q=clamp((age-.075)/(duration-.075),0,1);return .95*(1-q)*(1-q)}
function dots(ctx,e,t,opacity,colors,count){const r=e.r,ease=1-(1-t)**2
 for(let i=0;i<count;i++){
  const dir=(i+(.16+pseudo(e.seed,i)*.29))/count*TAU;
  const dist=r*(.40+(.68+.19*pseudo(e.seed,i+15))*ease);
  const dx=Math.cos(dir)*dist,dy=Math.sin(dir)*dist+r*.12*t*t;
  let size=r*(.075+.045*pseudo(e.seed,i+40))*(1-.35*t);
  star(ctx,dx,dy,size,dir+.3*t,opacity*.88,colors[i%colors.length])
 }
}
// W3 only B: larger outlined color star pieces and a soft centered pop.
// Eight geometry pieces, fixed bounded radius, no body imagery or extra clocks.
const B_COLORS=Object.freeze(['#ffd45b','#69d5ef','#f6b5ec','#99e0a5'])
function bStar(ctx,x,y,size,rot,opacity,color,r){
 ctx.beginPath()
 for(let i=0;i<10;i++){const a=rot+i*TAU/10,sz=i%2===0?size:size*.53;
  const px=x+Math.cos(a)*sz,py=y+Math.sin(a)*sz;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)}
 ctx.closePath()
 ctx.lineJoin='round';ctx.lineCap='round'
 ctx.globalAlpha=opacity*.90;ctx.strokeStyle='#26374d';ctx.lineWidth=Math.max(2.2,r*.066);ctx.stroke()
 ctx.globalAlpha=opacity*.94;ctx.strokeStyle='#fff7d5';ctx.lineWidth=Math.max(1.1,r*.033);ctx.stroke()
 ctx.globalAlpha=opacity;ctx.fillStyle=color;ctx.fill()
}
function burstB(ctx,e,t,opacity,colors){
 const r=e.r,ease=1-(1-t)**2
 // Soft central pop fades during the initial impact (not a flash of the whole view).
 // It is a single centered outlined circle, not a ninth particle.
 if(e.age<.17){const u=e.age/.17,f=(1-u)*(1-u),c=r*(.24+.22*(1-(1-u)**2));
  ctx.globalAlpha=.28*f;ctx.fillStyle='#fff3bd';ctx.beginPath();ctx.arc(0,0,c,0,TAU);ctx.fill()
  ring(ctx,c,Math.max(2,r*.055),.63*f,'#25394f')
  ring(ctx,c,Math.max(1,r*.026),.82*f,colors[0])
 }
 // Dark backing stroke + warm bright stroke provide contrast on both camera tones.
 const radius=r*(.61+.59*ease)
 ring(ctx,radius,Math.max(2,r*.056),opacity*.72,'#25394f')
 ring(ctx,radius,Math.max(1,r*.028),opacity*.80,colors[0])
 for(let i=0;i<8;i++){
  const dir=(i+(.14+pseudo(e.seed,i)*.26))*TAU/8
  const dist=r*(.57+(.53+.15*pseudo(e.seed,i+15))*ease)
  const dx=Math.cos(dir)*dist,dy=Math.sin(dir)*dist+r*.09*t*t
  const size=r*(.135+.035*pseudo(e.seed,i+40))*(1-.15*t)
  bStar(ctx,dx,dy,size,dir+.22*t,opacity*.95,B_COLORS[i%B_COLORS.length],r)
 }
}
export function drawV23Effect(ctx,e,reduced,{variant,baseDraw,role,getSprite}){
 if(e.kind==='shield'){baseDraw(ctx,e,reduced);return}
 const duration=reduced?Math.min(e.duration,LIMITS.reducedDuration):e.duration
 if(!Number.isFinite(e.age)||e.age<0||e.age>=duration)return
 const t=e.age/duration, r=e.r, opacity=intensity(e.age,duration), colors=PALETTES[role?.series]??DEFAULT
 ctx.save();ctx.translate(e.x,e.y);ctx.lineCap='round'
 // Reduced motion is a fixed-radius and fixed-orientation symbol. No expansions.
 if(reduced){const a=.75*(1-t);ring(ctx,.94*r,Math.max(1.4,r*.035),a,colors[0]);star(ctx,0,0,.20*r,Math.PI/4,a*.70,colors[1]);ctx.restore();return}
 if(variant==='A'){
  const ease=1-(1-t)**2
  ring(ctx,r*(.66+.68*ease),Math.max(1.5,r*.055),opacity*.76,colors[0])
  ring(ctx,r*(.42+.48*ease),Math.max(1.2,r*.037),opacity*.51,colors[2])
  // Six short, rounded radial rays; no solid or full-screen flash.
  for(let i=0;i<6;i++){
   const a=(i+(.15+.20*pseudo(e.seed,i)))*TAU/6,ri=r*(.62+.37*ease),ro=ri+r*.17*(1-.45*t)
   ctx.globalAlpha=opacity*.85;ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=Math.max(1.3,r*.050)
   ctx.beginPath();ctx.moveTo(Math.cos(a)*ri,Math.sin(a)*ri);ctx.lineTo(Math.cos(a)*ro,Math.sin(a)*ro);ctx.stroke()
  }
 }else if(variant==='B'){
  burstB(ctx,e,t,opacity,colors)
 }else if(variant==='C'){
  if(e.age<LIMITS.ghostDuration){
   // A small fading complete sprite, never a crop, body fragments or target.
   const image=getSprite?.(e.type)
   if(image){const u=e.age/LIMITS.ghostDuration;const s=r*(.93-.22*u)
    ctx.globalAlpha=.55*(1-u);ctx.drawImage(image,-s,-s,2*s,2*s)}
  }
  ring(ctx,r*(.62+.58*(1-(1-t)**2)),Math.max(1.4,r*.048),opacity*.68,colors[0])
  dots(ctx,e,t,opacity*.80,colors,6)
 }else throw new Error('Unknown visual candidate')
 ctx.restore()
}
