import * as T from '../vendor/three.module.js';
// Spatially indexed destructible parts. Terrain is explicitly excluded; merged
// geometry keeps its draw calls and only the hit triangles/instances are removed.
export function createDestructionRegistry(scene,world){
 const targets=[...world.colliders],grid=new Map(),known=new Set(),matrix=new T.Matrix4(),box=new T.Box3(),point=new T.Vector3();
 for(const c of targets){for(const item of c.instances||[]){const key=item.mesh.uuid+':'+item.index;known.add(key);}for(const o of c.objects||[])o.traverse(n=>known.add(n));}
 const make=(bounds,extra={})=>{const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());return {x:center.x,y:bounds.min.y,z:center.z,hx:Math.max(.035,size.x/2),hz:Math.max(.035,size.z/2),height:Math.max(.035,size.y),type:'scenery',collision:false,instances:[],objects:[],...extra};};
 scene.updateMatrixWorld(true);
 scene.traverse(object=>{
  if(object.isLineSegments&&!object.userData.terrain){const g=object.geometry,pos=g.attributes.position;for(let i=0;i<pos.count;i+=2){const a=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(object.matrixWorld),b=new T.Vector3().fromBufferAttribute(pos,i+1).applyMatrix4(object.matrixWorld),bounds=new T.Box3().setFromPoints([a,b]),c=make(bounds);c.lines=[{geometry:g,index:i}];targets.push(c);}return;}if(!object.isMesh||object.userData.terrain||known.has(object))return;
  for(let p=object.parent;p;p=p.parent)if(p.userData.terrain||known.has(p))return;
  const geo=object.geometry;if(!geo?.attributes.position)return;
  if(object.isInstancedMesh){geo.computeBoundingBox();const groups=new Map();for(let i=0;i<object.count;i++){if(known.has(object.uuid+':'+i))continue;object.getMatrixAt(i,matrix);matrix.premultiply(object.matrixWorld);box.copy(geo.boundingBox).applyMatrix4(matrix);const center=box.getCenter(point),key=[Math.floor(center.x/12),Math.floor(center.y/5),Math.floor(center.z/12)].join(',');let group=groups.get(key);if(!group){group={bounds:box.clone(),items:[]};groups.set(key,group);}else group.bounds.union(box);group.items.push({mesh:object,index:i});}for(const g of groups.values()){const c=make(g.bounds);c.instances=g.items;c.surface=c.height<.5&&c.hx>1.5&&c.hz>1.5&&c.y>.2;targets.push(c);}return;}
  // Small props are a single target. Large ribbons/slabs use 12m spatial chunks
  // backed by index-buffer ranges, avoiding thousands of new Mesh objects.
  const pos=geo.attributes.position;if(!geo.index)geo.setIndex(Array.from({length:pos.count},(_,i)=>i));const idx=geo.index.array,groups=new Map();for(let i=0;i<idx.length;i+=3){const bounds=new T.Box3();for(let k=0;k<3;k++){point.fromBufferAttribute(pos,idx[i+k]).applyMatrix4(object.matrixWorld);bounds.expandByPoint(point);}const center=bounds.getCenter(new T.Vector3()),key=[Math.floor(center.x/12),Math.floor(center.y/5),Math.floor(center.z/12)].join(',');let group=groups.get(key);if(!group){group={bounds,indices:[]};groups.set(key,group);}else group.bounds.union(bounds);group.indices.push(i);}
  for(const g of groups.values()){const c=make(g.bounds);c.surface=!!object.userData.surface||object.material===world.materials.road||(c.height<.4&&c.hx>1.5&&c.hz>1.5&&c.y>.2);c.type=c.surface?'surface':'scenery';c.fragments=[{geometry:geo,indices:g.indices}];targets.push(c);}
 });
 for(const c of targets){delete c.indestructible;const r=Math.hypot(c.hx||0,c.hz||0);for(let x=Math.floor((c.x-r)/24);x<=Math.floor((c.x+r)/24);x++)for(let z=Math.floor((c.z-r)/24);z<=Math.floor((c.z+r)/24);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(c);}}
 function query(x,z,radius=8,includeDestroyed=false){const set=new Set();for(let i=Math.floor((x-radius)/24);i<=Math.floor((x+radius)/24);i++)for(let j=Math.floor((z-radius)/24);j<=Math.floor((z+radius)/24);j++)for(const t of grid.get(i+','+j)||[])if(includeDestroyed||!t.destroyed)set.add(t);return [...set];}
 for(const light of world.streetLights||[])if(!light.owner){light.owner=query(light.x,light.z,1).filter(c=>Math.abs(c.x-light.x)<=c.hx+1&&Math.abs(c.z-light.z)<=c.hz+1&&light.y>=c.y-.5&&light.y<=c.y+c.height+.5).sort((a,b)=>a.hx*a.hz-b.hx*b.hz)[0];}
 return {targets,query,surfaceMissing(x,y,z){return query(x,z,0,true).some(c=>c.surface&&c.destroyed&&Math.abs(c.x-x)<=c.hx&&Math.abs(c.z-z)<=c.hz&&y>=c.y-.2&&y<=c.y+c.height+.3);}};
}
export function breakStrength(target){if(target.type==='person'||target.type==='police')return {impact:14000,push:5000};if(target.type==='building')return {impact:330000,push:100000};if(target.type==='tram'||target.type==='structure')return {impact:220000,push:65000};if(target.model||target.type==='vehicle'||target.type==='police-bike'||target.type==='parked-car')return {impact:90000,push:30000};return {impact:24000,push:12000};}
export class ImpactBreaker{
 constructor(){this.contacts=new Map();this.time=0;this.progress=0;}
 step(dt){this.time+=dt;this.progress=0;for(const [target,v]of this.contacts)if(target.destroyed||this.time-v.seen>.4)this.contacts.delete(target);}
 hit(target,state,normal,dt){if(target.destroyed||target.terrain||!normal||state.onFoot)return false;const {impact,push}=breakStrength(target),fx=-Math.sin(state.yaw),fz=-Math.cos(state.yaw),ox=-Math.sin(target.yaw||0)*(target.speed||0),oz=-Math.cos(target.yaw||0)*(target.speed||0),closing=Math.max(0,-(((state.robot?state.robotVx||0:fx*state.speed)-ox)*normal.nx+((state.robot?state.robotVz||0:fz*state.speed)-oz)*normal.nz)),energy=.5*1500*closing*closing;
  if(energy>=impact){state.speed*=Math.max(.35,Math.sqrt(Math.max(0,1-impact/Math.max(impact,energy))));this.contacts.delete(target);return true;}
  const sign=state.gear==='D'?1:state.gear==='R'?-1:0,alignment=Math.max(0,-sign*(fx*normal.nx+fz*normal.nz)),force=!state.parking&&state.brake<.2?8500*(state.throttle||0)*alignment:0;let c=this.contacts.get(target)||{load:0,seen:this.time};c.seen=this.time;c.load=force>1500?c.load+force*dt:Math.max(0,c.load-16000*dt);this.contacts.set(target,c);this.progress=Math.max(this.progress,c.load/push);if(c.load>=push){this.contacts.delete(target);return true;}return false;
 }
}
