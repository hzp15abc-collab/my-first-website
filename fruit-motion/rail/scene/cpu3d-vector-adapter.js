/* W4-B02-C-R2: native vector rasterization of genuine 3D geometry. The expensive
 * exact static world/depth raster from C-R1 is retained once at cache creation.
 * Every moving mesh is newly transformed, near/far clipped, perspective projected,
 * face-lit, depth-sorted and filled as native Canvas2D triangles per frame. This
 * candidate uses an approximate painter ordering for dynamic triangles; limitations
 * are checked against the prior exact z-buffer and disclosed, not hidden as 2.5D. */
import {makeCamera,eulerXYZ,worldPoint,clipDepth,project,createAdapter as createExactRaster} from './cpu3d-adapter.js';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=v=>{const d=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/d,v[1]/d,v[2]/d]};
const endian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
const pack=(r,g,b)=>endian?(0xff000000|(b<<16)|(g<<8)|r)>>>0:((r<<24)|(g<<16)|(b<<8)|255)>>>0;
const unpack=v=>endian?[v&255,(v>>>8)&255,(v>>>16)&255]:[(v>>>24)&255,(v>>>16)&255,(v>>>8)&255];
const rgb=s=>{const x=parseInt(s.replace('#',''),16);return [(x>>16)&255,(x>>8)&255,x&255]};
const linear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const srgb=v=>{v=clamp(v,0,1);return Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055))};
const lightData=m=>{const a=m.lights?.ambient??{color:'#ffffff',intensity:.8},d=m.lights?.directional??{color:'#ffffff',intensity:1,position:[5,12,8]};return{ambient:rgb(a.color).map(v=>linear(v)*a.intensity),sun:rgb(d.color).map(v=>linear(v)*d.intensity),dir:norm(d.position)}};
function shade(base,n,light){const f=Math.max(0,dot(n,light.dir));return pack(...base.map((v,i)=>srgb(v*(light.ambient[i]+light.sun[i]*f))))}
const defaultTransform=spec=>({position:spec.position,rotation:spec.rotation??[0,0,0],scale:[1,1,1]});
const cameraPoint=(p,c)=>{const v=sub(p,c.position);return [dot(v,c.right),dot(v,c.up),dot(v,c.forward)]};
export const isMoving=spec=>spec.group==='cart'||spec.group==='avatar'||spec.dynamic==='course';
export function createProjector(manifest,data,w,h){
  const camera=makeCamera(manifest,w,h,1),light=lightData(manifest),entries=data.specs.map((spec,index)=>({spec,index,base:rgb(spec.color).map(linear),t:defaultTransform(spec)}));
  function allTriangles(transforms=[],selection='moving'){
    const list=[],map=new Map(transforms.map(q=>[q.index,q]));let culled=0,clipped=0;
    for(const e of entries){const {spec}=e;if(selection==='moving'&&!isMoving(spec)||selection==='fixed'&&isMoving(spec))continue;
      const supplied=map.get(e.index);if(supplied?.active===false)continue;const t=supplied??e.t,m=eulerXYZ(t.rotation),g=spec.geometry,world=[],view=[];
      for(let i=0;i<g.positions.length;i+=3){const p=worldPoint(g.positions,i,t,m);world.push(p);view.push(cameraPoint(p,camera));}
      for(let k=0;k<g.indices.length;k+=3){const i=g.indices[k],j=g.indices[k+1],l=g.indices[k+2],wa=world[i],wb=world[j],wc=world[l],n=cross(sub(wb,wa),sub(wc,wa));
        if(dot(n,sub(camera.position,wa))<=0){culled++;continue;}
        const color=shade(e.base,norm(n),light);let poly=[view[i],view[j],view[l]];
        if(poly.some(q=>q[2]<camera.near)){poly=clipDepth(poly,camera.near,true);clipped++;}
        if(poly.some(q=>q[2]>camera.far)){poly=clipDepth(poly,camera.far,false);clipped++;}
        if(poly.length<3)continue;const p=poly.map(v=>project(v,camera));
        for(let q=1;q<p.length-1;q++){const a=p[0],b=p[q],c=p[q+1];if(Math.max(a[0],b[0],c[0])<0||Math.min(a[0],b[0],c[0])>camera.width||Math.max(a[1],b[1],c[1])<0||Math.min(a[1],b[1],c[1])>camera.height)continue;
          // Mean true camera depth, far first. This is intentionally approximate
          // for intersecting geometry; exact C-R1 comparison quantifies deviations.
          const depth=(1/a[2]+1/b[2]+1/c[2])/3;list.push({a,b,c,color,depth,id:spec.id,meshIndex:e.index,sourceTriangle:k/3});
        }
      }
    }return{triangles:list,culled,clipped};
  }
  return{camera,allTriangles};
}

/* Refine average-depth painter order using *actual* projected overlap and reciprocal
 * depths. Small faces of the same convex mesh mostly do not overlap (skip zero-area
 * intersections). A tile index bounds pair checks. If two non-coplanar surfaces
 * intersect within one projected overlap there is no single painter order; disclose
 * crossing pairs/cycle breaks and retain deterministic far-to-near fallback. */
function screenFacts(t){
  const a=t.a,b=t.b,c=t.c,dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],area=dx*ey-dy*ex;
  if(Math.abs(area)<1e-9)return null;
  const u=((b[2]-a[2])*ey-(c[2]-a[2])*dy)/area,v=(dx*(c[2]-a[2])-ex*(b[2]-a[2]))/area;
  return {loX:Math.min(a[0],b[0],c[0]),hiX:Math.max(a[0],b[0],c[0]),loY:Math.min(a[1],b[1],c[1]),hiY:Math.max(a[1],b[1],c[1]),u,v,w:a[2]-u*a[0]-v*a[1],area};
}
function intersection(a,b,sign){
  let poly=[a.a,a.b,a.c];const edges=[b.a,b.b,b.c];
  for(let e=0;e<3;e++){
    const from=edges[e],to=edges[(e+1)%3],dx=to[0]-from[0],dy=to[1]-from[1];
    const d=p=>sign*(dx*(p[1]-from[1])-dy*(p[0]-from[0]));
    if(!poly.length)return null;
    let prev=poly[poly.length-1],dp=d(prev),out=[];
    for(const v of poly){const dv=d(v),pIn=dp>=-1e-9,vIn=dv>=-1e-9;if(pIn!==vIn){const t=dp/(dp-dv);out.push([prev[0]+t*(v[0]-prev[0]),prev[1]+t*(v[1]-prev[1])]);}if(vIn)out.push(v);prev=v;dp=dv;}
    poly=out;
  }
  return poly.length>=3?poly:null;
}
export function orderedTriangles(input,width,height){
  const triangles=[...input].sort((a,b)=>b.depth-a.depth||a.meshIndex-b.meshIndex||a.sourceTriangle-b.sourceTriangle),n=triangles.length;
  const facts=triangles.map(screenFacts),tile=32,nx=Math.ceil(width/tile),ny=Math.ceil(height/tile),bins=Array.from({length:nx*ny},()=>[]),adj=Array.from({length:n},()=>[]),indegree=new Int32Array(n),seen=new Set();
  let compared=0,edges=0,crossing=0;
  for(let i=0;i<n;i++){
    const f=facts[i];if(!f)continue;
    const x0=clamp(Math.floor(f.loX/tile),0,nx-1),x1=clamp(Math.floor(f.hiX/tile),0,nx-1),y0=clamp(Math.floor(f.loY/tile),0,ny-1),y1=clamp(Math.floor(f.hiY/tile),0,ny-1);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const b=bins[y*nx+x];
      for(const j of b){
        const q=facts[j];if(triangles[i].meshIndex===triangles[j].meshIndex)continue; // convex frozen primitives
        if(Math.min(f.hiX,q.hiX)-Math.max(f.loX,q.loX)<.15||Math.min(f.hiY,q.hiY)-Math.max(f.loY,q.loY)<.15)continue;
        const key=i*n+j;if(seen.has(key))continue;seen.add(key);compared++;
        const poly=intersection(triangles[i],triangles[j],Math.sign(q.area));if(!poly)continue;
        let area=0,lo=Infinity,hi=-Infinity;
        for(let k=0;k<poly.length;k++){const p=poly[k],r=poly[(k+1)%poly.length];area+=p[0]*r[1]-p[1]*r[0];const z=(f.u-q.u)*p[0]+(f.v-q.v)*p[1]+f.w-q.w;lo=Math.min(lo,z);hi=Math.max(hi,z);}
        if(Math.abs(area)<.3)continue;let before,after;
        if(lo>=-1e-6&&hi>1e-6){before=j;after=i;}else if(hi<=1e-6&&lo< -1e-6){before=i;after=j;}else{if(lo< -1e-6&&hi>1e-6)crossing++;continue;}
        adj[before].push(after);indegree[after]++;edges++;
      }
      b.push(i);
    }
  }
  // Stable topological sort using binary heap by original far-to-near rank, O(E log n).
  const heap=[],used=new Uint8Array(n),out=[];
  const push=x=>{let i=heap.length;heap.push(x);while(i>0){const p=(i-1)>>1;if(heap[p]<=x)break;heap[i]=heap[p];i=p;}heap[i]=x;};
  const pop=()=>{const v=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1]<heap[j])j++;if(heap[j]>=last)break;heap[i]=heap[j];i=j;}heap[i]=last;}return v;};
  for(let i=0;i<n;i++)if(indegree[i]===0)push(i);let cycleBreaks=0;
  while(out.length<n){
    while(heap.length&&used[heap[0]])pop();let i;
    if(heap.length)i=pop();else{i=used.indexOf(0);if(i<0)break;cycleBreaks++;}
    if(used[i])continue;used[i]=1;out.push(triangles[i]);for(const j of adj[i])if(!used[j]&&--indegree[j]===0)push(j);
  }
  return {triangles:out,compared,edges,crossing,cycleBreaks};
}

export function createAdapter(canvas,manifest,data,scale=1){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas2D unavailable');
  let w,h,background=null,projector=null,disposed=false,staticInfo={},last={},colorCache=new Map();
  const movingCount=data.specs.filter(isMoving).length;
  function cssColor(packed){let v=colorCache.get(packed);if(v===undefined){v=`rgb(${unpack(packed).join(',')})`;colorCache.set(packed,v);}return v;}
  function rebuild(s){
    if(disposed)throw new Error('renderer disposed');const started=performance.now();
    w=Math.round(manifest.width*s);h=Math.round(manifest.height*s);canvas.width=w;canvas.height=h;
    // The exact fixed world image is generated from real 3D meshes once,
    // not a supplied bitmap. Copy it to a native compositing surface, then release
    // C-R1's large static/working depth buffers. Camera and world are frozen.
    if(background){background.width=1;background.height=1;}
    const temporary=document.createElement('canvas'),exact=createExactRaster(temporary,manifest,data,s);staticInfo=exact.info().static;
    background=document.createElement('canvas');background.width=w;background.height=h;
    background.getContext('2d',{alpha:false}).drawImage(temporary,0,0);exact.dispose();
    projector=createProjector(manifest,data,w,h);ctx.drawImage(background,0,0);
    staticInfo={...staticInfo,cacheInitMs:performance.now()-started,method:'once-only exact static z-buffer raster from original 3D meshes'};
    last={dynamicVisibleTriangles:0,dynamicCulled:0,dynamicClipped:0,nativeFillBatches:0};
  }
  function render(transforms=[]){
    if(disposed)throw new Error('renderer disposed');
    const q=projector.allTriangles(transforms,'moving'),ordering=orderedTriangles(q.triangles,w,h),triangles=ordering.triangles;
    ctx.drawImage(background,0,0);
    // Native antialias enabled by Canvas rasterizer. Batch contiguous same-color
    // triangles only, retaining draw order across different-depth/material faces.
    let i=0,batches=0;
    while(i<triangles.length){const color=triangles[i].color;ctx.fillStyle=cssColor(color);ctx.beginPath();
      do{const {a,b,c}=triangles[i++];ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c[0],c[1]);ctx.closePath();}while(i<triangles.length&&triangles[i].color===color);
      ctx.fill();batches++;
    }
    last={dynamicVisibleTriangles:triangles.length,dynamicCulled:q.culled,dynamicClipped:q.clipped,nativeFillBatches:batches,ordering:{comparedPairs:ordering.compared,depthEdges:ordering.edges,crossingPairs:ordering.crossing,cycleBreaks:ordering.cycleBreaks}};
  }
  function info(){return {width:w,height:h,dpr:1,drawCalls:last.nativeFillBatches+1,triangles:(staticInfo.visibleTriangles??0)+last.dynamicVisibleTriangles,geometry:data.counts.geometries,meshCount:data.counts.objects,totalSubmittedTriangles:data.counts.triangles,backend:'Canvas2D native vector projection of true CPU 3D',dynamicVisibility:'projected-overlap and true reciprocal-depth constrained triangle painter order (approximate crossings disclosed); static backdrop exact depth',antialias:'native Canvas2D coverage AA; cached static exact 4 sample/pixel',static:staticInfo,movingObjects:movingCount,...last};}
  function dispose(){if(disposed)return;disposed=true;if(background){background.width=1;background.height=1;}background=null;projector=null;colorCache.clear();canvas.width=1;canvas.height=1;}
  rebuild(scale);return{engine:'cpu3d-vector',version:'w4-c2',context:ctx,canvas,render,resize:rebuild,info,dispose};
}
