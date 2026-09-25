import * as T from '../vendor/three.module.js';
import {sampleRoad,nearestRoad} from './road-network.js?v=9';

// Surface and paint share the same sampled, height-aware ribbon. UVs are world
// aligned, so intersecting asphalt meshes cannot produce rotated texture seams.
export function renderRoadNetwork(scene,batch,materials,network){
 const {roads,junctions}=network;const sidewalks={pos:[],idx:[]};
 const mesh=(pos,indices,material)=>{if(!pos.length)return;const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(pos.flatMap((_,i)=>i%3===0?[pos[i],pos[i+2]]:[]),2));geometry.setIndex(indices);geometry.computeVertexNormals();const m=new T.Mesh(geometry,material);m.receiveShadow=true;scene.add(m);return m;};
 function ribbon(points,offset,width,lift,material,bucket){const pos=[],indices=[];for(let i=0;i<points.length;i++){const p=points[i],nx=-p.tz,nz=p.tx,w=typeof width==='function'?width(p.d):width,o=typeof offset==='function'?offset(p.d):offset;for(const s of [1,-1])pos.push(p.x+nx*(o+s*w/2),p.y+lift,p.z+nz*(o+s*w/2));if(i){const j=i*2;indices.push(j-2,j,j-1,j-1,j,j+1);}}if(bucket){const base=bucket.pos.length/3;bucket.pos.push(...pos);bucket.idx.push(...indices.map(i=>i+base));return;}return mesh(pos,indices,material);}
 const nearJunction=p=>junctions.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<q.radius+6);
 for(const road of roads){
  ribbon(road.samples,0,d=>road.widthAt(d),0,materials.road);
  const paint={white:{pos:[],idx:[]},yellow:{pos:[],idx:[]}};
  function mark(d,length,offset,width,color='white'){
   const points=[sampleRoad(road,d),sampleRoad(road,Math.min(road.length,d+length))],bucket=paint[color],base=bucket.pos.length/3;
   for(const p of points){const nx=-p.tz,nz=p.tx;for(const s of [1,-1])bucket.pos.push(p.x+nx*(offset+s*width/2),p.y+.018,p.z+nz*(offset+s*width/2));}bucket.idx.push(base,base+2,base+1,base+1,base+2,base+3);
  }
  for(let d=0;d<road.length-1;d+=2){const p=sampleRoad(road,d+1),width=road.widthAt(d),crossing=nearJunction(p);
   if(!crossing){for(const side of [-1,1])mark(d,2.04,side*road.edgeLineAt(d),.105);
    if(road.highway&&road.hasBarrier(d)){if(Math.floor(d/2)%5<3)for(const side of [-1,1])mark(d,2,side*3.8,.12);}
    else if(road.area==='hill'||road.id==='rural')mark(d,2.03,0,.13,'yellow');
    else if(Math.floor(d/2)%4<2)mark(d,2,0,.12);
   }
  }
  for(const [color,b]of Object.entries(paint))mesh(b.pos,b.idx,materials[color]);
  // Asphalt shoulders blend into a grass embankment on the hill road.
  if(!road.highway){for(const side of [-1,1]){
   const pos=[],idx=[];for(let i=0;i<road.samples.length;i++){const p=road.samples[i],nx=-p.tz*side,nz=p.tx*side,half=road.width/2,bank=Math.max(3,p.y*1.5);pos.push(p.x+nx*half,p.y-.01,p.z+nz*half,p.x+nx*(half+bank),-.035,p.z+nz*(half+bank));if(i){const j=i*2;idx.push(j-2,j-1,j,j-1,j+1,j);}}
   const m=mesh(pos,idx,materials.ground);if(m)m.material=materials.bank;
  }}
  if(road.highway){for(const side of [-1,0,1]){const pos=[],idx=[];for(let i=0;i<road.samples.length-1;i++){const a=road.samples[i],b=road.samples[i+1];if(!road.hasBarrier(a.d))continue;const width=side?road.widthAt(a.d)/2-.12:0;const base=pos.length/3;for(const p of [a,b]){const x=p.x-p.tz*side*width,z=p.z+p.tx*side*width;pos.push(x,p.y,z,x,p.y+.78,z);}idx.push(base,base+1,base+2,base+1,base+3,base+2);}mesh(pos,idx,materials.barrier);}
   for(let d=110;d<road.length-110;d+=32){const p=sampleRoad(road,d);if(p.y<1)continue;batch.box(materials.concrete,p.x,p.y/2,p.z,1.4,p.y,2.5);batch.box(materials.concrete,p.x,p.y-.35,p.z,16,.6,2.1);}
  }
  if(['town','station'].includes(road.area)){
   // Short sidewalk strips stop before each junction; they never cut through a turn.
   for(let d=0;d<road.length-2;d+=3){const a=sampleRoad(road,d),b=sampleRoad(road,d+3),m=sampleRoad(road,d+1.5);if(nearJunction(a)||nearJunction(b))continue;for(const side of [-1,1])ribbon([a,b],side*(road.width/2+1.05),1.9,.14,materials.concrete,sidewalks);}
  }
 }
 mesh(sidewalks.pos,sidewalks.idx,materials.concrete);
 // Rounded inner corners replace the previous overlapping rectangular sidewalks.
 for(const q of junctions){const h=4.5,r=q.radius;mesh([q.x-h,q.y+.002,q.z-h,q.x+h,q.y+.002,q.z-h,q.x+h,q.y+.002,q.z+h,q.x-h,q.y+.002,q.z+h],[0,2,1,0,3,2],materials.road);
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const xArm=nearestRoad(roads,q.x+sx*18,q.z),zArm=nearestRoad(roads,q.x,q.z+sz*18);
   if(xArm.distance>3||zArm.distance>3)continue;
   const arc=[];for(let i=0;i<=16;i++){const a=Math.PI+i/16*Math.PI/2;arc.push({x:q.x+sx*(h+r+Math.cos(a)*r),y:q.y+.002,z:q.z+sz*(h+r+Math.sin(a)*r)});}
   const pos=[q.x+sx*h,q.y+.002,q.z+sz*h,...arc.flatMap(p=>[p.x,p.y,p.z])],idx=[];
   for(let i=1;i<arc.length;i++){const a=pos.slice(i*3,i*3+3),b=pos.slice((i+1)*3,(i+1)*3+3);const cross=(a[0]-pos[0])*(b[2]-pos[2])-(a[2]-pos[2])*(b[0]-pos[0]);idx.push(0,...(cross>0?[i+1,i]:[i,i+1]));}mesh(pos,idx,materials.road);
   const curb=[],ci=[];for(let i=0;i<arc.length;i++){const p=arc[i],cx=q.x+sx*(h+r),cz=q.z+sz*(h+r),dx=cx-p.x,dz=cz-p.z,len=Math.hypot(dx,dz);curb.push(p.x,p.y+.15,p.z,p.x+dx/len*.3,p.y+.15,p.z+dz/len*.3);if(i){const j=i*2;ci.push(j-2,j-1,j,j-1,j+1,j);}}mesh(curb,ci,materials.curb);
  }
 }
}
