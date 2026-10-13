
(()=>{
'use strict';
window.__flatBoot.stage='loading-photos';
// Characters use crops of the supplied photographs, compressed as WebP for the web.
// No face generation, retouching, color tint, or geometric deformation is applied.
const PHOTO_HERO='./hero.webp';
const PHOTO_ENEMY='./enemy.webp';
const $=id=>document.getElementById(id), app=$('app'), canvas=$('world'), ctx=canvas.getContext('2d',{alpha:false}), poster=$('poster'), pc=poster.getContext('2d');
const imgHero=new Image(),imgEnemy=new Image();
imgHero.src=PHOTO_HERO;imgEnemy.src=PHOTO_ENEMY;
$('hero-chip').src=PHOTO_HERO;$('enemy-chip').src=PHOTO_ENEMY;$('result-photo').src=PHOTO_HERO;
const storage={get(k,d){try{return localStorage.getItem(k)??d}catch{return d}},set(k,v){try{localStorage.setItem(k,String(v))}catch{}}};
let high=Math.max(0,Number(storage.get('soulpilot.best.v1','0'))||0);
let soundEnabled=storage.get('soulpilot.sound.v1','1')!=='0';
let difficulty='normal',mode='menu',W=420,H=840,dpr=1,lastFrame=0,visualTime=0,lastHud=-1,toastTimer=0,loaded=false,runBossOnly=false;
const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CFG={easy:{hp:6,speed:.72,spawn:1.05,shot:.82,bullet:.78,label:'6 格护盾 · 温柔弹幕'},normal:{hp:4,speed:1,spawn:.86,shot:1,bullet:1,label:'4 格护盾 · 标准弹幕'},hard:{hp:3,speed:1.25,spawn:.68,shot:1.24,bullet:1.22,label:'3 格护盾 · 加速弹幕'}};
const C={cyan:'#70f5ee',purple:'#bca7ff',pink:'#f3a6d2',gold:'#efcf86',blue:'#79bcff',ink:'#0a152b'};
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist2=(a,b)=>{const x=a.x-b.x,y=a.y-b.y;return x*x+y*y};
const pad=n=>Math.floor(n).toString().padStart(6,'0'),clock=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
const soundOnSVG='<svg viewBox="0 0 24 24"><path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
const soundOffSVG='<svg viewBox="0 0 24 24"><path d="m11 4-6 5H2v6h3l6 5zM16 9l5 6m0-6-5 6"/></svg>';
const heartSVG=empty=>'<svg class="'+(empty?'empty':'')+'" viewBox="0 0 24 24"><path d="M12 21 3.2 12.5C-2.2 7.1 5.5-.3 12 6.2 18.5-.3 26.2 7.1 20.8 12.5Z"/></svg>';
// Local synthesized sounds. Cached buffers keep repeated "diu" inexpensive on phones.
class GameAudio{
 constructor(){this.ctx=null;this.master=null;this.buffers={};this.sources=new Set();this.lastHit=0;this.failed=false;}
 async unlock(){
  if(!soundEnabled)return;
  try{if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('AudioContext not available');this.ctx=new AC();this.master=this.ctx.createGain();this.master.gain.value=.52;const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=15;limiter.ratio.value=4;this.master.connect(limiter);limiter.connect(this.ctx.destination);this.makeBuffers();}
   if(this.ctx.state==='suspended')await this.ctx.resume();
  }catch(e){this.failed=true;soundEnabled=false;updateSound();toast('当前打开环境不支持声音，游戏仍可继续');}
 }
 makeBuffers(){
  const sr=this.ctx.sampleRate;
  for(const [name,duration] of [['diu',.18],['hit',.08],['boom',.42]]){
   const b=this.ctx.createBuffer(1,Math.ceil(sr*duration),sr),a=b.getChannelData(0);let p=0,p2=0;
   for(let i=0;i<a.length;i++){const t=i/sr,u=t/duration,env=Math.min(1,t/.004)*Math.pow(1-u,name==='boom'?1.8:2.2);
    if(name==='diu'){const f=230+1100*Math.exp(-t*23);p+=f/sr;p2+=(160+200*Math.exp(-t*16))/sr;const plosive=t<.011?(Math.random()*2-1)*.08*(1-t/.011):0;a[i]=(Math.sin(p*Math.PI*2)*.33+Math.sin(p2*Math.PI*2)*.09+Math.sin(p*Math.PI*4)*.055+plosive)*env;}
    else if(name==='hit'){p+=(600-350*u)/sr;a[i]=(Math.sin(2*Math.PI*p)*.11+(Math.random()*2-1)*.15)*env;}
    else{p+=(160-100*u)/sr;a[i]=(Math.sin(2*Math.PI*p)*.33+(Math.random()*2-1)*.17)*env;}
   }this.buffers[name]=b;
  }
 }
 play(name,vol=1,rate=1){if(!soundEnabled||!this.ctx||this.ctx.state!=='running'||!this.buffers[name])return;try{const s=this.ctx.createBufferSource(),gain=this.ctx.createGain();s.buffer=this.buffers[name];s.playbackRate.value=rate;gain.gain.value=vol;s.connect(gain);gain.connect(this.master);this.sources.add(s);s.onended=()=>{this.sources.delete(s);s.disconnect();gain.disconnect();};s.start();}catch{}}
 tone(freq,duration=.12,vol=.08,delay=0){if(!soundEnabled||!this.ctx||this.ctx.state!=='running')return;try{const o=this.ctx.createOscillator(),v=this.ctx.createGain(),t=this.ctx.currentTime+delay;o.type='sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.86,t+duration);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(vol,t+.01);v.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(v);v.connect(this.master);o.start(t);o.stop(t+duration+.01);this.sources.add(o);o.onended=()=>{this.sources.delete(o);o.disconnect();v.disconnect();};}catch{}}
 pickup(){this.tone(660,.16,.09);this.tone(880,.16,.09,.075);this.tone(1100,.2,.08,.15);}
 hit(){if(!this.ctx||this.ctx.currentTime-this.lastHit<.075)return;this.lastHit=this.ctx.currentTime;this.play('hit',.3,rand(.9,1.15));}
 stop(){for(const s of this.sources){try{s.stop()}catch{}}this.sources.clear();}
}
const audio=new GameAudio();
function updateSound(){document.querySelectorAll('.sound-control').forEach(b=>{b.innerHTML=soundEnabled?soundOnSVG:soundOffSVG;b.setAttribute('aria-label',soundEnabled?'关闭声音':'开启声音');b.setAttribute('aria-pressed',String(soundEnabled));});storage.set('soulpilot.sound.v1',soundEnabled?'1':'0');}
updateSound();$('menu-best').textContent=pad(high);
const stars=Array.from({length:88},()=>({x:Math.random()*420,y:Math.random()*1500,z:rand(.25,1),r:rand(.45,1.35)}));
let g=null,drag=null,keys=new Set();
function freshGame(){const c=CFG[difficulty];return{t:0,score:0,kills:0,wave:1,combo:0,lastKill:-10,maxCombo:0,spawn:.7,formation:9,bossDue:runBossOnly?1.3:60,boss:null,bossWins:0,fire:0,diuText:0,shake:0,nova:2,novaCooldown:0,player:{x:W/2,y:H-157,tx:W/2,ty:H-157,r:12,hp:c.hp,maxHp:c.hp,level:1,inv:2,shield:0},enemies:[],bullets:[],shots:[],particles:[],drops:[],texts:[],rings:[],victoryAt:0,overPending:false};}
function toast(text,time=2300){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),time);}
function hidePanels(){['pause-screen','over-screen','help'].forEach(id=>$(id).hidden=true);}
function startGame(bossOnly=false){if(!loaded)return;runBossOnly=bossOnly;audio.unlock().then(()=>{if(mode==='playing'){audio.tone(500,.12,.07);audio.tone(750,.16,.06,.1);}});audio.stop();g=freshGame();mode='playing';lastHud=-1;keys.clear();drag=null;hidePanels();$('menu').hidden=true;$('hud').hidden=false;$('dock').hidden=false;updateHud(true);toast(bossOnly?'巨无霸南沙仔，准备应战！':'灵魂头出击！按住屏幕拖动',2800);}
function pauseGame(){if(mode!=='playing')return;mode='paused';drag=null;keys.clear();audio.stop();$('pause-screen').hidden=false;$('toast').classList.remove('show');}
function resumeGame(){if(mode!=='paused')return;audio.unlock();mode='playing';lastFrame=performance.now();$('pause-screen').hidden=true;}
function goHome(){mode='menu';audio.stop();keys.clear();drag=null;hidePanels();$('hud').hidden=true;$('dock').hidden=true;$('menu').hidden=false;$('menu-best').textContent=pad(high);$('toast').classList.remove('show');}
function endGame(won=false){if(mode!=='playing')return;mode='over';audio.stop();drag=null;keys.clear();hidePanels();const old=high;high=Math.max(high,g.score);storage.set('soulpilot.best.v1',high);$('result-title').textContent=won?'南沙仔 Boss，拿下！':'歇一阵，再起飞。';$('result-tag').textContent=won?'BOSS CLEARED / 挑战完成':'MISSION REPORT / 本局战报';$('result-score').textContent=pad(g.score);$('record-label').textContent=g.score>old?'✦ 新纪录！灵魂头有料到。':'最高纪录 · '+pad(high);$('result-caption').textContent=won?'这次轮到南沙仔：得啦得啦，唔好再 Diu。':'南沙仔有备而来，灵魂头下次再 Diu。';$('result-kills').textContent=g.kills;$('result-time').textContent=clock(g.t);$('result-wave').textContent=g.wave;$('over-screen').hidden=false;$('toast').classList.remove('show');if(won)audio.pickup();else{audio.tone(290,.2,.07);audio.tone(190,.3,.07,.18);}}
function updateHud(force=false){if(!g)return;if(!force&&Math.floor(g.t*10)===lastHud)return;lastHud=Math.floor(g.t*10);$('score').textContent=pad(g.score);const p=g.player;$('hearts').innerHTML=Array.from({length:p.maxHp},(_,i)=>heartSVG(i>=p.hp)).join('');$('hearts').setAttribute('aria-label',`护盾 ${p.hp}/${p.maxHp}`);$('wave').textContent=`第 ${String(g.wave).padStart(2,'0')} 波 · ${clock(g.t)}`;$('nova-count').textContent=g.nova;$('nova').style.opacity=g.nova>0?'1':'.5';$('nova').setAttribute('aria-label',`爆发清屏，剩余 ${g.nova} 次`);const names=['','双线火力','三向连射','五路齐发','满级火力'];$('weapon').textContent=`LV.${p.level} · ${names[p.level]}`;$('drag-hint').textContent=p.shield>0?'S 护罩 · '+Math.ceil(p.shield)+' 秒':g.t<12?'按住任意位置拖动':g.combo>=3?`${g.combo} 连击 · ×${multiplier()} 得分`:'躲开弹幕，捡 W 升级';$('boss-hud').hidden=!g.boss;if(g.boss){const v=Math.max(0,Math.ceil(g.boss.hp/g.boss.maxHp*100));$('boss-fill').style.width=v+'%';$('boss-percent').textContent=v+'%';}}
function multiplier(){return Math.min(5,1+Math.floor(g.combo/7));}
function floatText(x,y,text,color=C.cyan,size=15){g.texts.push({x,y,text,color,size,life:.85,max:.85,vy:-36});if(g.texts.length>28)g.texts.shift();}
function sparks(x,y,color,n=12,big=false){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),v=rand(28,big?220:140);g.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.25,.6),max:.6,r:rand(1.5,big?4:3),color});}if(g.particles.length>260)g.particles.splice(0,g.particles.length-260);}
function ring(x,y,color,max=65,life=.38){g.rings.push({x,y,color,r:5,max,life,start:life});}
function spawnEnemy(type,x,y=-62){const waveScale=1+Math.min(1.3,(g.wave-1)*.11),c=CFG[difficulty];const base={scout:{hp:3,v:72,r:26,score:80,c:C.blue},armor:{hp:9,v:45,r:34,score:180,c:C.purple},spinner:{hp:5,v:65,r:29,score:140,c:C.pink},twin:{hp:7,v:60,r:32,score:200,c:C.gold}}[type];const e={type,x:x??rand(48,W-48),y,baseX:0,v:base.v*c.speed*(1+Math.min(.55,(g.wave-1)*.035)),r:base.r,hp:Math.ceil(base.hp*waveScale),maxHp:Math.ceil(base.hp*waveScale),score:base.score,c:base.c,phase:rand(0,6.28),age:0,fire:rand(1.9,3.4)/c.shot,hit:0,dead:false};e.baseX=e.x;g.enemies.push(e);return e;}
function spawnBoss(){if(g.boss)return;const hp=Math.round((runBossOnly?150:205+g.bossWins*85)*(difficulty==='easy'?.78:difficulty==='hard'?1.15:1));const e={type:'boss',x:W/2,y:-130,r:73,hp,maxHp:hp,score:3000,c:C.purple,age:0,phase:0,fire:1.8,hit:0,dead:false,phaseTwo:false};g.boss=e;g.enemies.push(e);g.shots=[];toast('⚠ 南沙仔 · 巨无霸 登场',3000);audio.tone(260,.25,.08);audio.tone(390,.3,.08,.3);}
function enemyShot(e,vx,vy,r=5,color=C.pink){if(g.shots.length>150)return;g.shots.push({x:e.x,y:e.y+(e.type==='boss'?68:28),vx,vy,r,color,age:0});}
function shootEnemy(e){if(e.y<95||e.y>H-150)return;const c=CFG[difficulty],speed=(e.type==='boss'?150:122)*c.bullet*(1+Math.min(.5,g.wave*.035));let a=Math.atan2(g.player.y-e.y,g.player.x-e.x);if(e.type==='boss'){if(e.phaseTwo&&Math.random()<.5){for(let i=0;i<11;i++){const a0=.16+(Math.PI-.32)*(i/10);enemyShot(e,Math.cos(a0)*speed,Math.sin(a0)*speed,5,C.purple);}}else{for(let i=-2;i<=2;i++){const b=a+i*.19;enemyShot(e,Math.cos(b)*speed,Math.sin(b)*speed,5,C.pink);}}e.fire=(e.phaseTwo?.75:1.2)/c.shot;}else if(e.type==='spinner'){for(let i=-1;i<=1;i++){const b=a+i*.32;enemyShot(e,Math.cos(b)*speed,Math.sin(b)*speed,4.5,C.pink);}e.fire=2.6/c.shot;}else if(e.type==='armor'){for(let i=-1;i<=1;i++){const b=a+i*.18;enemyShot(e,Math.cos(b)*speed,Math.sin(b)*speed,5,C.purple);}e.fire=3/c.shot;}else{enemyShot(e,Math.cos(a)*speed,Math.sin(a)*speed,4.5,e.c);e.fire=3.1/c.shot;}}
function playerFire(){const p=g.player,l=p.level;let pattern=l===1?[-.025,.025]:l===2?[-.1,0,.1]:[-.2,-.09,0,.09,.2];for(let i=0;i<pattern.length;i++){const angle=pattern[i],dx=l===1?(i===0?-11:11):angle*48;g.bullets.push({x:p.x+dx,y:p.y-47,vx:Math.sin(angle)*720,vy:-Math.cos(angle)*760,r:l===4?5:4,damage:l===4?1.55:1,c:l===4?C.gold:C.cyan});}audio.play('diu',.72,rand(.96,1.06));if(g.diuText<=0){floatText(p.x+31,p.y-55,'diu!',C.cyan,12);g.diuText=g.t<5?.7:2.7;}g.fire=l===4?.13:.185;}
function killEnemy(e){if(e.dead)return;e.dead=true;g.kills++;g.combo=g.t-g.lastKill<3?g.combo+1:1;g.lastKill=g.t;g.maxCombo=Math.max(g.maxCombo,g.combo);const points=e.score*multiplier();g.score+=points;sparks(e.x,e.y,e.c,e.type==='boss'?65:16,e.type==='boss');ring(e.x,e.y,e.c,e.type==='boss'?190:67,e.type==='boss'?.9:.38);floatText(e.x,e.y,'+'+points,e.c,e.type==='boss'?25:14);audio.play('boom',e.type==='boss'?.9:.26,e.type==='boss'?.8:1.8);g.shake=e.type==='boss'?.6:.09;
 if(e.type==='boss'){g.boss=null;g.bossWins++;g.bossDue=g.t+60;g.nova=Math.min(3,g.nova+1);g.shots=[];g.player.hp=Math.min(g.player.maxHp,g.player.hp+1);if(runBossOnly){g.victoryAt=g.t+1.7;toast('南沙仔：得啦，唔好再 Diu！',2500);}else{toast('Boss 击退！护盾 +1 · 爆发 +1');spawnDrop(e.x,e.y,'W');spawnDrop(e.x-45,e.y+20,'S');}}
 else{if(g.kills%5===0)spawnDrop(e.x,e.y,g.player.level<4?'W':g.player.hp<g.player.maxHp?'+':'S');else if(Math.random()<.11)spawnDrop(e.x,e.y,Math.random()<.55?'+':'S');if(g.combo===10||g.combo===20||g.combo===35)toast(`${g.combo} 连击！灵魂头开始上头了`,1600);}
}
function spawnDrop(x,y,type){g.drops.push({x,y,type,life:9,age:0});}
function collectDrop(d){d.life=0;const p=g.player;if(d.type==='W'){if(p.level<4){p.level++;toast('火力升级！LV.'+p.level,1500);}else{g.score+=250;floatText(p.x,p.y-60,'火力奖励 +250',C.gold);}audio.pickup();}else if(d.type==='+'){if(p.hp<p.maxHp){p.hp++;floatText(p.x,p.y-65,'护盾 +1',C.cyan);}else{g.score+=150;floatText(p.x,p.y-65,'满盾奖励 +150',C.cyan);}audio.pickup();}else{p.shield=7;floatText(p.x,p.y-65,'无敌护罩 7s',C.blue);audio.pickup();}ring(p.x,p.y,C.cyan,70);}
function hurtPlayer(){const p=g.player;if(p.inv>0||p.shield>0||g.overPending||g.victoryAt)return;p.hp--;p.inv=2.1;g.combo=0;g.shake=.34;sparks(p.x,p.y,C.cyan,22);ring(p.x,p.y,C.cyan,95,.5);audio.play('boom',.6,1.05);if(p.hp<=0){g.overPending=true;g.deathAt=g.t+.45;floatText(p.x,p.y-70,'护盾耗尽',C.pink,18);}else{floatText(p.x,p.y-65,'护盾 -1',C.pink,15);g.shots=g.shots.filter(b=>dist2(b,p)>110*110);}updateHud(true);}
function nova(){if(mode!=='playing'||g.overPending)return;if(g.nova<=0){toast('爆发用完了，击退 Boss 可补充',1700);return;}if(g.novaCooldown>0)return;g.nova--;g.novaCooldown=.8;g.player.inv=Math.max(g.player.inv,1.5);g.shots=[];g.shake=.25;ring(g.player.x,g.player.y,C.purple,Math.max(H,W)*1.25,.85);ring(g.player.x,g.player.y,C.cyan,Math.max(H,W)*1.1,1);audio.play('boom',.7,.75);audio.tone(340,.3,.1);for(const e of [...g.enemies]){if(e.dead)continue;e.hp-=e.type==='boss'?42:35;e.hit=.15;if(e.hp<=0)killEnemy(e);else sparks(e.x,e.y,e.c,8);}toast('灵魂爆发！弹幕清空',1300);updateHud(true);}
function update(dt){if(!g)return;g.t+=dt;g.shake=Math.max(0,g.shake-dt);g.novaCooldown-=dt;g.diuText-=dt;g.fire-=dt;const p=g.player;p.inv=Math.max(0,p.inv-dt);p.shield=Math.max(0,p.shield-dt);if(g.t-g.lastKill>3.2)g.combo=0;
 const wave=1+Math.floor(g.t/20);if(wave!==g.wave){g.wave=wave;if(!g.boss)toast(`第 ${wave} 波 · 南沙仔继续加班`,1800);}
 let kx=0,ky=0;if(keys.has('ArrowLeft')||keys.has('a'))kx--;if(keys.has('ArrowRight')||keys.has('d'))kx++;if(keys.has('ArrowUp')||keys.has('w'))ky--;if(keys.has('ArrowDown')||keys.has('s'))ky++;if(kx||ky){const norm=Math.hypot(kx,ky);p.tx+=kx/norm*350*dt;p.ty+=ky/norm*350*dt;}
 p.tx=clamp(p.tx,37,W-37);p.ty=clamp(p.ty,155,H-115);const smoothing=1-Math.exp(-22*dt);p.x+=(p.tx-p.x)*smoothing;p.y+=(p.ty-p.y)*smoothing;const hitbox={x:p.x,y:p.y+31,r:p.r};
 if(!g.overPending&&!g.victoryAt&&g.fire<=0)playerFire();
 if(!g.victoryAt){if(g.t>=g.bossDue&&!g.boss)spawnBoss();g.spawn-=dt;g.formation-=dt;const allowMobs=!runBossOnly||g.t>9;if(g.spawn<=0&&allowMobs){if(g.enemies.length<21){const n=Math.random(),type=g.t<8?'scout':n<.42?'scout':n<.69?'armor':n<.87?'spinner':'twin';spawnEnemy(type);}g.spawn=Math.max(.39,CFG[difficulty].spawn-(g.wave-1)*.036)*(g.boss?2.2:1);}
 if(g.formation<=0&&!g.boss){const n=g.wave>2?4:3;for(let i=0;i<n;i++)spawnEnemy('scout',65+i*(W-130)/(n-1),-65-i*30);g.formation=13;}}
 for(const b of g.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;}for(const b of g.shots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.age+=dt;}
 for(const e of g.enemies){if(e.dead)continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);if(e.type==='boss'){const targetY=260;e.y+=(targetY-e.y)*(1-Math.exp(-1.4*dt));e.x=W/2+Math.sin(e.age*.8)*100;if(e.hp<e.maxHp*.45&&!e.phaseTwo){e.phaseTwo=true;toast('南沙仔暴走！弹幕升级',1900);}}
  else{e.y+=e.v*dt;const amp=e.type==='spinner'?44:e.type==='twin'?32:14;e.x=clamp(e.baseX+Math.sin(e.age*1.55+e.phase)*amp,36,W-36);}
  e.fire-=dt;if(e.fire<=0&&!g.overPending&&!g.victoryAt)shootEnemy(e);
  if(!g.overPending&&dist2(e,hitbox)<(e.r+p.r)*(e.r+p.r)){hurtPlayer();if(e.type!=='boss'&&p.inv>0){e.hp-=3;if(e.hp<=0)killEnemy(e);}}
 }
 // All bullets are recycled after hits or after leaving the field.
 for(const b of g.bullets){if(b.dead)continue;for(const e of g.enemies){if(e.dead||e.y<-70)continue;const hx=(b.x-e.x)/(e.r+b.r),hy=(b.y-e.y)/(e.r*1.17+b.r);if(hx*hx+hy*hy<1){b.dead=true;e.hp-=b.damage;e.hit=.075;sparks(b.x,b.y,b.c,2);audio.hit();if(e.hp<=0)killEnemy(e);break;}}}
 for(const b of g.shots){if(!b.dead&&dist2(b,hitbox)<(b.r+p.r)*(b.r+p.r)){b.dead=true;if(p.shield>0){sparks(b.x,b.y,C.blue,4);}else hurtPlayer();}}
 for(const d of g.drops){d.age+=dt;d.life-=dt;d.y+=76*dt;const ds=dist2(d,p);if(ds<110*110){d.x+=(p.x-d.x)*(1-Math.exp(-7*dt));d.y+=(p.y-d.y)*(1-Math.exp(-7*dt));}if(dist2(d,p)<35*35&&d.life>0)collectDrop(d);}
 for(const a of g.particles){a.x+=a.vx*dt;a.y+=a.vy*dt;a.vx*=Math.exp(-2.5*dt);a.vy*=Math.exp(-2.5*dt);a.life-=dt;}for(const a of g.texts){a.y+=a.vy*dt;a.life-=dt;}for(const r of g.rings){r.life-=dt;r.r=5+(r.max-5)*(1-Math.pow(Math.max(0,r.life/r.start),2));}
 g.enemies=g.enemies.filter(e=>!e.dead&&e.y<H+100);g.bullets=g.bullets.filter(b=>!b.dead&&b.y>-40&&b.x>-25&&b.x<W+25);g.shots=g.shots.filter(b=>!b.dead&&b.y<H+30&&b.y>-80&&b.x>-40&&b.x<W+40&&b.age<15);g.drops=g.drops.filter(d=>d.life>0&&d.y<H+30);g.particles=g.particles.filter(a=>a.life>0);g.texts=g.texts.filter(a=>a.life>0);g.rings=g.rings.filter(a=>a.life>0);
 updateHud();if(g.overPending&&g.t>=g.deathAt)endGame(false);else if(g.victoryAt&&g.t>=g.victoryAt)endGame(true);
}
function poly(c,points,fill,stroke=null,width=1){c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function ellipse(c,x,y,rx,ry,fill,stroke=null,width=1){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
function face(c,image,x,y,rx,ry){if(!image.complete||!image.naturalWidth)return;c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.clip();const scale=Math.max(2*rx/image.naturalWidth,2*ry/image.naturalHeight),ww=image.naturalWidth*scale,hh=image.naturalHeight*scale;c.drawImage(image,x-ww/2,y-hh/2,ww,hh);c.restore();}
function playerDraw(c,x,y,t,scale=1,shield=false,inv=false){c.save();c.translate(x,y);c.scale(scale,scale);if(inv)c.globalAlpha=.7+.3*Math.sin(t*17)**2;
 const jet=13+(reduced?5:Math.sin(t*28)*5);poly(c,[[-17,27],[-10,55+jet],[-4,28]],'#55eddd44');poly(c,[[4,28],[10,55+jet],[17,27]],'#55eddd44');poly(c,[[-14,29],[-10,45+jet*.6],[-7,29]],C.cyan);poly(c,[[7,29],[10,45+jet*.6],[14,29]],C.cyan);
 if(shield){ellipse(c,0,0,58,67,'#6babff0d','#87c2ff77',2);ellipse(c,0,0,64,73,null,'#87c2ff22',1);}
 poly(c,[[-17,-29],[-34,-7],[-48,29],[-22,21],[-17,36],[17,36],[22,21],[48,29],[34,-7],[17,-29]],'#162e42','#82dcd5',1.35);
 poly(c,[[-23,-10],[-42,23],[-23,14]],'#244f63','#4ca49f',1);poly(c,[[23,-10],[42,23],[23,14]],'#244f63','#4ca49f',1);
 poly(c,[[-38,10],[-33,8],[-28,30],[-33,32]],'#89f9e7');poly(c,[[38,10],[33,8],[28,30],[33,32]],'#89f9e7');
 ellipse(c,0,-14,29,39,'#0b1a2b','#a0ede0',2);face(c,imgHero,0,-14,25.8,35);ellipse(c,0,-14,26.5,35.7,null,'#b7ebe766',1);
 poly(c,[[-18,20],[0,30],[18,20],[13,36],[-13,36]],'#23424f','#8ac7c3',1);ellipse(c,0,32,3.3,3.3,C.cyan);
 c.fillStyle=C.cyan;c.fillRect(-36,-11,4,12);c.fillRect(32,-11,4,12);c.restore();}
function enemyDraw(c,e,t,scale=1){c.save();c.translate(e.x,e.y);c.scale(scale,scale);const type=e.type,color=e.hit>0?'#eef5ff':e.c||C.blue;
 if(type==='boss'){
  ellipse(c,0,20,92,54,'#100f2966',e.phaseTwo?'#eca4d080':'#bca7ff44',1);poly(c,[[-42,-35],[-88,-6],[-96,50],[-69,34],[-48,49],[48,49],[69,34],[96,50],[88,-6],[42,-35]],'#252642',color,1.8);
  for(const s of [-1,1]){poly(c,[[s*54,-12],[s*80,2],[s*77,26],[s*55,18]],'#424064','#a794db',1);ellipse(c,s*77,40,7,7,e.phaseTwo?C.pink:C.purple);c.fillStyle='#aa9fe733';c.fillRect(s*69-5,39,10,31);}
  ellipse(c,0,-1,53,68,'#11152b','#d8c7ff',2.4);face(c,imgEnemy,0,-1,47,61);ellipse(c,0,-1,48,62,null,'#cab5ff88',1);
  poly(c,[[-34,-61],[-38,-82],[-17,-72],[0,-91],[17,-72],[38,-82],[34,-61]],'#74533c',C.gold,1.8);ellipse(c,0,-73,4,4,C.gold);
  poly(c,[[-34,51],[0,65],[34,51],[26,76],[-26,76]],'#333153',C.purple,1.4);c.fillStyle=C.purple;c.font='bold 10px sans-serif';c.textAlign='center';c.fillText('南沙仔',0,75);
 }else{
  if(type==='spinner'){c.save();c.rotate(t*1.6+e.phase);for(let i=0;i<4;i++){c.rotate(Math.PI/2);poly(c,[[22,-7],[43,-14],[42,3],[23,12]],'#46263f',color,1.2);}ellipse(c,0,0,40,40,null,'#ed9fcc44',1);c.restore();}
  else if(type==='armor'){poly(c,[[-25,-25],[-42,-10],[-42,27],[-25,35],[25,35],[42,27],[42,-10],[25,-25]],'#302d4e',color,1.4);for(const s of [-1,1]){poly(c,[[s*25,-18],[s*35,-9],[s*35,15],[s*25,23]],'#615279','#ae93e1',.7);c.fillStyle=color;c.fillRect(s*33-3,26,6,11);}}
  else if(type==='twin'){poly(c,[[-25,-15],[-45,-9],[-48,20],[-22,30],[22,30],[48,20],[45,-9],[25,-15]],'#473b2f',color,1.2);for(const s of [-1,1]){ellipse(c,s*34,4,11,17,'#2b2736',color,1.2);face(c,imgEnemy,s*34,4,8.8,13);}}
  else{poly(c,[[-21,-18],[-38,13],[-28,26],[-15,19],[15,19],[28,26],[38,13],[21,-18]],'#233248',color,1.2);for(const s of [-1,1]){poly(c,[[s*25,12],[s*31,18],[s*23,28]],color);}}
  const rx=type==='armor'?24:22,ry=type==='armor'?31:29;ellipse(c,0,-2,rx+3,ry+4,'#121a2b',color,1.7);face(c,imgEnemy,0,-2,rx,ry);ellipse(c,0,-2,rx+.5,ry+.5,null,'#dce5ff44',.8);
  poly(c,[[-15,24],[0,32],[15,24],[10,38],[-10,38]],'#263244',color,.8);ellipse(c,0,31,2.8,2.8,color);
  if(e.hp!==undefined&&e.hp<e.maxHp){c.fillStyle='#7882a133';c.fillRect(-20,-43,40,3);c.fillStyle=e.c;c.fillRect(-20,-43,40*Math.max(0,e.hp/e.maxHp),3);}
 }
 c.restore();}
function drawBackground(t){ctx.fillStyle='#080d1e';ctx.fillRect(0,0,W,H);const grad=ctx.createRadialGradient(W*.15,H*.18,0,W*.25,H*.25,W*.95);grad.addColorStop(0,'#17284970');grad.addColorStop(.7,'#0a193033');grad.addColorStop(1,'#0a193000');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);const grad2=ctx.createRadialGradient(W*.93,H*.57,0,W*.93,H*.57,W*.85);grad2.addColorStop(0,'#36254f40');grad2.addColorStop(1,'#1c122d00');ctx.fillStyle=grad2;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#55739a10';ctx.lineWidth=1;const grid=56,off=(t*13)%grid;ctx.beginPath();for(let x=14;x<W;x+=grid){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=off;y<H;y+=grid){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();
 for(const s of stars){const y=(s.y+t*(12+s.z*28))%(H+12);ctx.globalAlpha=.2+s.z*.5;ctx.fillStyle=s.z>.7?'#b6d2e8':'#6c8bb3';ctx.fillRect(s.x,y,s.r,s.r*(s.z>.85?2.6:1));}ctx.globalAlpha=1;
 // Quiet edge markers make the arena readable without obscuring the photographs.
 ctx.strokeStyle='#90b2d721';ctx.lineWidth=1;for(const yy of [H*.28,H*.55,H*.76]){ctx.beginPath();ctx.moveTo(8,yy);ctx.lineTo(8,yy+20);ctx.moveTo(W-8,yy);ctx.lineTo(W-8,yy+20);ctx.stroke();}}
function drawWorld(){const t=g&&mode!=='menu'?g.t:visualTime;drawBackground(t);if(!g||mode==='menu')return;ctx.save();if(g.shake>0&&!reduced){const amt=g.shake*7;ctx.translate(rand(-amt,amt),rand(-amt,amt));}
 for(const b of g.bullets){ctx.strokeStyle=b.c;ctx.lineWidth=b.r;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(b.x,b.y+12);ctx.lineTo(b.x+b.vx*.013,b.y-6);ctx.stroke();ctx.strokeStyle='#e1fff1';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(b.x,b.y+9);ctx.lineTo(b.x,b.y-4);ctx.stroke();}
 for(const e of g.enemies)if(!e.dead)enemyDraw(ctx,e,t);
 for(const d of g.drops){const col=d.type==='W'?C.gold:d.type==='S'?C.blue:C.cyan;ctx.save();ctx.translate(d.x,d.y);const bob=reduced?0:Math.sin(d.age*5)*3;ctx.translate(0,bob);poly(ctx,[[-14,-12],[10,-14],[15,-7],[14,11],[-10,14],[-15,7]],'#152840',col,1.4);ctx.fillStyle=col;ctx.font='bold 16px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.type,0,1);ctx.restore();}
 for(const b of g.shots){ellipse(ctx,b.x,b.y,b.r+3,b.r+3,b.color+'22');ellipse(ctx,b.x,b.y,b.r,b.r,b.color);ellipse(ctx,b.x-.7,b.y-.7,1.5,1.5,'#f4eafa');}
 if(!g.overPending)playerDraw(ctx,g.player.x,g.player.y,t,1,g.player.shield>0,g.player.inv>0);
 for(const r of g.rings){ctx.globalAlpha=Math.max(0,r.life/r.start);ellipse(ctx,r.x,r.y,r.r,r.r,null,r.color,r.max>200?3:1.5);}ctx.globalAlpha=1;
 for(const a of g.particles){ctx.globalAlpha=clamp(a.life/a.max,0,1);ctx.fillStyle=a.color;ctx.fillRect(a.x-a.r/2,a.y-a.r/2,a.r,a.r);}ctx.globalAlpha=1;
 for(const f of g.texts){ctx.globalAlpha=Math.min(1,f.life/.25);ctx.fillStyle=f.color;ctx.font=`700 ${f.size}px -apple-system, sans-serif`;ctx.textAlign='center';ctx.fillText(f.text,clamp(f.x,45,W-45),f.y);}ctx.globalAlpha=1;
 // Show the small vulnerable center during invincibility/shield, rather than tinting faces.
 if(!g.overPending&&(g.player.shield>0||g.player.inv>0)){ellipse(ctx,g.player.x,g.player.y+31,4,4,'#dbfff3','#0c2437',1);}
 ctx.restore();}
function drawPoster(t){if(!loaded)return;pc.clearRect(0,0,840,540);pc.save();pc.scale(2,2);const tt=reduced?0:t;
 // Original faces stay upright. Only surrounding armor/rotors vary.
 const a={type:'armor',x:73,y:80+Math.sin(tt*.8)*6,c:C.purple,phase:0};enemyDraw(pc,a,tt,.92);
 const b={type:'spinner',x:337,y:92+Math.cos(tt)*7,c:C.pink,phase:0};enemyDraw(pc,b,tt,.83);
 const c={type:'twin',x:315,y:199+Math.sin(tt)*4,c:C.gold,phase:0};enemyDraw(pc,c,tt,.52);
 pc.save();pc.globalAlpha=.45;for(let i=0;i<4;i++){const y=118-((tt*65+i*35)%110);pc.strokeStyle=C.cyan;pc.lineWidth=2.5;pc.lineCap='round';pc.beginPath();pc.moveTo(199,y);pc.lineTo(199,y+12);pc.moveTo(221,y);pc.lineTo(221,y+12);pc.stroke();}pc.restore();
 playerDraw(pc,210,161+Math.sin(tt*1.4)*5,tt,1.72,false,false);
 pc.fillStyle='#879fbd';pc.font='10px sans-serif';pc.textAlign='center';pc.fillText('装甲南沙仔',73,139);pc.fillText('旋风南沙仔',337,145);pc.fillStyle='#b1a8c0';pc.font='9px sans-serif';pc.fillText('双子形态',315,237);
 pc.restore();}
function resize(){const r=app.getBoundingClientRect(),oldH=H;H=r.height/r.width*W;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);if(g){const delta=H-oldH;g.player.y=clamp(g.player.y+delta,155,H-115);g.player.ty=clamp(g.player.ty+delta,155,H-115);}drawPoster(visualTime);}
function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
canvas.addEventListener('pointerdown',e=>{if(mode!=='playing'||g.overPending)return;e.preventDefault();const pos=pointerPos(e);drag={id:e.pointerId,x:pos.x,y:pos.y,px:g.player.tx,py:g.player.ty};try{canvas.setPointerCapture(e.pointerId)}catch{}});
canvas.addEventListener('pointermove',e=>{if(mode!=='playing'||!drag||drag.id!==e.pointerId)return;e.preventDefault();const pos=pointerPos(e);g.player.tx=clamp(drag.px+pos.x-drag.x,37,W-37);g.player.ty=clamp(drag.py+pos.y-drag.y,155,H-115);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(drag&&drag.id===e.pointerId)drag=null;});
window.addEventListener('keydown',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Escape'].includes(key))e.preventDefault();if(e.repeat&&[' ','p','Escape'].includes(key))return;if(key==='p'||key==='Escape'){if(!$('help').hidden){$('help').hidden=true;return;}mode==='playing'?pauseGame():mode==='paused'?resumeGame():null;}else if(key===' '){if(mode==='playing')nova();else if(mode==='menu')startGame(false);}else keys.add(key);});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')pauseGame();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pauseGame();lastFrame=performance.now();});window.addEventListener('resize',resize);if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);
$('start').addEventListener('click',()=>startGame(false));$('boss-start').addEventListener('click',()=>startGame(true));$('pause').addEventListener('click',pauseGame);$('resume').addEventListener('click',resumeGame);$('nova').addEventListener('click',nova);$('retry').addEventListener('click',()=>startGame(runBossOnly));$('restart-pause').addEventListener('click',()=>startGame(runBossOnly));$('home-pause').addEventListener('click',goHome);$('home-over').addEventListener('click',goHome);$('help-open').addEventListener('click',()=>{$('help').hidden=false;});$('help-close').addEventListener('click',()=>{$('help').hidden=true;});
document.querySelectorAll('[data-diff]').forEach(b=>b.addEventListener('click',()=>{difficulty=b.dataset.diff;document.querySelectorAll('[data-diff]').forEach(bb=>{const active=bb===b;bb.classList.toggle('active',active);bb.setAttribute('aria-pressed',String(active));});$('difficulty-note').textContent=CFG[difficulty].label;}));
document.querySelectorAll('.sound-control').forEach(b=>b.addEventListener('click',()=>{soundEnabled=!soundEnabled;if(soundEnabled)audio.unlock().then(()=>audio.tone(660,.12,.07));else audio.stop();updateSound();}));
function frame(now){const dt=lastFrame?Math.min((now-lastFrame)/1000,.035):.016;lastFrame=now;if(!document.hidden){visualTime+=dt;if(mode==='playing')update(dt);drawWorld();if(mode==='menu')drawPoster(visualTime);}requestAnimationFrame(frame);}
// Do not depend solely on img.decode(): onload + cached-image checks also work.
function waitForPhoto(image, name) {
 return new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => finish(new Error(name + '读取超时')), 8000);
  const onLoad = () => finish(image.naturalWidth > 0 ? null : new Error(name + '无有效像素'));
  const onError = () => finish(new Error(name + '解码失败或完整文件未加载'));
  function finish(error) {
   if (settled) return;
   settled = true; clearTimeout(timer);
   image.removeEventListener('load', onLoad); image.removeEventListener('error', onError);
   if (error) reject(error); else resolve();
  }
  image.addEventListener('load', onLoad); image.addEventListener('error', onError);
  if (image.complete) { if (image.naturalWidth > 0) finish(); else onError(); }
 });
}
async function ready() {
 try {
  await Promise.all([waitForPhoto(imgHero,'灵魂头照片'), waitForPhoto(imgEnemy,'南沙仔照片')]);
  loaded=true; resize(); drawPoster(0);
  $('start').disabled=false; $('boss-start').disabled=false; $('start-label').textContent='开始打飞机';
  window.__flatBoot.complete();
 } catch (error) {
  loaded=false; $('start').disabled=true; $('boss-start').disabled=true;
  $('start-label').textContent='启动失败 · 请查看提示';
  window.__flatBoot.fail('角色照片未能读取。请在 Safari 中打开正式网页，而不是附件预览。', String(error.message || error));
 }
}
resize();requestAnimationFrame(frame);ready();
// Read-only diagnostics, useful when testing the self-contained file locally.
Object.defineProperty(window,'__soulPilot',{value:{snapshot:()=>({mode,difficulty,width:W,height:H,loaded,score:g?.score||0,kills:g?.kills||0,hp:g?.player.hp,level:g?.player.level,novas:g?.nova,time:g?.t||0,enemies:g?.enemies.length||0,shots:g?.shots.length||0,bullets:g?.bullets.length||0,bossHP:g?.boss?.hp??null,audioState:audio.ctx?.state||'not-started',soundEnabled,heroNatural:[imgHero.naturalWidth,imgHero.naturalHeight],enemyNatural:[imgEnemy.naturalWidth,imgEnemy.naturalHeight]}),audioStats:()=>Object.fromEntries(Object.entries(audio.buffers).map(([k,b])=>{const a=b.getChannelData(0);let sum=0,peak=0;for(const v of a){sum+=v*v;peak=Math.max(peak,Math.abs(v));}return[k,{duration:b.duration,rms:Math.sqrt(sum/a.length),peak}];}))},writable:false});
})();
