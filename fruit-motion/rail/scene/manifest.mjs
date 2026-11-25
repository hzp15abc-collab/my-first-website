/* Original procedural forest artwork for the private G1b validation prototype.
 * Based on this game's own B00 geometry only. No third-party image, font or mesh. */
import base from './base-scene.mjs';
const layers = {pine:['#3e8052','#467e4e','#578e53','#4d965f'],leaf:['#83af61','#9ac36d','#699d59','#5e9b72'],flower:['#f5d977','#e9a7a3','#f2f4c4','#c2b5e7']};
const laneCenters=[-2.7,0,2.7];
const seeded=(seed=20261125)=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
export const MAX_OBJECTS=10;
export function createSceneManifest(){
  const random=seeded(),meshes=[];
  const add=(id,shape,position,dimensions,color,group='world',rotation=[0,0,0],dynamic)=>{const entry={id,shape,position,dimensions,color,group,rotation};if(dynamic)entry.dynamic=dynamic;meshes.push(entry);return meshes.length-1;};
  const filtered=base.meshes.filter(m=>m.dynamic!=='course');
  for(const raw of filtered){const m={...raw,position:[...raw.position],dimensions:[...raw.dimensions],rotation:[...(raw.rotation??[0,0,0])]};
    if(m.id==='grass')m.color='#789b5b';
    if(m.id.startsWith('road_'))m.color='#b99c6e';
    if(m.id.startsWith('tie_'))m.color='#805d3b';
    if(m.id==='cart_deck')m.color='#cba167';
    if(m.id==='body')m.color='#e9bb66';
    if(m.id.startsWith('cart_edge'))m.color='#277f7a';
    // A short run of near sleepers moves under the cart; distant sleepers remain
    // static. The visual movement follows only the app's valid elapsed clock.
    if(m.id.startsWith('tie_')&&m.position[2]>-19){m.dynamic='course';m.dimensions[0]=1.22;}
    meshes.push(m);
  }
  // Original near/far forest forms derived from simple solid meshes, outside the
  // three playable lanes. No additional scenery blocks the player's safe route.
  for(const side of [-1,1]){
    for(let i=0;i<9;i++){
      const x=side*(8.7+random()*4.5),z=-6-i*7.0-random()*2.5,h=2.4+random()*1.8,r=.16+random()*.16;
      add(`tree-extra-${side}-${i}-trunk`,'cylinder',[x,h/2,z],[r*.75,r,h,8],'#83613d');
      const rr=1.15+random()*.65;add(`tree-extra-${side}-${i}-leaf1`,'sphere',[x,h,z],[rr,10,7],layers.leaf[i%layers.leaf.length]);
      add(`tree-extra-${side}-${i}-leaf2`,'sphere',[x+side*.58,h+.18,z-.32],[rr*.72,9,6],layers.leaf[(i+1)%layers.leaf.length]);
    }
    for(let i=0;i<10;i++){
      const x=side*(5.3+random()*2.8),z=2.0-i*5.8-random()*2;
      add(`fern-${side}-${i}`,'cone',[x,.34,z],[.38,.62,7],layers.pine[i%4]);
      add(`rock-${side}-${i}`,'sphere',[x+side*.65,.19,z-1.35],[.26+random()*.27,7,5],'#b3b9a3');
      if(i%2===0){add(`flower-${side}-${i}-stem`,'cylinder',[x-side*.35,.14,z-.45],[.018,.025,.28,6],'#567d49');
        add(`flower-${side}-${i}-petal`,'sphere',[x-side*.35,.33,z-.45],[.115,7,5],layers.flower[i%4]);}
    }
    for(let i=0;i<4;i++){
      const x=side*(15+i*3.5),z=-48-i*4.3,r=4+i*.9;
      add(`distant-hill-${side}-${i}`,'sphere',[x,1.3+i*.2,z],[r,12,7],['#8db9a3','#a4c7ab','#90b49c','#84ae99'][i]);
    }
  }
  // Friendly distant waterfall/stream and stone formation; positioned far outside
  // playable tracks. They are actual solid 3D meshes, not an imported art layer.
  add('pond','box',[-12.7,.02,-36.4],[7.0,.065,11.5],'#63b8b7');
  add('fall-rock-a','sphere',[-13.4,2.05,-43.2],[2.1,9,6],'#9eab96');
  add('fall-rock-b','sphere',[-11.8,1.72,-43.8],[1.65,9,6],'#819782');
  add('fall-water','box',[-12.35,2.1,-40.95],[1.2,4.15,.16],'#b4e2db');
  add('fall-water-highlight','box',[-12.6,2.06,-40.83],[.27,4.07,.09],'#e3f7e9');
  for(let i=0;i<3;i++)add(`water-foam-${i}`,'sphere',[-12.8+i*.48,.12,-40.24],[.3,7,5],'#e0eee1');
  // Soft cloud solids at distance, original geometry.
  for(let i=0;i<4;i++){
    const x=-12+i*8.2,z=-61-i*3,y=8.7+(i%2)*1.4;
    for(let q=0;q<3;q++)add(`cloud-${i}-${q}`,'sphere',[x+q*1.35,y+(q===1?.4:0),z],[1.18,9,6],'#edf3dd');
  }
  // Standing explorer's identity is deliberately generic and original: scarf/pack,
  // no face resemblance or branded costume. All pieces share the actual pose.
  add('pack','box',[0,1.26,.19],[.32,.39,.19],'#966c47','avatar');
  add('pack-flap','box',[0,1.39,.30],[.32,.115,.045],'#ba8b56','avatar');
  add('scarf','box',[0,1.52,.045],[.44,.115,.27],'#4c9b87','avatar');
  add('scarf-tail','box',[.26,1.37,.075],[.10,.24,.075],'#4c9b87','avatar',[0,0,-.22]);
  add('hat-brim','cylinder',[0,1.75,.007],[.295,.295,.045,14],'#387e78','avatar');
  add('cart-bumper','box',[0,.52,.63],[1.5,.15,.12],'#277f7a','cart');
  add('cart-tip','box',[0,.52,-.61],[1.5,.15,.12],'#277f7a','cart');
  add('cart-trim','box',[0,.45,.69],[.74,.09,.04],'#e6cc83','cart');

  // Fixed hidden slots, not generated per frame. Scene state selects which forms
  // are active, retaining a bounded runtime cost regardless of user input.
  for(let slot=0;slot<MAX_OBJECTS;slot++){
    const prefix=`obj-${slot}-`;
    add(prefix+'block','box',[0,.52,0],[1.96,1.04,.69],'#e88536','world',[0,0,0],'course');
    add(prefix+'stripe-l','box',[-.52,.62,.36],[.18,.78,.035],'#fff0bd','world',[0,0,-.38],'course');
    add(prefix+'stripe-r','box',[.52,.62,.36],[.18,.78,.035],'#fff0bd','world',[0,0,-.38],'course');
    add(prefix+'post-l','box',[-.91,.84,0],[.15,1.68,.20],'#6b9980','world',[0,0,0],'course');
    add(prefix+'post-r','box',[.91,.84,0],[.15,1.68,.20],'#6b9980','world',[0,0,0],'course');
    add(prefix+'bar','box',[0,1.64,0],[2.04,.20,.28],'#e0af5a','world',[0,0,0],'course');
    add(prefix+'star','star',[0,2.18,0],[.43,.16],'#f6cc45','world',[0,0,0],'course');
  }
  // One safe lane: two low green 3D chevrons. They are hidden unless game state
  // asks to highlight the unique safe lane; never duplicate that direction.
  for(let i=0;i<2;i++)for(const side of [-1,1])add(`guide-${i}-${side}`,'box',[side*.27,.16,-4-i*3.3],[.8,.025,.17],'#a6df68','world',[0,side*.57,0],'course');
  for(let i=0;i<3;i++)add(`reward-${i}`,'star',[(i-1)*.48,2.53+(.12*(i===1)),.07],[.125,.07],'#e8c74e','world',[0,0,i*.4],'course');

  const indices=new Map(meshes.map((m,i)=>[m.id,i]));
  return {manifest:{...base,clearColor:'#d5ebd9',lights:{ambient:{color:'#fffbe8',intensity:.64},directional:{color:'#fff1d0',intensity:1.05,position:[-8,12,6]}},meshes,meshCount:meshes.length},indices,laneCenters:[...laneCenters]};
}
