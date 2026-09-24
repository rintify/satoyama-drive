// Shared road data for surface meshes, height/grade queries, maps and traffic.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const point=p=>({x:p[0],y:p[1],z:p[2]});
const lerp=(a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t)});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function makeRoad(id,points,{width=9,limit=30,area='town',radius=16,closed=false,highway=false}={}){
 const vertices=points.map(point);if(closed&&distance(vertices[0],vertices.at(-1))<.01)vertices.pop();
 const samples=[];
 function add(p){const prev=samples.at(-1);if(prev&&distance(prev,p)<.0001)return;samples.push({...p,d:prev?prev.d+distance(prev,p):0});}
 function line(p){const from=samples.at(-1);if(!from){add(p);return;}const n=Math.max(1,Math.ceil(distance(from,p)/3));for(let k=1;k<=n;k++)add(lerp(from,p,k/n));}
 for(let i=0;i<vertices.length;i++){
  const b=vertices[i];if(!closed&&(i===0||i===vertices.length-1)){line(b);continue;}
  const a=vertices[(i-1+vertices.length)%vertices.length],c=vertices[(i+1)%vertices.length];
  const ab=distance(a,b),bc=distance(b,c),trim=Math.min(typeof radius==='function'?radius(b):radius,ab*.32,bc*.32);
  const entry=lerp(b,a,trim/ab),exit=lerp(b,c,trim/bc);line(entry);
  const n=Math.max(3,Math.ceil(trim*2/2));for(let k=1;k<=n;k++){const t=k/n;add(lerp(lerp(entry,b,t),lerp(b,exit,t),t));}
 }
 if(closed)line(samples[0]);
 for(let i=0;i<samples.length;i++){const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],len=distance(a,b)||1;samples[i].tx=(b.x-a.x)/len;samples[i].tz=(b.z-a.z)/len;}
 const road={id,points,samples,length:samples.at(-1).d,width,limit,area,highway,closed};
 road.widthAt=d=>highway?mix(9,width,clamp(Math.min(d,road.length-d)/70,0,1)):width;
 road.hasBarrier=d=>highway&&d>95&&d<road.length-95;
 return road;
}
export function sampleRoad(road,d){
 if(road.closed)d=((d%road.length)+road.length)%road.length;else d=clamp(d,0,road.length);
 const s=road.samples;let lo=0,hi=s.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(s[m].d<d)lo=m;else hi=m;}
 const a=s[lo],b=s[hi],t=(d-a.d)/(b.d-a.d||1),len=b.d-a.d||1;
 let tx=mix(a.tx,b.tx,t),tz=mix(a.tz,b.tz,t);const mag=Math.hypot(tx,tz)||1;tx/=mag;tz/=mag;
 return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t),tx,tz,grade:(b.y-a.y)/len,d};
}
export function indexRoads(roads){
 const grid=new Map();for(const road of roads)for(let i=1;i<road.samples.length;i++){const a=road.samples[i-1],b=road.samples[i];for(let x=Math.floor(Math.min(a.x,b.x)/40);x<=Math.floor(Math.max(a.x,b.x)/40);x++)for(let z=Math.floor(Math.min(a.z,b.z)/40);z<=Math.floor(Math.max(a.z,b.z)/40);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push({road,i});}}roads.spatialIndex=grid;return roads;
}
export function nearestRoad(roads,x,z){
 let best={distance:Infinity,road:null,x,z,y:0,side:0,tx:0,tz:-1,grade:0,d:0};
 let candidates=[];if(roads.spatialIndex){const gx=Math.floor(x/40),gz=Math.floor(z/40);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)candidates.push(...(roads.spatialIndex.get((gx+dx)+','+(gz+dz))||[]));}
 if(!candidates.length)for(const road of roads)for(let i=1;i<road.samples.length;i++)candidates.push({road,i});
 for(const {road,i}of candidates){const a=road.samples[i-1],b=road.samples[i],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;if(!len2)continue;const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/len2,0,1),px=a.x+dx*t,pz=a.z+dz*t,distance=Math.hypot(x-px,z-pz);if(distance<best.distance){const len=Math.sqrt(len2);best={distance,road,x:px,z:pz,y:mix(a.y,b.y,t),side:((x-px)*(-dz)+(z-pz)*dx)/len,tx:dx/len,tz:dz/len,grade:(b.y-a.y)/len,d:mix(a.d,b.d,t)};}}
 best.onSurface=best.road&&best.distance<=best.road.widthAt(best.d)/2;
 if(!best.onSurface)for(const q of roads.junctions||[]){const dx=x-q.x,dz=z-q.z,ax=Math.abs(dx),az=Math.abs(dz),h=4.5,r=q.radius;if(ax<=h&&az<=h){best.onSurface=true;break;}if(ax>=h&&az>=h&&ax<=h+r&&az<=h+r&&Math.hypot(ax-h-r,az-h-r)>=r&&q.corners.includes(Math.sign(dx)+','+Math.sign(dz))){best.onSurface=true;break;}}
 return best;
}
const at=(x,z,y=.04)=>[x,y,z];
export function createRoadNetwork(){
 const roads=[];const add=(id,points,options)=>{const r=makeRoad(id,points,options);roads.push(r);return r;};
 add('town-main',[at(0,285),at(0,160),at(0,0),at(0,-160),at(0,-240)]);
 add('town-west',[at(-160,160),at(-160,0),at(-160,-160)]);
 add('town-local',[at(-80,160),at(-80,0),at(-80,-160)],{width:9});
 add('town-east',[at(160,160),at(160,0),at(160,-160)]);
 add('town-south',[at(-160,160),at(-80,160),at(0,160),at(160,160),at(235,160)]);
 add('town-center',[at(-160,0),at(-80,0),at(0,0),at(160,0)]);
 add('town-north',[at(-160,-160),at(-80,-160),at(0,-160),at(160,-160)]);
 add('south-loop',[at(-160,160),at(-160,285),at(0,285),at(160,285),at(160,160)],{radius:48,limit:40});
 add('east-loop',[at(160,-160),at(235,-160),at(235,0),at(160,0)],{radius:32});
 const ruralPoints=[at(0,-240),at(0,-285),at(-55,-355),at(-85,-450),at(-25,-570),at(65,-648),at(210,-665),at(300,-665),at(300,-600)];
 const rural=add('rural',ruralPoints,{width:9,limit:40,area:'country',radius:34});
 const highwayPoints=[at(300,-600),at(300,-540),at(300,-435,7),at(300,-200,7),at(300,15,7),at(300,105),at(300,160),at(235,160)];
 const highway=add('highway',highwayPoints,{width:16,limit:80,area:'highway',highway:true,radius:35});
 const hillPoints=[at(-160,-160),at(-235,-160),at(-345,-260,8),at(-390,-395,24),at(-365,-530,42),at(-275,-650,55),at(-100,-758,61),at(100,-775,33),at(210,-720,9),at(210,-665)];
 const hill=add('hill-pass',hillPoints,{width:9,limit:40,area:'hill',radius:48});
 const farmJoin=nearestRoad([rural],-55,-355);
 add('farm-link',[at(-80,-160),at(-80,-240),[farmJoin.x,farmJoin.y,farmJoin.z]],{width:7,limit:30,area:'country',radius:24});
 add('river-road',[at(160,-160),at(170,-275),at(140,-395),at(125,-520),at(210,-665)],{width:9,limit:40,area:'country',radius:42});
 const junctions=[];
 for(const x of [-160,-80,0,160])for(const z of [-160,0,160])junctions.push({x,z,y:.04,radius:8.5,signal:(x===0||x===-160)&&z!==0});
 junctions.push({x:0,z:285,y:.04,radius:8.5},{x:0,z:-240,y:.04,radius:8.5},{x:210,z:-665,y:.04,radius:12});
 // Each route closes on itself. Filleted junction turns avoid endpoint U-turns/teleports.
 const turnRadius=normal=>p=>junctions.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1)?14:normal;
 const routes=[
  makeRoad('town-circuit',[at(0,160),at(0,0),at(0,-160),at(-160,-160),at(-160,0),at(-160,160)],{closed:true,radius:14}),
  makeRoad('local-circuit',[at(-80,160),at(-80,0),at(-80,-160),at(160,-160),at(160,0),at(160,160)],{closed:true,radius:14}),
  makeRoad('south-circuit',[at(0,160),at(-160,160),at(-160,285),at(160,285),at(160,160)],{closed:true,radius:turnRadius(48)}),
  makeRoad('express-circuit',[at(0,160),at(0,0),at(0,-160),...ruralPoints,...highwayPoints.slice(1)],{closed:true,radius:turnRadius(34)}),
  makeRoad('hill-circuit',[...hillPoints,...ruralPoints.slice(0,7).reverse().slice(1),at(0,-160)],{closed:true,radius:p=>junctions.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1)?14:(p.x<-150||p.z<-700?48:34)}),
  makeRoad('east-circuit',[at(160,0),at(160,-160),at(235,-160),at(235,0)],{closed:true,radius:turnRadius(32)})
 ];
 indexRoads(roads);
 for(const q of junctions){q.corners=[];for(const sx of [-1,1])for(const sz of [-1,1])if(nearestRoad(roads,q.x+sx*18,q.z).distance<3&&nearestRoad(roads,q.x,q.z+sz*18).distance<3)q.corners.push(sx+','+sz);}
 roads.junctions=junctions;
 for(const route of routes)for(const p of route.samples){const near=nearestRoad(roads,p.x,p.z);p.sourceRoad=near.road;p.sourceD=near.d;}
 return {roads,rural,highway,hill,junctions,routes,totalLength:roads.reduce((s,r)=>s+r.length,0)};
}
