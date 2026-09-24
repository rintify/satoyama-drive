import * as T from '../vendor/three.module.js';
export const WORLD_SEED = 427;
let seed = WORLD_SEED;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mat = (color, extra = {}) => new T.MeshStandardMaterial({color,roughness:.85,...extra});
const boxGeo = new T.BoxGeometry(1,1,1), cylinderGeo = new T.CylinderGeometry(1,1,1,8), sphereGeo = new T.SphereGeometry(1,10,8);
const tmp = new T.Object3D();
class Batch {
 constructor(scene){this.scene=scene;this.items=new Map();}
 add(geo,material,x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0){const key=geo.uuid+material.uuid;if(!this.items.has(key))this.items.set(key,{geo,material,matrices:[]});tmp.position.set(x,y,z);tmp.rotation.set(rx,ry,rz);tmp.scale.set(sx,sy,sz);tmp.updateMatrix();this.items.get(key).matrices.push(tmp.matrix.clone());}
 box(m,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0){this.add(boxGeo,m,x,y,z,sx,sy,sz,ry,rx,rz);}
 finish(){for(const {geo,material,matrices} of this.items.values()){const mesh=new T.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.scene.add(mesh);}this.items.clear();}
}
function texture(kind){const c=document.createElement('canvas');c.width=c.height=128;const a=c.getContext('2d');a.fillStyle=kind==='road'?'#787c7a':kind==='roof'?'#adb2b0':'#b2b6a2';a.fillRect(0,0,128,128);for(let i=0;i<4500;i++){const b=80+rand()*145;a.fillStyle=`rgba(${b},${b},${b},${kind==='road'?.12:.06})`;a.fillRect(rand()*128,rand()*128,1+rand()*2,1+rand()*2);}if(kind==='roof'){a.strokeStyle='#535e6355';a.lineWidth=2;for(let i=0;i<128;i+=16){a.beginPath();a.moveTo(i,0);a.lineTo(i,128);a.stroke();a.beginPath();a.moveTo(0,i);a.lineTo(128,i);a.stroke();}}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function signTexture(lines,bg='#246247',fg='#f3f6e9',width=512,height=256){const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);ctx.strokeStyle=fg;ctx.lineWidth=5;ctx.strokeRect(10,10,width-20,height-20);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';lines.forEach((s,i)=>{ctx.font=`500 ${lines.length>1?(i===0?46:29):70}px sans-serif`;ctx.fillText(s,width/2,(i+.5)*height/lines.length,width-40)});return new T.CanvasTexture(c);}
function roofGeometry(){const v=[-1,0,-1,1,0,-1,0,.8,-1,-1,0,1,0,.8,1,1,0,1,-1,0,-1,0,.8,-1,-1,0,1,0,.8,-1,0,.8,1,-1,0,1,0,.8,-1,1,0,-1,0,.8,1,1,0,-1,1,0,1,0,.8,1];for(let i=0;i<v.length;i+=9){for(let k=0;k<3;k++){const temp=v[i+3+k];v[i+3+k]=v[i+6+k];v[i+6+k]=temp;}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();const uv=[];for(let i=0;i<v.length;i+=3)uv.push(v[i],v[i+2]);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;}
export function createWorld(scene){
 const batch=new Batch(scene),colliders=[],roads=[],signals=[];
 const asphaltTex=texture('road');asphaltTex.repeat.set(.55,.55);
 const materials={road:mat('#545b5c',{map:asphaltTex}),ground:mat('#718663',{map:texture('ground')}),concrete:mat('#b7bbb2'),curb:mat('#c6c9c1'),white:mat('#eceada'),yellow:mat('#d5a13c'),metal:mat('#89928c',{metalness:.45,roughness:.55}),dark:mat('#344643'),glass:mat('#6d8587',{metalness:.38,roughness:.18}),wood:mat('#5c5043'),leaf:[mat('#35573c'),mat('#506b41'),mat('#688449'),mat('#789154')],walls:[mat('#d2cec1'),mat('#e3dfd1'),mat('#b7b2a4'),mat('#a3aaa5'),mat('#ddd9c9')],roofs:[mat('#414b54',{map:texture('roof')}),mat('#63534b',{map:texture('roof')}),mat('#52616a',{map:texture('roof')})]};
 const ground=new T.Mesh(new T.PlaneGeometry(4400,4400),materials.ground);ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;scene.add(ground);
 const intersections=[{x:0,z:160},{x:0,z:-160},{x:-160,z:160},{x:-160,z:-160},{x:300,z:160}];
 function road(id,points,width,limit,area,{smooth=false,highway=false}={}){
  let ps=points.map(p=>new T.Vector3(p[0],p[1]||.03,p[2]));
  if(smooth){const curve=new T.CatmullRomCurve3(ps,false,'catmullrom',.3);ps=curve.getPoints(Math.ceil(curve.getLength()/3));}
  const pos=[],uv=[],idx=[],samples=[];let distance=0;
  for(let i=0;i<ps.length;i++){const p=ps[i],prev=ps[Math.max(0,i-1)],next=ps[Math.min(ps.length-1,i+1)],tangent=next.clone().sub(prev).normalize(),normal=new T.Vector3(-tangent.z,0,tangent.x).normalize();if(i)distance+=p.distanceTo(ps[i-1]);pos.push(p.x+normal.x*width/2,p.y,p.z+normal.z*width/2,p.x-normal.x*width/2,p.y,p.z-normal.z*width/2);uv.push(0,distance,width,distance);if(i){const a=i*2;idx.push(a-2,a,a-1,a-1,a,a+1);}samples.push({x:p.x,y:p.y,z:p.z,tx:tangent.x,tz:tangent.z,d:distance});}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const mesh=new T.Mesh(g,materials.road);mesh.receiveShadow=true;scene.add(mesh);
  const r={id,samples,width,limit,area,highway,length:distance};roads.push(r);
  // Lane marks and shoulders follow the same centerline as the drivable surface.
  for(let d=0;d<distance;d+=3){const p=sampleRoad(r,d);const rx=Math.atan2(p.tx,p.tz);const nx=-p.tz,nz=p.tx;const crossing=intersections.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<7);
   for(const side of [-1,1]){batch.box(materials.white,p.x+nx*side*(width/2-.35),p.y+.022,p.z+nz*side*(width/2-.35),.12,.015,3.1,rx);if(highway&&d>45&&d<distance-45){batch.box(materials.concrete,p.x+nx*side*(width/2+.2),p.y+.44,p.z+nz*side*(width/2+.2),.32,.85,3.1,rx);}}
   if(!crossing){if(highway){if(d>45&&d<distance-45)batch.box(materials.concrete,p.x,p.y+.35,p.z,.7,.7,3.1,rx);if(Math.floor(d/3)%3!==0)for(const side of [-1,1])batch.box(materials.white,p.x+nx*side*3.7,p.y+.025,p.z+nz*side*3.7,.12,.02,2.9,rx);}else if(Math.floor(d/3)%3!==0)batch.box(id==='rural'?materials.yellow:materials.white,p.x,p.y+.028,p.z,.12,.02,2.9,rx);}
   if(highway&&p.y>1&&Math.floor(d/3)%10===0){batch.box(materials.concrete,p.x,p.y/2,p.z,1.4,p.y,2.4,rx);batch.box(materials.concrete,p.x,p.y-.5,p.z,width,.8,1.3,rx);}
  }
  return r;
 }
 road('town-main',[[0,.04,210],[0,.04,-210]],9,30,'town');
 road('town-west',[[-160,.045,164],[-160,.045,-164]],8,30,'town');
 road('town-south',[[-165,.05,160],[308,.05,160]],9,30,'town');
 road('town-north',[[-165,.055,-160],[95,.055,-160]],9,30,'town');
 const rural=road('rural',[[0,.04,-205],[0,.05,-255],[-55,.05,-345],[-85,.06,-450],[-25,.07,-570],[65,.05,-648],[210,.05,-655],[300,.05,-600]],8,40,'country',{smooth:true});
 const highway=road('highway',[[300,.08,-600],[300,.08,-550],[300,7,-450],[300,7,-200],[300,7,20],[300,.09,110],[300,.07,160]],16,80,'highway',{highway:true});
 // The avenue carries a tram beside, rather than through, the driving lanes.
 for(const z of [151,149.5])batch.box(materials.metal,67,.1,z,460,.08,.08);
 for(let x=-160;x<300;x+=1.8)batch.box(materials.wood,x,.065,150.25,.22,.04,2.6);
 for(const x of [-7,7,-166,-154]){const z=x< -100?0:0;batch.box(materials.concrete,x,.115,z,2.0,.2,308);}
 for(const z of [-167,-153,167])batch.box(materials.concrete,-78,.12,z,158,.22,2.5);
 // Crosswalks, tactile tiles and stop lines.
 for(const q of intersections.slice(0,4)){for(const z of [-8,8])for(let x=-3.8;x<4;x+=1.15)batch.box(materials.white,q.x+x,.083,q.z+z,.65,.02,3.2);for(const x of [-7,7]){batch.box(materials.yellow,q.x+x,.25,q.z+7,1.2,.025,3.2);}batch.box(materials.white,q.x-2.35,.083,q.z+11,3.8,.02,.3);batch.box(materials.white,q.x+2.35,.083,q.z-11,3.8,.02,.3);}
 const roofGeo=roofGeometry();
 function tree(x,z,size=1){batch.add(cylinderGeo,materials.wood,x,1.6*size,z,.18*size,3.2*size,.18*size);for(let j=0;j<5;j++)batch.add(sphereGeo,materials.leaf[Math.floor(rand()*4)],x+(rand()-.5)*2.5*size,(3.1+rand()*2)*size,z+(rand()-.5)*2.5*size,(1.25+rand()*.9)*size,(1.5+rand())*size,(1.2+rand()*.8)*size,rand()*6);}
 function house(x,z,w=9,d=11,h=6.3,index=0){const wall=materials.walls[index%5],roof=materials.roofs[index%3];batch.box(materials.concrete,x,.28,z,w+.3,.55,d+.3);batch.box(wall,x,h/2+.5,z,w,h,d);batch.add(roofGeo,roof,x,h+.5,z,w*.57,2.4,d*.57);colliders.push({x,z,hx:w/2,hz:d/2,type:'building'});
  for(const side of [-1,1])for(const y of [2.1,4.65])for(const dx of [-w*.28,w*.28]){batch.box(materials.dark,x+dx,y,z+side*(d/2+.025),1.88,1.62,.085);batch.box(materials.glass,x+dx,y,z+side*(d/2+.075),1.66,1.36,.08);batch.box(wall,x+dx,y,z+side*(d/2+.14),.05,1.36,.07);batch.box(wall,x+dx,y,z+side*(d/2+.14),1.7,.04,.07);batch.box(materials.dark,x+dx,y-.89,z+side*(d/2+.25),2,.08,.48);}
  for(const side of [-1,1])for(const dz of [-d*.26,d*.24]){batch.box(materials.dark,x+side*(w/2+.025),4.65,z+dz,.06,1.65,1.9);batch.box(materials.glass,x+side*(w/2+.075),4.65,z+dz,.08,1.4,1.66);batch.box(wall,x+side*(w/2+.125),4.65,z+dz,.08,1.4,.045);}
  batch.box(materials.wood,x,1.6,z+d/2+.07,1.2,2.25,.15);batch.box(materials.metal,x+.36,1.5,z+d/2+.17,.07,.2,.06);batch.box(roof,x,2.88,z+d/2+.6,1.8,.12,1.25);
  // Gutters, outdoor AC units and walled gardens give the houses street scale.
  for(const side of [-1,1]){batch.box(materials.metal,x+side*w*.56,h+.48,z,.1,.1,d*1.13);batch.box(materials.concrete,x+side*(w/2+2),.7,z,.25,1.4,d+6);batch.add(sphereGeo,materials.leaf[index%4],x+side*(w/2+1.15),1.1,z+d/2+2,1.1,1.3,1.0);}
  batch.box(materials.concrete,x+w/2+.5,.65,z,1,.7,1.5);batch.box(materials.metal,x+w/2+1.01,.65,z,.03,.53,1.1);
  for(let j=0;j<3;j++)batch.box(materials.dark,x+w/2+1.04,.65,z+(j-1)*.25,.035,.04,.16);
 }
 let houseIndex=0;
 for(const x of [-19,20,-140,-179])for(let z=-128;z<=128;z+=28){house(x+(rand()-.5)*2,z,8+rand()*3,9+rand()*3,5.2+rand()*1.3,houseIndex++);if(houseIndex%2===0)tree(x+(x<0?-9:9),z+9,.9);}
 for(const z of [-184,184])for(let x=-130;x<-20;x+=27){house(x,z,9,10,5.6,houseIndex++);}
 for(let z=-125;z<=124;z+=40)for(const x of [-75,-110])house(x,z,11,12,6.2,houseIndex++);
 // Window shutters, balconies, storm drains and a few modern flat-roof houses.
 for(let z=-115;z<140;z+=28){for(const x of [-5.55,5.55]){batch.box(materials.dark,x,.227,z,.48,.015,.75);for(let k=-2;k<=2;k++)batch.box(materials.metal,x+k*.085,.241,z,.028,.01,.66);}batch.box(materials.concrete,-7,.23,z,1.6,.02,.07);batch.box(materials.concrete,7,.23,z,1.6,.02,.07);}
 for(let z=-100;z<140;z+=56){const x=20;batch.box(materials.concrete,x,3.9,z+6,5.2,.18,1.6);for(const dx of [-2.5,2.5])batch.box(materials.metal,x+dx,4.3,z+6.7,.045,.9,.05);batch.box(materials.metal,x,4.75,z+6.7,5.2,.05,.05);for(let dx=-2.4;dx<=2.4;dx+=.35)batch.box(materials.metal,x+dx,4.35,z+6.7,.028,.8,.03);batch.box(materials.dark,x-4.5,1.03,z+7,.4,.3,.3);batch.add(cylinderGeo,materials.metal,x-4.5,.5,z+7,.03,.8,.03);}
 for(let z=-103;z<135;z+=84){batch.box(materials.glass,-19,8.1,z,4.4,.06,3.2,0,0,-.29);batch.add(cylinderGeo,materials.metal,-17,8.5,z+1,.02,2,.02);batch.box(materials.metal,-17,9.35,z+1,1.4,.025,.03);}
 // Local convenience store, covered tram stops, utility poles and wires.
 const storeMat=mat('#ecede3'),storeGreen=mat('#338c70');batch.box(storeMat,26,2.5,-129,20,5,13);colliders.push({x:26,z:-129,hx:10,hz:6.5,type:'building'});batch.box(materials.glass,26,2.2,-122.4,18,3.6,.1);batch.box(storeGreen,26,4.7,-122.3,21,.55,.3);batch.box(materials.white,26,4.22,-122.3,21,.18,.3);
 function sign(x,y,z,lines,bg,w=6,h=3,ry=0){const tex=signTexture(lines,bg);tex.colorSpace=T.SRGBColorSpace;const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});const mesh=new T.Mesh(new T.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=ry;scene.add(mesh);return mesh;}
 sign(26,4.65,-122.05,['さくら MART'],'#2c8269',8,.7);
 const vending=mat('#b63d3a');batch.box(vending,11.3,1.03,-120,1.3,2,.85);batch.box(materials.white,11.3,1.2,-119.56,1,.9,.02);for(let i=0;i<4;i++)for(let j=0;j<2;j++)batch.box([storeGreen,materials.yellow,vending,materials.glass][i],10.94+i*.24,1.03+j*.35,-119.51,.14,.24,.02);
 for(const x of [60,210]){batch.box(materials.concrete,x,.22,143,13,.4,3);batch.box(materials.dark,x,3.1,143,14,.18,3.4);for(const dx of [-5.7,5.7])batch.box(materials.metal,x+dx,1.6,143,.1,3.1,.1);batch.box(materials.wood,x,.7,143,5,.2,.5);sign(x,2.2,144,['桜町電停'],'#36544b',3,.5);}
 const cablePoints=[];
 for(let z=-175;z<185;z+=36){const x=8.8;batch.add(cylinderGeo,materials.concrete,x,5.8,z,.15,11.6,.15);batch.box(materials.metal,x,10.5,z,3,.12,.15);batch.box(materials.dark,x+1,8.4,z,.6,1,.5);for(let k=-1;k<=1;k++){cablePoints.push(new T.Vector3(x+k,10.55,z),new T.Vector3(x+k,10.05,z+18),new T.Vector3(x+k,10.05,z+18),new T.Vector3(x+k,10.55,z+36));}batch.box(materials.metal,x-1.2,8.5,z,2.5,.08,.1);batch.box(materials.white,x-2.2,8.45,z,.7,.1,.4);}
 const cables=new T.LineSegments(new T.BufferGeometry().setFromPoints(cablePoints),new T.LineBasicMaterial({color:'#303f3d',transparent:true,opacity:.7}));scene.add(cables);
 function speedSign(x,z,limit,ry=0){batch.add(cylinderGeo,materials.metal,x,1.7,z,.055,3.4,.055);const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#f4f1e9';ctx.beginPath();ctx.arc(64,64,61,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c64739';ctx.lineWidth=14;ctx.stroke();ctx.fillStyle='#27446a';ctx.font='bold 66px sans-serif';ctx.textAlign='center';ctx.fillText(limit,64,88);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.CircleGeometry(.48,28),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));mesh.position.set(x,3.15,z);mesh.rotation.y=ry;scene.add(mesh);}
 speedSign(-5.5,68,'30');speedSign(-5.5,-226,'40');speedSign(291,-525,'80',Math.PI);
 sign(-.3,6.7,-99,['↑ 里山   Satoyama','← 桜町駅    高速入口 →'],'#2b6258',7,2.2);batch.add(cylinderGeo,materials.metal,5.8,3.9,-99,.095,7.8,.095);batch.box(materials.metal,2.7,7.9,-99,6.6,.13,.13);
 sign(295,6.8,110,['E8  里山自動車道','SATOYAMA EXPRESSWAY  ↑'],'#297054',7,2.1);batch.add(cylinderGeo,materials.metal,289.5,4,110,.11,8,.11);batch.box(materials.metal,293.2,8.1,110,7.6,.18,.16);
 sign(-7,2.6,-53,['通学路'],'#efdc72',1.1,.9);batch.add(cylinderGeo,materials.metal,-7,1.3,-53,.04,2.6,.04);
 // Horizontal Japanese traffic lights; shared state drives geometry and rules.
 for(const q of intersections.slice(0,4)){const group=new T.Group();group.position.set(q.x,0,q.z);for(const side of [-1,1]){const x=side*5.7,z=side*-6;const pole=new T.Mesh(new T.CylinderGeometry(.09,.09,6.5,8),materials.metal);pole.position.set(x,3.25,z);group.add(pole);const arm=new T.Mesh(new T.BoxGeometry(4,.1,.1),materials.metal);arm.position.set(x-side*1.9,6.2,z);group.add(arm);const head=new T.Mesh(new T.BoxGeometry(1.55,.52,.42),materials.dark);head.position.set(x-side*3.5,6,z);group.add(head);const lights=[];for(let i=0;i<3;i++){const material=new T.MeshBasicMaterial({color:0x193e2e});const bulb=new T.Mesh(new T.SphereGeometry(.17,12,8),material);bulb.scale.z=.5;bulb.position.set(head.position.x+(i-1)*.43,6,z+side*.25);group.add(bulb);lights.push(material);}signals.push({x:q.x,z:q.z,direction:side,lights,phase:0});}scene.add(group);}
 // Rural fields, irrigation channels, orchards and distant mountain ridges.
 const water=mat('#679798',{metalness:.4,roughness:.18});const fields=[mat('#a1a966'),mat('#809557'),mat('#9bab63'),mat('#91a264')];
 for(let x=-220;x<=215;x+=50)for(let z=-585;z< -235;z+=48){const n=nearestRoad(roads,x,z);if(n.distance<35)continue;batch.box(fields[Math.floor(rand()*4)],x,.0,z,44,.06,42);batch.box(water,x+24,.01,z,1.2,.03,46);for(let j=-19;j<21;j+=3)batch.box(materials.leaf[3],x+j,.13,z,.18,.15,40);}
 for(let i=0;i<200;i++){const x=-300+rand()*850,z=-790+rand()*1120;const n=nearestRoad(roads,x,z);if(n.distance<13||colliders.some(c=>Math.abs(c.x-x)<c.hx+3&&Math.abs(c.z-z)<c.hz+3))continue;if(x>-190&&x<35&&z>-210&&z<210)continue;tree(x,z,.8+rand()*1.3);}
 const mountains=new T.PlaneGeometry(4200,4200,110,110);mountains.rotateX(-Math.PI/2);const mp=mountains.attributes.position;
 for(let i=0;i<mp.count;i++){const x=mp.getX(i),z=mp.getZ(i)-220;const edge=Math.max(Math.abs(x-35)-400,Math.abs(z+220)-650);const blend=T.MathUtils.smoothstep(edge,0,420);const broad=Math.sin(x*.0032+Math.cos(z*.002))*Math.cos(z*.0034);const detail=Math.sin(x*.011+z*.007)*Math.sin(z*.009-x*.005);mp.setXYZ(i,x,blend*(180+135*broad+45*detail)-.2,z);}mountains.computeVertexNormals();const mountainMesh=new T.Mesh(mountains,mat('#5a7866',{roughness:1}));mountainMesh.receiveShadow=true;scene.add(mountainMesh);

 // Small rural houses and a torii beside the scenic route.
 for(let i=0;i<7;i++)house(-132-i%2*22,-285-i*42,9,11,5.3,houseIndex++);
 const red=mat('#a64830');for(const x of [-30,-24])batch.add(cylinderGeo,red,x,3.1,-527,.26,6.2,.26);batch.box(red,-27,5.6,-527,9,.38,.48);batch.box(materials.dark,-27,6.35,-527,10,.35,.8);
 for(let z=-510;z<=-492;z+=3)batch.box(materials.concrete,-27,.1,z,4,.2,2);
 batch.finish();
 const grid=new Map();for(const c of colliders){for(let x=Math.floor((c.x-c.hx)/20);x<=Math.floor((c.x+c.hx)/20);x++)for(let z=Math.floor((c.z-c.hz)/20);z<=Math.floor((c.z+c.hz)/20);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(c);}}
 return {roads,signals,colliders,grid,materials,rural,highway,intersections};
}
export function sampleRoad(road,d){d=Math.max(0,Math.min(d,road.length));const s=road.samples;let lo=0,hi=s.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(s[m].d<d)lo=m;else hi=m;}const a=s[lo],b=s[hi],t=(d-a.d)/(b.d-a.d||1);const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,tx:dx/len,tz:dz/len};}
export function nearestRoad(roads,x,z){let best={distance:Infinity,road:null,x,z,y:0,side:0,tx:0,tz:-1};for(const road of roads){for(let i=1;i<road.samples.length;i++){const a=road.samples[i-1],b=road.samples[i],dx=b.x-a.x,dz=b.z-a.z,len2=dx*dx+dz*dz;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/len2));const px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.distance){const len=Math.sqrt(len2);best={distance:d,road,x:px,z:pz,y:a.y+(b.y-a.y)*t,side:((x-px)*(-dz)+(z-pz)*dx)/len,tx:dx/len,tz:dz/len,grade:(b.y-a.y)/len};}}}return best;}
