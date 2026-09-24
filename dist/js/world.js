import * as T from '../vendor/three.module.js';
import {createRoadNetwork,nearestRoad,sampleRoad} from './road-network.js';
import {createUrbanDistrict} from './urban.js';
import {renderRoadNetwork} from './road-renderer.js';
export {nearestRoad,sampleRoad} from './road-network.js';
export const WORLD_SEED = 427;
let seed = WORLD_SEED;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mat = (color, extra = {}) => new T.MeshStandardMaterial({color,roughness:.85,...extra});
const boxGeo = new T.BoxGeometry(1,1,1), cylinderGeo = new T.CylinderGeometry(1,1,1,8), sphereGeo = new T.SphereGeometry(1,10,8);
const tmp = new T.Object3D();
class Batch {
 constructor(scene){this.scene=scene;this.items=new Map();}
 add(geo,material,x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0){const key=geo.uuid+material.uuid+':'+Math.floor(x/100)+','+Math.floor(z/100);if(!this.items.has(key))this.items.set(key,{geo,material,matrices:[]});tmp.position.set(x,y,z);tmp.rotation.set(rx,ry,rz);tmp.scale.set(sx,sy,sz);tmp.updateMatrix();this.items.get(key).matrices.push(tmp.matrix.clone());}
 box(m,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0){this.add(boxGeo,m,x,y,z,sx,sy,sz,ry,rx,rz);}
 finish(){for(const {geo,material,matrices} of this.items.values()){const mesh=new T.InstancedMesh(geo,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.scene.add(mesh);}this.items.clear();}
}
function texture(kind){const c=document.createElement('canvas');c.width=c.height=128;const a=c.getContext('2d');a.fillStyle=kind==='road'?'#787c7a':kind==='roof'?'#adb2b0':'#b2b6a2';a.fillRect(0,0,128,128);for(let i=0;i<4500;i++){const b=80+rand()*145;a.fillStyle=`rgba(${b},${b},${b},${kind==='road'?.12:.06})`;a.fillRect(rand()*128,rand()*128,1+rand()*2,1+rand()*2);}if(kind==='roof'){a.strokeStyle='#535e6355';a.lineWidth=2;for(let i=0;i<128;i+=16){a.beginPath();a.moveTo(i,0);a.lineTo(i,128);a.stroke();a.beginPath();a.moveTo(0,i);a.lineTo(128,i);a.stroke();}}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function signTexture(lines,bg='#246247',fg='#f3f6e9',width=512,height=256){const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);ctx.strokeStyle=fg;ctx.lineWidth=5;ctx.strokeRect(10,10,width-20,height-20);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';lines.forEach((s,i)=>{ctx.font=`500 ${lines.length>1?(i===0?46:29):70}px sans-serif`;ctx.fillText(s,width/2,(i+.5)*height/lines.length,width-40)});return new T.CanvasTexture(c);}
function roofGeometry(){const v=[-1,0,-1,1,0,-1,0,.8,-1,-1,0,1,0,.8,1,1,0,1,-1,0,-1,0,.8,-1,-1,0,1,0,.8,-1,0,.8,1,-1,0,1,0,.8,-1,1,0,-1,0,.8,1,1,0,-1,1,0,1,0,.8,1];for(let i=0;i<v.length;i+=9){for(let k=0;k<3;k++){const temp=v[i+3+k];v[i+3+k]=v[i+6+k];v[i+6+k]=temp;}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();const uv=[];for(let i=0;i<v.length;i+=3)uv.push(v[i],v[i+2]);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;}
export function createWorld(scene,assets){
 seed=WORLD_SEED;
 const batch=new Batch(scene),colliders=[],signals=[];
 const network=createRoadNetwork();const {roads,rural,highway,hill,junctions}=network;
 const scaled=(source,x,y=x)=>{const map=source.map.clone();map.repeat.set(x,y);map.needsUpdate=true;const normalMap=source.normalMap?.clone();if(normalMap){normalMap.repeat.set(x,y);normalMap.needsUpdate=true;}return normalMap?{map,normalMap}:{map};};
 const roadMaps=scaled(assets.road,.22),wallMaps=scaled(assets.plaster,3,2),concreteMaps=scaled(assets.concrete,2,1),roofMaps=scaled(assets.roof,2.1,2.4);
 const materials={road:mat('#bdc0c2',{...roadMaps,normalScale:new T.Vector2(.45,.45),roughness:.92}),ground:mat('#a8b59b',{...scaled(assets.grass,880),normalScale:new T.Vector2(.28,.28)}),concrete:mat('#b3b1a7',{...concreteMaps,normalScale:new T.Vector2(.2,.2)}),curb:mat('#c6c9c1'),white:mat('#e0e1d4'),yellow:mat('#cda34f'),metal:mat('#82918c',{metalness:.65,roughness:.42}),dark:mat('#283336'),glass:mat('#72929a',{metalness:.82,roughness:.16}),wood:mat('#5d4d3d',{...scaled(assets.bark,2,3)}),leaf:[mat('#607445'),mat('#4c643d'),mat('#859560'),mat('#6b8750')],walls:[mat('#e4ddca',wallMaps),mat('#bec0b6',wallMaps),mat('#a79882',wallMaps),mat('#636967',wallMaps),mat('#d2cbc0',wallMaps)],roofs:[mat('#687878',{...roofMaps,normalScale:new T.Vector2(.6,.6),roughness:.7}),mat('#716659',{...roofMaps,normalScale:new T.Vector2(.6,.6)}),mat('#526263',{...roofMaps,normalScale:new T.Vector2(.6,.6),roughness:.65})]};
 materials.walls.forEach((m,i)=>m.color.multiplyScalar(i===3?1.45:2.0));
 const foliage=new T.MeshStandardMaterial({map:assets.leaves.map,alphaMap:assets.leaves.alphaMap,alphaTest:.42,side:T.DoubleSide,roughness:1,color:'#a3af88'});
 const leafPlane=new T.PlaneGeometry(1,1),branchGeo=new T.CylinderGeometry(.35,1,1,7);

 const ground=new T.Mesh(new T.PlaneGeometry(4400,4400),materials.ground);ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;scene.add(ground);
 const intersections=junctions.filter(j=>j.signal);
 materials.barrier=materials.concrete.clone();materials.barrier.side=T.DoubleSide;materials.curb.side=T.DoubleSide;
 materials.bank=mat('#a3ad86',{...scaled(assets.grass,.2),side:T.DoubleSide});
 renderRoadNetwork(scene,batch,materials,network);
 // The avenue carries a tram beside, rather than through, the driving lanes.
 for(const z of [151,149.5])batch.box(materials.metal,67,.1,z,460,.08,.08);
 for(let x=-160;x<300;x+=1.8)batch.box(materials.wood,x,.065,150.25,.22,.04,2.6);
 // Crosswalks, tactile tiles and stop lines.
 for(const q of intersections){for(const z of [-8,8])for(let x=-3.8;x<4;x+=1.15)batch.box(materials.white,q.x+x,.083,q.z+z,.65,.02,3.2);for(const x of [-7,7]){batch.box(materials.yellow,q.x+x,.25,q.z+7,1.2,.025,3.2);}batch.box(materials.white,q.x-2.35,.083,q.z+11,3.8,.02,.3);batch.box(materials.white,q.x+2.35,.083,q.z-11,3.8,.02,.3);}
 for(const q of intersections){for(const x of [-8,8])for(let z=-3.8;z<4;z+=1.15)batch.box(materials.white,q.x+x,.083,q.z+z,3.2,.02,.65);batch.box(materials.white,q.x+11,.083,q.z+2.35,.3,.02,3.8);batch.box(materials.white,q.x-11,.083,q.z-2.35,.3,.02,3.8);}
 const roofGeo=roofGeometry();
 function tree(x,z,size=1){
  const yaw=rand()*Math.PI*2;
  batch.add(branchGeo,materials.wood,x,2.0*size,z,.2*size,4*size,.2*size,yaw);
  for(let j=0;j<5;j++){const angle=yaw+j*2.4;batch.add(branchGeo,materials.wood,x+Math.cos(angle)*.5*size,2.8*size,z+Math.sin(angle)*.5*size,.09*size,2.4*size,.09*size,angle,Math.sin(angle)*.55,Math.cos(angle)*.55);}
  for(let j=0;j<27;j++){const a=j*2.399,rad=Math.sqrt((j+.5)/27)*2.3*size;const px=x+Math.cos(a)*rad,pz=z+Math.sin(a)*rad,py=(4.6+Math.sin(j*4.8)*.5-rad*.21)*size;batch.add(leafPlane,foliage,px,py,pz,2.3*size,2.1*size,1,a,Math.sin(j)*.75,Math.cos(j)*.45);}
 }
 function house(x,z,w=9,d=11,h=6.3,index=0){
  if(Math.abs(x-26)<16&&Math.abs(z+129)<13)return;
  if(colliders.some(c=>Math.abs(c.x-x)<c.hx+Math.max(w,d)/2+1&&Math.abs(c.z-z)<c.hz+Math.max(w,d)/2+1))return;
  const road=nearestRoad(roads,x,z);if(road.distance<Math.max(w,d)/2+road.road.width/2+3)return;
  const isModern=index%4===1,isShop=index%11===0;const wall=materials.walls[index%5],roof=materials.roofs[index%3];
  const yaw=Math.atan2(road.x-x,road.z-z);
  const cos=Math.cos(yaw),sin=Math.sin(yaw);
  const B=(m,px,py,pz,sx,sy,sz,ry=0,rx=0,rz=0)=>batch.box(m,x+px*cos+pz*sin,py,z-px*sin+pz*cos,sx,sy,sz,yaw+ry,rx,rz);
  const A=(geo,m,px,py,pz,sx,sy,sz,ry=0)=>batch.add(geo,m,x+px*cos+pz*sin,py,z-px*sin+pz*cos,sx,sy,sz,yaw+ry);
  B(materials.concrete,0,.24,0,w+.3,.46,d+.3);B(wall,0,h/2+.4,0,w,h,d);
  if(isModern){B(materials.dark,0,h+.4,0,w+.45,.2,d+.45);B(materials.walls[3],-w*.28,h*.65,0,w*.42,h*.73,d+.07);B(materials.concrete,0,h+.1,0,w+.5,.11,d+.5);}
  else{A(roofGeo,roof,0,h+.4,0,w*.56,2.5,d*.57);B(roof,0,h+2.45,0,.23,.22,d*1.15);for(const side of [-1,1])B(materials.dark,side*w*.56,h+.37,0,.13,.13,d*1.15);}
  const hx=Math.abs(cos)*w/2+Math.abs(sin)*d/2,hz=Math.abs(sin)*w/2+Math.abs(cos)*d/2;colliders.push({x,z,hx,hz,type:'building'});
  // Glazed sliding windows with recessed frames, curtains, sills and shutters.
  for(const side of [-1,1])for(const y of [2.0,4.75])for(const dx of [-w*.28,w*.27]){
   const ww=isModern?2.2:1.82,wh=y>3?1.42:1.7;
   B(materials.dark,dx,y,side*(d/2+.022),ww+.15,wh+.13,.09);B(materials.glass,dx,y,side*(d/2+.08),ww,wh,.035);
   B(materials.metal,dx,y,side*(d/2+.11),.043,wh,.027);B(materials.metal,dx,y-wh/2,side*(d/2+.15),ww+.2,.065,.3);
   if(index%3!==0)for(const v of [-1,1])B(materials.walls[(index+2)%5],dx+v*(ww/2-.24),y,side*(d/2+.10),.38,wh-.08,.014);
   if(!isModern)B(materials.wood,dx+ww*.72,y,side*(d/2+.12),.55,wh+.17,.095);
  }
  for(const side of [-1,1])for(const dz of [-d*.28,d*.23]){B(materials.dark,side*(w/2+.035),4.7,dz,.065,1.5,1.85);B(materials.glass,side*(w/2+.08),4.7,dz,.04,1.34,1.7);B(materials.metal,side*(w/2+.105),4.7,dz,.025,1.34,.04);}
  B(materials.wood,0,1.59,d/2+.07,1.28,2.37,.15);B(materials.dark,0,1.59,d/2+.15,.84,1.85,.022);for(let q=-3;q<=3;q++)B(materials.wood,q*.13,1.59,d/2+.18,.065,1.9,.035);
  B(materials.metal,.4,1.5,d/2+.21,.035,.36,.04);B(materials.concrete,0,.16,d/2+.7,2.3,.32,1.35);B(roof,0,2.91,d/2+.67,2.1,.14,1.45);
  // Rain gutter, downpipe, exterior lights and balcony.
  for(const side of [-1,1]){B(materials.metal,side*(w/2+.08),h*.5+.3,d*.43,.07,h,.08);B(materials.concrete,side*(w/2+1.4),.52,0,.2,1.04,d+2);}
  if(index%3===0){B(materials.dark,w*.17,3.85,d/2+.67,w*.6,.13,1.6);B(materials.dark,w*.17,4.4,d/2+1.4,w*.6,1.0,.11);for(let k=-2;k<=2;k++)B(materials.metal,w*.17+k*w*.105,4.4,d/2+1.48,.035,.85,.04);}
  B(materials.concrete,w/2+.48,.77,-d*.15,.86,.68,1.2);B(materials.metal,w/2+.93,.77,-d*.15,.026,.49,.99);for(let q=0;q<4;q++)B(materials.dark,w/2+.95,.59+q*.11,-d*.15,.01,.035,.85);
  B(materials.dark,-1.4,2.23,d/2+.13,.13,.32,.13);B(materials.white,-1.4,2.23,d/2+.2,.09,.22,.07);
  B(materials.wood,-w*.34,.73,d/2+1.1,.58,.38,.36);B(materials.metal,-w*.34,.32,d/2+1.1,.065,.58,.065);
  if(isShop){const fz=d/2+.8;sign(x+fz*sin,3.45,z+fz*cos,[[ 'さくらベーカリー','山田商店','里山珈琲'][Math.floor(index/11)%3]],'#344b4c',w*.75,.52,yaw);B(materials.dark,0,1.76,d/2+.11,w*.7,2.45,.07);B(materials.glass,0,1.76,d/2+.16,w*.64,2.2,.04);B(materials.roofs[1],0,3.14,d/2+.7,w*.89,.16,1.55);}
  const frontX=x+(d/2+2.2)*sin,frontZ=z+(d/2+2.2)*cos;tree(frontX-w*.42*cos,frontZ+w*.42*sin,.48);
 }

 let houseIndex=0;
 for(const x of [-19,20,-140,-179])for(let z=-128;z<=128;z+=28){house(x+(rand()-.5)*2,z,8+rand()*3,9+rand()*3,5.2+rand()*1.3,houseIndex++);if(houseIndex%2===0)tree(x+(x<0?-9:9),z+9,.9);}
 for(const z of [-184,184])for(let x=-130;x<-20;x+=27){house(x,z,9,10,5.6,houseIndex++);}
 for(let z=-125;z<=124;z+=40)for(const x of [-75,-110])house(x,z,11,12,6.2,houseIndex++);
 for(const x of [138,181,215,255])for(let z=-125;z<=125;z+=32)house(x,z,8.5,10,5.3,houseIndex++);
 for(let x=-115;x<=120;x+=28)house(x,308,9,11,5.6,houseIndex++);
 // Window shutters, balconies, storm drains and a few modern flat-roof houses.
 for(let z=-115;z<140;z+=28){for(const x of [-5.55,5.55]){batch.box(materials.dark,x,.227,z,.48,.015,.75);for(let k=-2;k<=2;k++)batch.box(materials.metal,x+k*.085,.241,z,.028,.01,.66);}batch.box(materials.concrete,-7,.23,z,1.6,.02,.07);batch.box(materials.concrete,7,.23,z,1.6,.02,.07);}
 for(let z=-125;z<135;z+=28){for(const side of [-1,1]){const x=side*10.2;for(let q=-4;q<=4;q++)batch.box(materials.wood,x,1.02,z+q*.35,.08,1.65,.08);batch.box(materials.wood,x,1.45,z,.09,.075,3.1);batch.box(materials.wood,x,.56,z,.09,.075,3.1);}}
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
 for(const z of [78,65]){const mark=new T.Mesh(new T.RingGeometry(.7,.82,4),materials.white);mark.rotation.x=-Math.PI/2;mark.rotation.z=Math.PI/4;mark.scale.set(.7,1.45,1);mark.position.set(-2.2,.09,z);scene.add(mark);}
 speedSign(-5.5,68,'30');speedSign(-5.5,-226,'40');speedSign(291,-525,'80',Math.PI);
 sign(-.3,6.7,-99,['↑ 里山   Satoyama','← 桜町駅    高速入口 →'],'#2b6258',7,2.2);batch.add(cylinderGeo,materials.metal,5.8,3.9,-99,.095,7.8,.095);batch.box(materials.metal,2.7,7.9,-99,6.6,.13,.13);
 sign(295,6.8,110,['E8  里山自動車道','SATOYAMA EXPRESSWAY  ↑'],'#297054',7,2.1);batch.add(cylinderGeo,materials.metal,289.5,4,110,.11,8,.11);batch.box(materials.metal,293.2,8.1,110,7.6,.18,.16);
 sign(-7,2.6,-53,['通学路'],'#efdc72',1.1,.9);batch.add(cylinderGeo,materials.metal,-7,1.3,-53,.04,2.6,.04);
 // Horizontal Japanese traffic lights; shared state drives geometry and rules.
 for(const q of intersections)for(const axis of ['z','x']){const group=new T.Group();group.rotation.y=axis==='x'?Math.PI/2:0;group.position.set(q.x,0,q.z);for(const side of [-1,1]){const x=side*5.7,z=side*-6;const pole=new T.Mesh(new T.CylinderGeometry(.09,.09,6.5,8),materials.metal);pole.position.set(x,3.25,z);group.add(pole);const arm=new T.Mesh(new T.BoxGeometry(4,.1,.1),materials.metal);arm.position.set(x-side*1.9,6.2,z);group.add(arm);const head=new T.Mesh(new T.BoxGeometry(1.55,.52,.42),materials.dark);head.position.set(x-side*3.5,6,z);group.add(head);const lights=[];for(let i=0;i<3;i++){const material=new T.MeshBasicMaterial({color:0x193e2e});const bulb=new T.Mesh(new T.SphereGeometry(.17,12,8),material);bulb.scale.z=.5;bulb.position.set(head.position.x+(i-1)*.43,6,z+side*.25);group.add(bulb);lights.push(material);}signals.push({x:q.x,z:q.z,axis,direction:side,lights,phase:0});}scene.add(group);}
 for(const stop of network.stops){const q={x:stop.x,z:stop.z};q[stop.axis]-=stop.dir*stop.offset;const other=stop.axis==='x'?'z':'x',lane=stop.axis==='z'?stop.dir*2.2:-stop.dir*2.2;q[other]+=lane;batch.box(materials.white,q.x,.08,q.z,stop.axis==='z'?3.8:.3,.02,stop.axis==='z'?.3:3.8);const pole={...q};pole[other]+=Math.sign(lane)*3.9;batch.add(cylinderGeo,materials.metal,pole.x,1.65,pole.z,.055,3.3,.055);const c=document.createElement('canvas');c.width=c.height=256;const a=c.getContext('2d');a.fillStyle='#bd302c';a.beginPath();a.moveTo(16,24);a.lineTo(240,24);a.lineTo(128,235);a.closePath();a.fill();a.strokeStyle='#fff';a.lineWidth=9;a.stroke();a.fillStyle='white';a.textAlign='center';a.font='bold 49px sans-serif';a.fillText('止まれ',128,91);a.font='32px sans-serif';a.fillText('STOP',128,135);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const sg=new T.Mesh(new T.PlaneGeometry(.98,.98),new T.MeshBasicMaterial({map:tex,transparent:true,side:T.DoubleSide}));sg.position.set(pole.x,3.25,pole.z);sg.rotation.y=stop.axis==='x'?-stop.dir*Math.PI/2:stop.dir===1?Math.PI:0;scene.add(sg);}
 const urban=createUrbanDistrict(scene,batch,materials,network,colliders,sign,tree,house);
 // Rural fields, irrigation channels, orchards and distant mountain ridges.
 const water=mat('#679798',{metalness:.4,roughness:.18});const fields=[mat('#a1a966'),mat('#809557'),mat('#9bab63'),mat('#91a264')];
 for(let x=-220;x<=215;x+=50)for(let z=-585;z< -235;z+=48){const n=nearestRoad(roads,x,z);if(n.distance<35)continue;batch.box(fields[Math.floor(rand()*4)],x,.0,z,44,.06,42);batch.box(water,x+24,.01,z,1.2,.03,46);for(let j=-19;j<21;j+=3)batch.box(materials.leaf[3],x+j,.13,z,.18,.15,40);}
 for(let i=0;i<200;i++){const x=-300+rand()*850,z=-790+rand()*1120;const n=nearestRoad(roads,x,z);if(n.distance<Math.max(15,n.y*1.5+8)||colliders.some(c=>Math.abs(c.x-x)<c.hx+3&&Math.abs(c.z-z)<c.hz+3))continue;if(x>-190&&x<35&&z>-210&&z<210)continue;tree(x,z,.8+rand()*1.3);}
 const mountains=new T.PlaneGeometry(4200,4200,110,110);mountains.rotateX(-Math.PI/2);const mp=mountains.attributes.position;
 for(let i=0;i<mp.count;i++){const x=mp.getX(i),z=mp.getZ(i)-220;const edge=Math.max(Math.abs(x-70)-600,Math.abs(z+200)-820);const blend=T.MathUtils.smoothstep(edge,0,420);const broad=Math.sin(x*.0032+Math.cos(z*.002))*Math.cos(z*.0034);const detail=Math.sin(x*.011+z*.007)*Math.sin(z*.009-x*.005);mp.setXYZ(i,x,blend*(180+135*broad+45*detail)-.2,z);}mountains.computeVertexNormals();const mountainMesh=new T.Mesh(mountains,mat('#637667',{map:scaled(assets.grass,180).map,roughness:1}));mountainMesh.receiveShadow=true;scene.add(mountainMesh);

 // Small rural houses and a torii beside the scenic route.
 for(let i=0;i<7;i++)house(-132-i%2*22,-285-i*42,9,11,5.3,houseIndex++);
 const red=mat('#a64830');for(const x of [-30,-24])batch.add(cylinderGeo,red,x,3.1,-527,.26,6.2,.26);batch.box(red,-27,5.6,-527,9,.38,.48);batch.box(materials.dark,-27,6.35,-527,10,.35,.8);
 for(let z=-510;z<=-492;z+=3)batch.box(materials.concrete,-27,.1,z,4,.2,2);
 batch.finish();
 const grid=new Map();for(const c of colliders){for(let x=Math.floor((c.x-c.hx)/20);x<=Math.floor((c.x+c.hx)/20);x++)for(let z=Math.floor((c.z-c.hz)/20);z<=Math.floor((c.z+c.hz)/20);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(c);}}
 return {...network,urban,buildingCount:colliders.filter(c=>c.type==='building').length,roads,signals,colliders,grid,materials,rural,highway,hill,intersections};
}
