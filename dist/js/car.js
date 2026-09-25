import * as T from '../vendor/three.module.js';
import {ackermannAngles} from './simulation.js?v=11';
import {RoundedBoxGeometry} from '../vendor/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from '../vendor/addons/utils/BufferGeometryUtils.js';

const geoCache=new Map();
const leather=new T.MeshStandardMaterial({color:'#172026',roughness:.94});
const rubber=new T.MeshStandardMaterial({color:'#111519',roughness:.88});
const satin=new T.MeshStandardMaterial({color:'#899396',roughness:.33,metalness:.8});
const darkMetal=new T.MeshStandardMaterial({color:'#263034',roughness:.4,metalness:.6});
const glass=new T.MeshPhysicalMaterial({color:'#24353b',metalness:.12,roughness:.055,clearcoat:1,envMapIntensity:1.8});
const led=new T.MeshStandardMaterial({color:'#eef9fc',emissive:'#d6f0ff',emissiveIntensity:.8});
const chrome=new T.MeshStandardMaterial({color:'#c6cdd0',metalness:1,roughness:.16});
function box(g,m,x,y,z,w,h,d,r=.03){const key=[w,h,d,r].join(',');if(!geoCache.has(key))geoCache.set(key,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)));const mesh=new T.Mesh(geoCache.get(key),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);return mesh;}
function rod(group,material,a,b,r=.025){const v=new T.Vector3().subVectors(b,a);const mesh=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),8),material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());mesh.castShadow=true;group.add(mesh);return mesh;}
function panel(group,mat,points){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));geo.setIndex([0,2,1,0,3,2]);geo.computeVertexNormals();const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;group.add(mesh);return mesh;}
function bodyGeometry(){if(geoCache.has('body'))return geoCache.get('body');
 const sections=[[-2.24,.69,.42,.71],[-2.14,.78,.36,.80],[-1.91,.86,.33,.89],[-1.53,.89,.32,.95],[-.90,.9,.31,1.01],[-.1,.91,.31,1.02],[.81,.9,.32,1.02],[1.4,.88,.35,.99],[1.91,.83,.39,.91],[2.18,.74,.47,.8]];
 const pos=[],uv=[],idx=[];for(const [z,w,b,t] of sections){const ring=[[-w*.87,b],[-w*.97,b+.09],[-w,t-.19],[-w*.97,t-.09],[-w*.86,t-.025],[-w*.58,t],[w*.58,t],[w*.86,t-.025],[w*.97,t-.09],[w,t-.19],[w*.97,b+.09],[w*.87,b]];ring.forEach(([x,y],i)=>{pos.push(x,y,z);uv.push(i/12,(z+2.24)/4.42);});}
 const n=12;for(let k=0;k<sections.length-1;k++)for(let j=0;j<n;j++){if(k>=4&&k<=6&&j>=4&&j<=6)continue;const a=k*n+j,b=k*n+(j+1)%n;idx.push(a,a+n,b,b,a+n,b+n);}for(let j=1;j<n-1;j++)idx.push(0,j,j+1);const base=(sections.length-1)*n;for(let j=1;j<n-1;j++)idx.push(base,base+j+1,base+j);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();geoCache.set('body',g);return g;
}
function pack(group){const bins=new Map();for(const mesh of [...group.children]){if(!mesh.isMesh)continue;mesh.updateMatrix();let geo=mesh.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(mesh.matrix);for(const key of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(key))geo.deleteAttribute(key);if(!geo.attributes.uv)geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));const key=mesh.material.uuid;if(!bins.has(key))bins.set(key,{material:mesh.material,geos:[]});bins.get(key).geos.push(geo);group.remove(mesh);}for(const {material,geos}of bins.values()){const merged=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());const mesh=new T.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}}
let plateMaterial;
function getPlate(){if(plateMaterial)return plateMaterial;const c=document.createElement('canvas');c.width=256;c.height=128;const a=c.getContext('2d');a.fillStyle='#e5e9de';a.fillRect(0,0,256,128);a.strokeStyle='#a9b6a5';a.strokeRect(4,4,248,120);a.fillStyle='#24432f';a.textAlign='center';a.font='25px sans-serif';a.fillText('里山 330',128,36);a.font='bold 53px sans-serif';a.fillText('さ 12-08',128,101);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;plateMaterial=new T.MeshStandardMaterial({map,roughness:.5});return plateMaterial;}

export function createCar(color='#b4bfc1',{player=false,van=false}={}){
 const root=new T.Group(),exterior=new T.Group(),interior=new T.Group(),fixed=new T.Group();root.add(exterior,interior);exterior.add(fixed);
 const paint=new T.MeshPhysicalMaterial({color,metalness:.76,roughness:.25,clearcoat:1,clearcoatRoughness:.12});
 const turnLights=[-1,1].map(()=>new T.MeshStandardMaterial({color:'#72521c',emissive:'#ffb02a',emissiveIntensity:0}));
 const tail=new T.MeshStandardMaterial({color:'#841b1f',emissive:'#e92217',emissiveIntensity:.32,roughness:.23,metalness:.15});
 const body=new T.Mesh(bodyGeometry(),paint);body.castShadow=body.receiveShadow=true;fixed.add(body);
 const tall=van?.15:0;
 // Separate windshield, side glazing and roof maintain a curved sedan silhouette.
 panel(fixed,glass,[[-.77,1.025,-.94],[.77,1.025,-.94],[.62,1.49+tall,-.29],[-.62,1.49+tall,-.29]]);
 panel(fixed,glass,[[.77,1.025,1.3],[-.77,1.025,1.3],[-.62,1.5+tall,.68],[.62,1.5+tall,.68]]);
 for(const s of [-1,1]){
  const points=[[s*.78,1.02,-.93],[s*.64,1.49+tall,-.28],[s*.65,1.50+tall,.7],[s*.78,1.02,1.31]];if(s>0)points.reverse();panel(fixed,glass,points);
  rod(fixed,paint,new T.Vector3(s*.78,1.005,-.94),new T.Vector3(s*.63,1.51+tall,-.27),.032);
  rod(fixed,paint,new T.Vector3(s*.78,1.015,1.31),new T.Vector3(s*.63,1.53+tall,.68),.042);
  rod(fixed,darkMetal,new T.Vector3(s*.795,1.04,1.00),new T.Vector3(s*.66,1.52+tall,.82),.026);
  rod(fixed,chrome,new T.Vector3(s*.798,1.026,-.94),new T.Vector3(s*.798,1.026,1.29),.012);
  box(fixed,paint,s*.985,1.02,-.61,.28,.14,.29,.06);box(fixed,chrome,s*.986,1.027,-.453,.19,.092,.012,.018);
  for(const z of [-.14,.95])box(fixed,chrome,s*.909,.95,z,.025,.035,.2,.014);
  box(fixed,darkMetal,s*.903,.665,.44,.012,.5,.009,.001);box(fixed,darkMetal,s*.87,.38,.05,.07,.065,2.77,.017);
  for(const z of [-1.39,1.35]){const arch=new T.Mesh(new T.TorusGeometry(.337,.025,6,30,Math.PI),darkMetal);arch.rotation.y=Math.PI/2;arch.rotation.z=Math.PI/2;arch.position.set(s*.91,.34,z);fixed.add(arch);}
 }
 const roof=box(exterior,paint,0,1.52+tall,.22,1.29,.075,1.02,.05);exterior.userData.roof=roof;
 // Recessed grille, projector lamps, DRL light guides and a split rear light bar.
 box(fixed,darkMetal,0,.58,-2.189,1.28,.22,.065,.055);for(let i=0;i<5;i++)box(fixed,satin,0,.495+i*.038,-2.229,1.18,.007,.012,.002);
 for(const s of [-1,1]){const lightBox=box(fixed,darkMetal,s*.584,.786,-2.057,.48,.14,.095,.035);lightBox.rotation.y=s*-.21;box(fixed,led,s*.60,.814,-2.113,.36,.026,.018,.01);for(const x of [.49,.62]){const lamp=new T.Mesh(new T.SphereGeometry(.045,14,10),led);lamp.scale.z=.3;lamp.position.set(s*x,.767,-2.109);fixed.add(lamp);}box(fixed,tail,s*.58,.834,2.095,.48,.075,.045,.025);box(fixed,tail,s*.79,.813,1.977,.03,.09,.25,.012);box(fixed,chrome,s*.64,.43,2.02,.19,.05,.12,.022);}
 box(fixed,tail,0,.84,2.161,.59,.026,.02,.008);box(fixed,darkMetal,0,.47,2.02,1.32,.13,.15,.04);box(fixed,darkMetal,0,.365,-2.09,1.43,.063,.21,.02);
 for(const [z,ry]of [[-2.247,Math.PI],[2.181,0]]){const p=new T.Mesh(new T.PlaneGeometry(.45,.225),getPlate());p.position.set(0,.608,z);p.rotation.y=ry;fixed.add(p);}
 box(fixed,chrome,0,.816,-2.191,.066,.042,.026,.012);box(fixed,chrome,0,.954,1.988,.07,.048,.016,.014);
 for(const [i,side]of [-1,1].entries()){box(fixed,turnLights[i],side*.73,.815,2.102,.14,.034,.025,.01);box(fixed,turnLights[i],side*.744,.782,-2.068,.11,.025,.025,.009);}
 pack(fixed);
 const wheels=[],front=[];
 for(const x of [-.9,.9])for(const z of [-1.39,1.35]){const pivot=new T.Group(),spin=new T.Group();pivot.position.set(x,.34,z);pivot.add(spin);exterior.add(pivot);const tire=new T.Mesh(new T.CylinderGeometry(.319,.319,.216,36,1),rubber);tire.rotation.z=Math.PI/2;spin.add(tire);const lip=new T.Mesh(new T.TorusGeometry(.242,.016,7,32),chrome);lip.rotation.y=Math.PI/2;lip.position.x=Math.sign(x)*.119;spin.add(lip);const disc=new T.Mesh(new T.CylinderGeometry(.223,.223,.22,28),darkMetal);disc.rotation.z=Math.PI/2;spin.add(disc);for(let j=0;j<10;j++){const a=j*Math.PI/5;const spoke=box(spin,satin,Math.sign(x)*.125,Math.sin(a)*.117,Math.cos(a)*.117,.013,.028,.205,.008);spoke.rotation.x=-a;}box(spin,chrome,Math.sign(x)*.134,0,0,.022,.063,.063,.02);pack(spin);wheels.push(spin);if(z<0)front.push(pivot);}
 let instruments,screen,navMap;
 if(player){
  const stitching=new T.MeshStandardMaterial({color:'#81878a',roughness:.9});
  box(interior,leather,0,1.477,.22,1.26,.026,1.01,.012);
  box(interior,leather,0,.35,.26,1.58,.035,2.2,.01);
  box(interior,leather,0,.9,-.56,1.73,.2,.55,.08);box(interior,leather,0,.82,-.23,1.68,.19,.18,.07);box(interior,satin,0,.875,-.129,1.54,.013,.021,.005);
  for(const x of [-.65,-.17,.14,.7]){box(interior,darkMetal,x,.936,-.261,.22,.06,.014,.015);for(let j=-1;j<=1;j++)box(interior,satin,x,.935+j*.014,-.251,.195,.003,.005,.001);}
  const console=box(interior,leather,-.22,.94,-.31,.38,.27,.13,.035);console.rotation.x=-.1;
  const c=document.createElement('canvas');c.width=512;c.height=240;const a=c.getContext('2d');a.fillStyle='#172b32';a.fillRect(0,0,512,240);a.strokeStyle='#36545b';a.lineWidth=20;for(const x of [70,245,430]){a.beginPath();a.moveTo(x,0);a.lineTo(x,240);a.stroke();}a.beginPath();a.moveTo(0,160);a.lineTo(512,160);a.stroke();a.strokeStyle='#9aca9b';a.lineWidth=7;a.beginPath();a.moveTo(245,220);a.lineTo(245,60);a.lineTo(430,60);a.stroke();a.fillStyle='#e3eee2';a.font='26px sans-serif';a.fillText('桜町',30,40);a.fillStyle='#d5eac1';a.beginPath();a.moveTo(245,144);a.lineTo(231,178);a.lineTo(259,178);a.closePath();a.fill();navMap=new T.CanvasTexture(c);navMap.colorSpace=T.SRGBColorSpace;const nav=new T.Mesh(new T.PlaneGeometry(.31,.155),new T.MeshBasicMaterial({map:navMap}));nav.position.set(-.22,.976,-.231);interior.add(nav);
  instruments=document.createElement('canvas');instruments.width=512;instruments.height=192;screen=new T.CanvasTexture(instruments);screen.colorSpace=T.SRGBColorSpace;
  box(interior,leather,.43,.992,-.61,.57,.25,.12,.08);const cluster=new T.Mesh(new T.PlaneGeometry(.5,.168),new T.MeshBasicMaterial({map:screen}));cluster.position.set(.43,.986,-.541);interior.add(cluster);
  for(const x of [-.44,.44]){const seat=new T.Group();interior.add(seat);if(x>0)interior.userData.driverSeat=seat;box(seat,leather,x,.45,.94,.6,.16,.66,.1);const back=box(seat,leather,x,.91,1.2,.57,.85,.16,.1);back.rotation.x=-.12;box(seat,leather,x,1.4,1.22,.29,.21,.15,.06);for(const dx of [-.21,.21])box(seat,stitching,x+dx,.52,.94,.006,.006,.5,.002);}
  const wheel=new T.Group();wheel.position.set(.43,.92,-.13);wheel.rotation.x=-.17;const ring=new T.Mesh(new T.TorusGeometry(.175,.019,12,56),leather);wheel.add(ring);box(wheel,leather,0,0,0,.17,.089,.045,.03);for(const s of [-1,1]){const sp=box(wheel,darkMetal,s*.105,0,0,.10,.038,.026,.008);sp.rotation.z=-s*.09;box(wheel,satin,s*.125,.015,.015,.09,.007,.01,.002);for(let j=0;j<2;j++)box(wheel,leather,s*.083,-.01+j*.014,.02,.026,.009,.008,.002);}box(wheel,darkMetal,0,-.093,0,.04,.13,.025,.01);box(wheel,satin,0,-.095,.014,.014,.12,.008,.004);box(wheel,satin,0,0,.032,.031,.018,.006,.008);interior.add(wheel);interior.userData.wheel=wheel;
  box(interior,leather,-.02,.54,.2,.24,.43,.68,.045);box(interior,darkMetal,-.02,.78,.05,.15,.05,.28,.028);box(interior,leather,-.02,.87,.03,.074,.18,.06,.029);
  for(const side of [-1,1]){box(interior,leather,side*.836,.82,.3,.075,.34,1.48,.045);box(interior,satin,side*.785,.92,-.07,.04,.018,.19,.009);}
 }
 function updateInstruments(state){if(!instruments)return;const a=instruments.getContext('2d');a.fillStyle='#091118';a.fillRect(0,0,512,192);for(const [cx,value,max,label]of [[116,Math.abs(state.speed)*3.6,160,'km/h'],[394,state.rpm,7000,'rpm']]){a.lineWidth=3;a.strokeStyle='#576c73';a.beginPath();a.arc(cx,99,72,Math.PI*.75,Math.PI*2.25);a.stroke();for(let i=0;i<=8;i++){const ang=Math.PI*.75+i/8*Math.PI*1.5;a.beginPath();a.moveTo(cx+Math.cos(ang)*62,99+Math.sin(ang)*62);a.lineTo(cx+Math.cos(ang)*70,99+Math.sin(ang)*70);a.stroke();}const angle=Math.PI*.75+Math.min(1,value/max)*Math.PI*1.5;a.strokeStyle='#abdbe1';a.lineWidth=3;a.beginPath();a.moveTo(cx,99);a.lineTo(cx+Math.cos(angle)*56,99+Math.sin(angle)*56);a.stroke();a.fillStyle='#afc8ca';a.font='16px sans-serif';a.textAlign='center';a.fillText(label,cx,144);}a.fillStyle='#d7edf0';a.textAlign='center';a.font='52px sans-serif';a.fillText(Math.round(Math.abs(state.speed)*3.6),253,102);a.font='25px sans-serif';a.fillText(state.gear,253,147);screen.needsUpdate=true;}
 let indicatorTime=0,nightLevel=0,braking=false;
 return {root,exterior,interior,wheels,front,tail,updateInstruments,adjustSeat(p){const seat=interior.userData.driverSeat;if(seat){seat.position.y=p.height;seat.position.z=-p.fore;}},setNight(value){nightLevel=value;led.emissiveIntensity=.15+value*2.6;tail.emissiveIntensity=braking?2.6:.12+value*.85;},animate(steer,speed,dt,brake,signal=0){indicatorTime+=dt;turnLights.forEach((m,i)=>m.emissiveIntensity=signal===[-1,1][i]&&indicatorTime%1<.5?3:0);const angles=ackermannAngles(steer);front.forEach(p=>p.rotation.y=-(p.position.x<0?angles.left:angles.right));wheels.forEach(w=>w.rotation.x-=speed*dt/.32);braking=brake;tail.emissiveIntensity=brake?2.6:.12+nightLevel*.85;if(interior.userData.wheel)interior.userData.wheel.rotation.z=-steer*15.9;}};
}
