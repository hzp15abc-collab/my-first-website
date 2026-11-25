/* W4-B02 C — genuine CPU software 3D. No GPU/WebGL, 2D sprites, image backdrop,
   or pre-rendered video. This adapter transforms the same B00 indexed x/y/z meshes,
   clips against actual camera depth planes, perspective-projects triangles, shades
   world normals and resolves occlusion with perspective-correct reciprocal-depth
   per subpixel samples. A static scene cache is valid because the frozen camera/world
   are fixed; every dynamic mesh is transformed/clipped/rasterized anew each frame. */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const vecSub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normal=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d)};
const littleEndian=new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]===4;
const pack=(r,g,b)=>littleEndian?(0xff000000|(b<<16)|(g<<8)|r)>>>0:((r<<24)|(g<<16)|(b<<8)|255)>>>0;
const byte=(v,n)=>littleEndian?((v>>>(n*8))&255):((v>>>((3-n)*8))&255);
const rgb=(s)=>{const x=parseInt(s.replace('#',''),16);return [(x>>16)&255,(x>>8)&255,x&255]};
const linear=v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)};
const srgb=v=>{v=clamp(v,0,1);return Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055))};

export function makeCamera(manifest,w,h,sampleCount=2){
  const c=manifest.camera,totalW=w*sampleCount,totalH=h*sampleCount;
  const forward=normal(vecSub(c.target,c.position)),right=normal(cross(forward,[0,1,0])),up=normal(cross(right,forward));
  return {position:c.position,forward,right,up,near:c.near,far:c.far,width:totalW,height:totalH,centerX:totalW/2,centerY:totalH/2,focal:(totalH/2)/Math.tan(c.fov*Math.PI/360)};
}
// Euler XYZ matrix (equivalent to R_x R_y R_z, applied z/y/x to a column vector).
export function eulerXYZ([x,y,z]){
  const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
  return [c*e,-c*f,d,a*f+b*d*e,a*e-b*d*f,-b*c,b*f-a*d*e,b*e+a*d*f,a*c];
}
export function worldPoint(p,i,t,m){
  const x=p[i]*t.scale[0],y=p[i+1]*t.scale[1],z=p[i+2]*t.scale[2];
  return [m[0]*x+m[1]*y+m[2]*z+t.position[0],m[3]*x+m[4]*y+m[5]*z+t.position[1],m[6]*x+m[7]*y+m[8]*z+t.position[2]];
}
const toCamera=(p,c)=>{const q=vecSub(p,c.position);return [dot(q,c.right),dot(q,c.up),dot(q,c.forward)]};
export function clipDepth(poly,limit,keepGreater){
  if(!poly.length)return [];let out=[],a=poly[poly.length-1],insideA=keepGreater?a[2]>=limit:a[2]<=limit;
  for(const b of poly){const insideB=keepGreater?b[2]>=limit:b[2]<=limit;
    if(insideA!==insideB){const s=(limit-a[2])/(b[2]-a[2]);out.push([a[0]+s*(b[0]-a[0]),a[1]+s*(b[1]-a[1]),limit]);}
    if(insideB)out.push(b);a=b;insideA=insideB;
  }return out;
}
export const project=(q,c)=>[c.centerX+c.focal*q[0]/q[2],c.centerY-c.focal*q[1]/q[2],1/q[2]];
function lighting(manifest){const a=manifest.lights?.ambient??{color:'#ffffff',intensity:.8},d=manifest.lights?.directional??{color:'#ffffff',intensity:1,position:[5,12,8]};return {ambient:rgb(a.color).map(x=>linear(x)*a.intensity),sun:rgb(d.color).map(x=>linear(x)*d.intensity),dir:normal(d.position)};}
function shade(base,n,lights){const k=Math.max(0,dot(n,lights.dir));return pack(...base.map((v,i)=>srgb(v*(lights.ambient[i]+lights.sun[i]*k))));}
export function triangleBounds(tr,c){const minX=Math.max(0,Math.ceil(Math.min(tr.a[0],tr.b[0],tr.c[0])-.5)),maxX=Math.min(c.width-1,Math.floor(Math.max(tr.a[0],tr.b[0],tr.c[0])-.5)),minY=Math.max(0,Math.ceil(Math.min(tr.a[1],tr.b[1],tr.c[1])-.5)),maxY=Math.min(c.height-1,Math.floor(Math.max(tr.a[1],tr.b[1],tr.c[1])-.5));return minX<=maxX&&minY<=maxY?{x0:minX,y0:minY,x1:maxX+1,y1:maxY+1}:null;}
function union(a,b){return a&&b?{x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)}:a??b;}
function aligned(rect,samp,c){return rect?{x0:Math.max(0,Math.floor(rect.x0/samp)*samp),y0:Math.max(0,Math.floor(rect.y0/samp)*samp),x1:Math.min(c.width,Math.ceil(rect.x1/samp)*samp),y1:Math.min(c.height,Math.ceil(rect.y1/samp)*samp)}:null;}

function meshTriangles(spec,transform,c,light,base){
  const p=spec.geometry.positions,idx=spec.geometry.indices,m=eulerXYZ(transform.rotation),world=[],camera=[];
  for(let i=0;i<p.length;i+=3){const q=worldPoint(p,i,transform,m);world.push(q);camera.push(toCamera(q,c));}
  const tris=[];let rect=null,culled=0,clipped=0;
  for(let k=0;k<idx.length;k+=3){
    const i=idx[k],j=idx[k+1],l=idx[k+2],wa=world[i],wb=world[j],wc=world[l];
    const nn=cross(vecSub(wb,wa),vecSub(wc,wa));
    if(dot(nn,vecSub(c.position,wa))<=0){culled++;continue;}
    const color=shade(base,normal(nn),light);
    const ca=camera[i],cb=camera[j],cc=camera[l];let poly=[ca,cb,cc];
    if(ca[2]<c.near||cb[2]<c.near||cc[2]<c.near){poly=clipDepth(poly,c.near,true);clipped++;}
    if(poly.some(q=>q[2]>c.far)){poly=clipDepth(poly,c.far,false);clipped++;}
    if(poly.length<3)continue;
    const projected=poly.map(q=>project(q,c));
    for(let k=1;k<projected.length-1;k++){
      const tr={a:projected[0],b:projected[k],c:projected[k+1],color};const bounds=triangleBounds(tr,c);
      if(bounds){tr.bounds=bounds;rect=union(rect,bounds);tris.push(tr);}
    }
  }return {tris,rect,culled,clipped};
}

/* Perspective-correct per-sample depth. Reciprocal camera depth interpolates
 * linearly in screen barycentrics, so this is a true visibility buffer, not painter
 * ordering. A closer triangle wins over farther geometry independent of draw order. */
export function rasterizeTriangle(tr,depth,colors,width,height){
  let [ax,ay,az]=tr.a,[bx,by,bz]=tr.b,[cx,cy,cz]=tr.c;
  let area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  if(Math.abs(area)<1e-10)return;
  if(area<0){[bx,cx]=[cx,bx];[by,cy]=[cy,by];[bz,cz]=[cz,bz];area=-area;}
  const {x0,y0,x1,y1}=tr.bounds??triangleBounds(tr,{width,height});
  const w0x=by-cy,w0y=cx-bx,w1x=cy-ay,w1y=ax-cx,w2x=ay-by,w2y=bx-ax;
  const invArea=1/area,color=tr.color;
  const px=x0+.5,py=y0+.5;
  let e0=(cx-bx)*(py-by)-(cy-by)*(px-bx),e1=(ax-cx)*(py-cy)-(ay-cy)*(px-cx),e2=(bx-ax)*(py-ay)-(by-ay)*(px-ax);
  // Interpolate reciprocal depth incrementally over x and y. No Euclidean-distance approximation.
  let iz=(e0*az+e1*bz+e2*cz)*invArea;const ix=(w0x*az+w1x*bz+w2x*cz)*invArea,iy=(w0y*az+w1y*bz+w2y*cz)*invArea;
  for(let y=y0;y<y1;y++){
    let a=e0,b=e1,c=e2,q=iz,p=y*width+x0;
    for(let x=x0;x<x1;x++,p++){
      if(a>=-1e-6&&b>=-1e-6&&c>=-1e-6&&q>depth[p]){depth[p]=q;colors[p]=color;}
      a+=w0x;b+=w1x;c+=w2x;q+=ix;
    }
    e0+=w0y;e1+=w1y;e2+=w2y;iz+=iy;
  }
}

const baseTransform=spec=>({position:spec.position,rotation:spec.rotation??[0,0,0],scale:[1,1,1]});
const dynamic=spec=>spec.group==='cart'||spec.group==='avatar'||spec.dynamic==='course';

export function createAdapter(canvas,manifest,data,scale=1){
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:false});if(!ctx)throw new Error('Canvas2D unavailable');
  const sampleCount=manifest.settings?.antialias?2:1,lights=lighting(manifest);
  const entries=data.specs.map((spec,index)=>({spec,index,base:rgb(spec.color).map(linear),transform:baseTransform(spec)}));
  const fixed=entries.filter(q=>!dynamic(q.spec)),moving=entries.filter(q=>dynamic(q.spec));
  let c,w,h,staticDepth,staticColors,workDepth,workColors,picture,pixels,previous=null,disposed=false,last={},staticStats={};
  function downsample(rect){
    if(!rect)return;const s=sampleCount,sw=c.width;
    const x0=rect.x0/s,y0=rect.y0/s,x1=rect.x1/s,y1=rect.y1/s;
    if(s===1){for(let y=y0;y<y1;y++){const a=y*w+x0,b=y*w+x1;pixels.set(workColors.subarray(a,b),a);}return;}
    for(let y=y0;y<y1;y++){let src=(y*2)*sw+x0*2,dst=y*w+x0;
      for(let x=x0;x<x1;x++,src+=2,dst++){
        const a=workColors[src],b=workColors[src+1],cc=workColors[src+sw],d=workColors[src+sw+1];
        if(a===b&&a===cc&&a===d){pixels[dst]=a;continue}
        pixels[dst]=pack((byte(a,0)+byte(b,0)+byte(cc,0)+byte(d,0)+2)>>2,(byte(a,1)+byte(b,1)+byte(cc,1)+byte(d,1)+2)>>2,(byte(a,2)+byte(b,2)+byte(cc,2)+byte(d,2)+2)>>2);
      }
    }
  }
  function output(rect){if(rect){const s=sampleCount;downsample(rect);ctx.putImageData(picture,0,0,rect.x0/s,rect.y0/s,(rect.x1-rect.x0)/s,(rect.y1-rect.y0)/s);}}
  function rebuild(s){
    if(disposed)throw new Error('renderer disposed');const start=performance.now();
    w=Math.round(manifest.width*s);h=Math.round(manifest.height*s);canvas.width=w;canvas.height=h;
    c=makeCamera(manifest,w,h,sampleCount);const n=c.width*c.height;
    const bg=pack(...rgb(manifest.clearColor));staticDepth=new Float32Array(n);staticColors=new Uint32Array(n);staticColors.fill(bg);
    workDepth=new Float32Array(n);workColors=new Uint32Array(n);picture=ctx.createImageData(w,h);pixels=new Uint32Array(picture.data.buffer);
    let count=0,culled=0,clipped=0;for(const entry of fixed){const q=meshTriangles(entry.spec,entry.transform,c,lights,entry.base);count+=q.tris.length;culled+=q.culled;clipped+=q.clipped;for(const t of q.tris)rasterizeTriangle(t,staticDepth,staticColors,c.width,c.height);}
    workDepth.set(staticDepth);workColors.set(staticColors);previous=null;
    output({x0:0,y0:0,x1:c.width,y1:c.height});staticStats={fixedObjects:fixed.length,visibleTriangles:count,culled,clipped,initMs:performance.now()-start};
    last={movingObjects:moving.length,triangles:staticStats.visibleTriangles,dirtyPixels:w*h,dynamicVisibleTriangles:0};
  }
  function render(transforms=[]){
    if(disposed)throw new Error('renderer disposed');let current=null,culled=0,clipped=0,triangles=[];
    const map=new Map(transforms.map(t=>[t.index,t]));
    for(const entry of moving){const q=meshTriangles(entry.spec,map.get(entry.index)??entry.transform,c,lights,entry.base);current=union(current,q.rect);culled+=q.culled;clipped+=q.clipped;triangles.push(...q.tris);}
    const dirty=aligned(union(previous,current),sampleCount,c);
    if(dirty){
      for(let y=dirty.y0;y<dirty.y1;y++){const x=y*c.width+dirty.x0,n=y*c.width+dirty.x1;workDepth.set(staticDepth.subarray(x,n),x);workColors.set(staticColors.subarray(x,n),x);}
      for(const tr of triangles)rasterizeTriangle(tr,workDepth,workColors,c.width,c.height);
      output(dirty);
    }
    previous=current;last={movingObjects:moving.length,triangles:staticStats.visibleTriangles+triangles.length,dynamicVisibleTriangles:triangles.length,dynamicCulled:culled,dynamicClipped:clipped,dirtyPixels:dirty?(dirty.x1-dirty.x0)*(dirty.y1-dirty.y0)/(sampleCount*sampleCount):0};
  }
  function info(){return {width:w,height:h,dpr:1,drawCalls:null,triangles:last.triangles,geometry:data.counts.geometries,meshCount:data.counts.objects,totalSubmittedTriangles:data.counts.triangles,backend:'Canvas2D genuine CPU 3D depth rasterizer',sampleCount:sampleCount*sampleCount,depthResolution:[c?.width??0,c?.height??0],bufferBytes:(staticDepth?.byteLength??0)+(staticColors?.byteLength??0)+(workDepth?.byteLength??0)+(workColors?.byteLength??0)+(picture?.data.byteLength??0),static:staticStats,...last};}
  function dispose(){if(disposed)return;disposed=true;staticDepth=staticColors=workDepth=workColors=picture=pixels=previous=c=null;canvas.width=1;canvas.height=1;}
  rebuild(scale);
  return {engine:'cpu3d',version:'w4-c1',context:ctx,canvas,render,resize:rebuild,info,dispose};
}
