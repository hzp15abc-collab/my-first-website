/* Engine-independent geometry. All candidates receive identical triangle/normal data. */
const TAU = Math.PI*2;
const norm = (x,y,z)=>{const d=Math.hypot(x,y,z)||1;return [x/d,y/d,z/d]};
export function buildGeometry(shape,dims){
  const p=[], n=[], idx=[];
  const add=(a,b)=>{let i=p.length/3;p.push(...a);n.push(...b);return i};
  const tri=(a,b,c)=>{
    const u=[p[3*b]-p[3*a],p[3*b+1]-p[3*a+1],p[3*b+2]-p[3*a+2]],v=[p[3*c]-p[3*a],p[3*c+1]-p[3*a+1],p[3*c+2]-p[3*a+2]];
    const nx=u[1]*v[2]-u[2]*v[1],ny=u[2]*v[0]-u[0]*v[2],nz=u[0]*v[1]-u[1]*v[0];
    const normalDot=nx*(n[3*a]+n[3*b]+n[3*c])+ny*(n[3*a+1]+n[3*b+1]+n[3*c+1])+nz*(n[3*a+2]+n[3*b+2]+n[3*c+2]);
    idx.push(a,normalDot>=0?b:c,normalDot>=0?c:b);
  };
  const quad=(a,b,c,d)=>{tri(a,b,c);tri(a,c,d)};
  if(shape==='box'){
    const [x,y,z]=dims.map(v=>v/2);
    for(const [q,normal] of [
      [[[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]],[0,0,1]],
      [[[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]],[0,0,-1]],
      [[[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]],[1,0,0]],
      [[[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]],[-1,0,0]],
      [[[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]],[0,1,0]],
      [[[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]],[0,-1,0]],
    ]) quad(...q.map(v=>add(v,normal)));
  }else if(shape==='sphere'){
    const [r,hSeg=12,vSeg=8]=dims, rows=[];
    for(let y=0;y<=vSeg;y++){
      const t=Math.PI*y/vSeg,row=[];
      for(let x=0;x<=hSeg;x++){
        const p0=TAU*x/hSeg, q=[Math.sin(t)*Math.cos(p0),Math.cos(t),Math.sin(t)*Math.sin(p0)];
        row.push(add(q.map(v=>v*r),q));
      }
      rows.push(row);
    }
    for(let y=0;y<vSeg;y++)for(let x=0;x<hSeg;x++){
      if(y!==0)tri(rows[y][x],rows[y][x+1],rows[y+1][x+1]);
      if(y!==vSeg-1)tri(rows[y][x],rows[y+1][x+1],rows[y+1][x]);
    }
  }else if(shape==='cylinder'||shape==='cone'){
    const [rt,rb,h,segs=12]=shape==='cone'?[0,dims[0],dims[1],dims[2]??12]:dims;
    const top=[],bottom=[];
    for(let i=0;i<=segs;i++){
      let a=i*TAU/segs,c=Math.cos(a),s=Math.sin(a),nn=norm(c,(rb-rt)/h,s);
      top.push(add([rt*c,h/2,rt*s],nn));bottom.push(add([rb*c,-h/2,rb*s],nn));
    }
    for(let i=0;i<segs;i++){
      if(rt)tri(bottom[i],top[i],top[i+1]);
      if(rb)tri(bottom[i],top[i+1],bottom[i+1]);
    }
    for(const [r,yy,ny] of [[rt,h/2,1],[rb,-h/2,-1]]){
      if(!r)continue;
      let center=add([0,yy,0],[0,ny,0]),ring=[];
      for(let i=0;i<=segs;i++){let a=i*TAU/segs;ring.push(add([r*Math.cos(a),yy,r*Math.sin(a)],[0,ny,0]));}
      for(let i=0;i<segs;i++)tri(center,ring[i],ring[i+1]);
    }
  }else if(shape==='star'){
    // Original extruded five-point reward, real 3D vertices and side faces.
    const [r,depth=.12]=dims,outline=[];
    for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2===0?r:r*.48;outline.push([Math.cos(a)*rr,Math.sin(a)*rr]);}
    for(const side of [1,-1]){
      const z=side*depth/2,nn=[0,0,side],center=add([0,0,z],nn),ring=outline.map(([x,y])=>add([x,y,z],nn));
      for(let i=0;i<10;i++)tri(center,ring[i],ring[(i+1)%10]);
    }
    for(let i=0;i<10;i++){
      const a=outline[i],b=outline[(i+1)%10],nn=norm(b[1]-a[1],a[0]-b[0],0);
      quad(add([a[0],a[1],-depth/2],nn),add([b[0],b[1],-depth/2],nn),add([b[0],b[1],depth/2],nn),add([a[0],a[1],depth/2],nn));
    }
  }else throw new Error('unknown shared geometry '+shape);
  return {positions:new Float32Array(p),normals:new Float32Array(n),indices:new Uint32Array(idx),vertices:p.length/3,triangles:idx.length/3};
}

export function geometrySet(scene){
  const cache=new Map(), specs=[];
  for(const spec of scene.meshes){
    const key=spec.shape+JSON.stringify(spec.dimensions);
    if(!cache.has(key)) cache.set(key,buildGeometry(spec.shape,spec.dimensions));
    specs.push({...spec,key,geometry:cache.get(key)});
  }
  return {specs,cache,counts:{objects:specs.length,geometries:cache.size,vertices:specs.reduce((s,q)=>s+q.geometry.vertices,0),triangles:specs.reduce((s,q)=>s+q.geometry.triangles,0)}};
}
