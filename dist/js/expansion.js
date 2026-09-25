import * as T from '../vendor/three.module.js';
import {nearestRoad,sampleRoad} from './road-network.js?v=11';
import {WATER_LEVEL,riverCenter,riverWidth,waterDistance,isWater} from './waterways.js?v=11';
import {createCar} from './vehicle.js?v=11';
import {GARAGE} from './parking.js?v=11';
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.75,...extra});
const unit=new T.BoxGeometry(1,1,1),bloomGeo=new T.IcosahedronGeometry(1,1),cone=new T.ConeGeometry(1,1,7),trunk=new T.CylinderGeometry(.45,1,1,7);
export function createExpansion(scene,batch,m,network,colliders,sign,streetLights,nightMaterials,assets){
 const petals=new T.MeshStandardMaterial({map:blossomTexture(),alphaTest:.32,side:T.DoubleSide,roughness:1}),petalPlane=new T.PlaneGeometry(1,1);
 let seed=915;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const stone=mat('#c9c7b9'),teal=mat('#235b63'),timber=mat('#86664c'),roof=mat('#36474d'),glass=mat('#8bc1cd',{metalness:.6,roughness:.17}),pink=mat('#edbacf'),pinkLight=mat('#f1d4dc'),evergreen=mat('#456b62'),purple=mat('#a78dc3'),petal=mat('#e3c5ee');
 nightMaterials.push({material:glass,night:.27});glass.emissive.set('#ecd6ad');
 function solid(material,x,y,z,w,h,d,type='structure'){const collider={x,z,hx:w/2,hz:d/2,y:y-h/2,height:h,type};colliders.push(collider);const previous=batch.owner;batch.owner=collider;batch.box(material,x,y,z,w,h,d);batch.owner=previous;}
 // A landscaped mall with a glass atrium, shopfronts and a timber entrance canopy.
 const mall={x:435,z:-274,hx:42,hz:27,y:0,height:18,type:'building',objects:[]};colliders.push(mall);batch.owner=mall;
 batch.box(stone,435,8,-274,84,16,54);batch.box(roof,435,16.3,-274,88,.6,58);
 for(const side of [-1,1])for(let x=398;x<477;x+=6){batch.box(glass,x,5.7,-274+side*27.06,5.4,8.8,.14);batch.box(timber,x+2.9,7.6,-274+side*27.18,.3,15,.3);batch.box(roof,x,2.8,-274+side*27.2,5.6,.18,.25);}
 batch.box(glass,435,9,-246.5,24,13,.2);batch.box(timber,435,6.5,-240,44,.48,14);for(const x of [415,455])batch.box(timber,x,3.2,-235,.55,6.4,.55);
 sign(435,13.6,-246.1,['SAKURA TERRACE'],'#264e52',47,3.2);sign(435,5.1,-232.8,['桜テラス  ·  SHOPPING & DINING'],'#264e52',29,1.5);
 sign(435,12.5,-301.15,['SAKURA TERRACE'],'#264e52',43,3,Math.PI);
 for(const x of [410,432,456])batch.box(m.concrete,x,17.2,-280,9,1.3,6);batch.owner=null;
 // Plaza paving, planter beds and light strips sit outside the through lanes.
 batch.box(stone,435,.02,-229,100,.035,22);for(const x of [396,473]){batch.box(roof,x,.5,-229,6,1,7);batch.add(bloomGeo,pink,x,3.2,-229,3,2.6,3);batch.box(timber,x,1.5,-229,.3,3,.3);}
 for(const x of [406,422,448,464]){batch.box(timber,x,.55,-219,5,.18,.65);batch.box(roof,x-1.9,.25,-219,.2,.5,.6);batch.box(roof,x+1.9,.25,-219,.2,.5,.6);}
 // Open-sided, four-storey parking. Continuous paired lanes climb at 5.7%.
 const g=GARAGE,deckMat=mat('#797e7e'),stripe=mat('#f1eee0'),guard=mat('#c2ccc7');
 for(let level=0;level<g.levels;level++){
  const y=.04+level*g.height;
  batch.box(deckMat,446,y-.18,-385,52,.36,100);
  for(const z of [-427.5,-342.5])batch.box(deckMat,482,y-.18,z,20,.36,15);
  if(level<3)for(const z of [-417,-385,-351]){batch.box(m.lamp,446,y+3.72,z,2,.1,.3);streetLights.push({x:446,y:y+3.5,z,indoor:true});}
  for(const [x,dir]of [[439,-1],[451,1]])for(const z of [-411,-388,-363]){batch.box(stripe,x,y+.025,z,.18,.025,3);for(const side of [-1,1])batch.box(stripe,x+side*.35,y+.025,z+dir*1.3,.13,.025,1,side*-dir*.7);}
  // Open entry only on 1F. Upper floors are enclosed by parapets.
  for(const z of [-435,-335])solid(guard,456,y+.55,z,72,1.1,.35);
  if(level){solid(guard,420,y+.55,-385,.35,1.1,100);}else{solid(guard,420,y+.55,-405.5,.35,1.1,59);solid(guard,420,y+.55,-349.5,.35,1.1,29);}
  for(const x of [427,459])for(let z=-423;z<=-343;z+=20){if(level<3)solid(stone,x,y+2,z,.6,4,.6);}
  for(let z=-428;z<-340;z+=5.3){for(const x of [424.5,467]){batch.box(stripe,x,y+.025,z,7,.035,.1);batch.box(roof,x,y+.13,z+2.2,3,.18,.17);}}
  if(level<3){
   const geometry=new T.BufferGeometry(),z0=g.rampZ0,z1=g.rampZ1,x0=g.rampX0,x1=g.rampX1;
   geometry.setAttribute('position',new T.Float32BufferAttribute([x0,y+4,z0,x1,y+4,z0,x0,y,z1,x1,y,z1],3));geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();const ramp=new T.Mesh(geometry,deckMat);ramp.receiveShadow=true;scene.add(ramp);
   for(let z=z0;z<z1;z+=3){const ry=y+(z1-z)/70*4;batch.box(stripe,482,ry+.03,z,.13,.025,1.7,0,Math.atan(4/70));}
   // Ramps have their own height-aware side guards, not a solid wall across exits.
   for(const x of [473,491])for(let z=-418;z<-351;z+=4){const ry=y+(-350-z)/70*4;solid(guard,x,ry+.48,z,.22,.96,4.02);}
  }
  for(const [x,z,yaw,color]of [[426,-407,-Math.PI/2,'#c6c6b9'],[466,-391,Math.PI/2,'#658897']]){const parked=createCar(color);parked.root.position.set(x,y+.03,z);parked.root.rotation.y=yaw;parked.interior.visible=false;scene.add(parked.root);colliders.push({x,z,y,hx:.88,hz:2.2,yaw,height:1.8,type:'parked-car',objects:[parked.root]});}
  for(const z of [-427,-343]){sign(444,y+2.4,z,[level===3?'RF  SKY PARK':`${level+1}F  PARKING`],'#285c60',11,1.8,z<-400?0:Math.PI);}
 }
 for(let z=-430;z<-335;z+=12){solid(guard,492,6.2,z,.35,12.4,.6);}
 sign(419.7,3,-370,['P  IN  →'],'#28605f',9,2,-Math.PI/2);sign(478,3,-344,['↑ 2F / 3F / RF'],'#28605f',11,1.5);
 sign(452,14.6,-334.6,['P  SAKURA TERRACE'],'#28605f',41,2.4);sign(408,2.6,-375,['立体駐車場  10 km/h'],'#28605f',10,1.3,-Math.PI/2);
 // One-way entrances and direction markers.
 for(let d=35;d<network.mallRoad.length;d+=135){const p=sampleRoad(network.mallRoad,d),x=p.x-p.tz*7,z=p.z+p.tx*7,yaw=Math.atan2(-p.tx,-p.tz);batch.box(m.metal,x,1.6,z,.09,3.2,.09);sign(x,3,z,['一方通行 →'],'#285f96',3.2,.85,yaw);}
 // River bridges: open underneath, with piers and railings on both banks.
 for(const road of [network.coast])for(let d=3;d<road.length;d+=5){const p=sampleRoad(road,d);if(p.y<4||waterDistance(p.x,p.z)>24)continue;const yaw=Math.atan2(-p.tx,-p.tz);for(const side of [-1,1]){const x=p.x-p.tz*side*(road.width/2-.16),z=p.z+p.tx*side*(road.width/2-.16);batch.box(guard,x,p.y+.75,z,.13,.13,5.2,yaw);batch.box(guard,x,p.y+.35,z,.13,.09,5.2,yaw);batch.box(guard,x,p.y+.45,z,.12,.9,.12);colliders.push({x,z,hx:.2,hz:2.5,yaw,y:p.y,height:.9,type:'bridge-rail',indestructible:true});}if(Math.floor(d)%25<5)batch.box(stone,p.x,(p.y-4)/2,p.z,2,p.y+4,2);}
 // Marina: quay, boardwalk, piers, striped bollards and a small harbour office.
 batch.box(stone,876,-.18,350,52,.4,52);batch.box(timber,915,-.05,350,64,.3,5);
 for(const z of [326,374]){batch.box(timber,931,-.18,z,5,.25,43);for(let i=0;i<4;i++)batch.add(trunk,timber,931,-2,z-18+i*12,.16,4,.16);}
 for(const z of [330,340,360,370]){batch.add(trunk,roof,900,.25,z,.18,.7,.18);batch.add(trunk,m.white,900,.4,z,.19,.2,.19);}
 const office={x:860,z:330,hx:7,hz:5,y:0,height:4,type:'building',objects:[]};colliders.push(office);batch.owner=office;batch.box(timber,860,2,330,14,4,10);batch.box(roof,860,4.2,330,16,.3,12);batch.box(glass,860,2.2,335.1,11,2.6,.1);sign(860,3.5,335.2,['SATOYAMA MARINA'],'#24595c',12,1.1);batch.owner=null;
 sign(884,2.8,346,['水上変形  →'],'#24595c',5,1.1);sign(866,2.2,364,['海へ、川へ。'],'#24595c',6,1.2);
 batch.box(stone,894,-.13,410,28,.3,13);const slip=new T.BufferGeometry();slip.setAttribute('position',new T.Float32BufferAttribute([906,.03,403,906,.03,417,920,-2,403,920,-2,417],3));slip.setIndex([0,1,2,2,1,3]);slip.computeVertexNormals();const ramp=new T.Mesh(slip,stone);ramp.receiveShadow=true;scene.add(ramp);sign(895,2.6,401,['水上変形 → 海へ'],'#24595c',8,1.2);for(const z of [402,418])batch.box(m.white,900,.06,z,13,.025,.14);
 // Instanced flowering trees follow the real road surface, leaving the carriageway clear.
 function sakura(x,y,z,size=1){batch.add(trunk,timber,x,y+2.6*size,z,.25*size,5.2*size,.25*size);for(let k=0;k<5;k++){const a=k*2.4;batch.add(trunk,timber,x+Math.cos(a)*.8*size,y+3.7*size,z+Math.sin(a)*.8*size,.12*size,3.5*size,.12*size,a,Math.sin(a)*.75,Math.cos(a)*.75);}for(let k=0;k<38;k++){const a=k*2.399,rad=Math.sqrt((k+.5)/38)*3.5*size;batch.add(petalPlane,petals,x+Math.cos(a)*rad,y+(5.6+Math.sin(k*3)*.7-rad*.13)*size,z+Math.sin(a)*rad,2.65*size,2.4*size,1,a,Math.sin(k)*.95,Math.cos(k)*.6);}}

 for(const road of [network.rural,network.mountain])for(let d=35;d<road.length-20;d+=21){const p=sampleRoad(road,d);for(const side of [-1,1]){const x=p.x-p.tz*side*9.5,z=p.z+p.tx*side*9.5;if(nearestRoad(network.roads,x,z).distance<8)continue;sakura(x,Math.max(0,p.y-(9.5-road.width/2)/1.5),z,.9+random()*.5);}}
 // Flower meadows and cedars: shared geometry/material batches, no per-flower objects.
 const flowerCenters=[[-145,-425],[-120,-590],[-565,-600],[-590,-840],[-270,-890],[550,-920],[770,420]];
 for(const [cx,cz]of flowerCenters)for(let i=0;i<300;i++){const x=cx+(random()-.5)*90,z=cz+(random()-.5)*70,n=nearestRoad(network.roads,x,z);if(n.distance<12||isWater(x,z)||n.y>2&&n.distance<n.y*1.5+8)continue;const h=.16+random()*.28;batch.add(bloomGeo,i%3?purple:petal,x,h,z,.35,h,.35,random()*6);}
 for(let i=0;i<190;i++){const x=-900+random()*750,z=-1120+random()*480,n=nearestRoad(network.roads,x,z);if(n.distance<12)continue;const y=Math.max(0,n.y-Math.max(0,n.distance-n.road.width/2)/1.5),h=8+random()*10;batch.add(trunk,timber,x,y+h*.35,z,.32,h*.7,.32);batch.add(cone,evergreen,x,y+h*.65,z,h*.27,h*.72,h*.27);}
 for(const road of [network.coast,network.mallRoad])for(let d=40;d<road.length;d+=65){const p=sampleRoad(road,d),x=p.x+p.tz*(road.width/2+1.8),z=p.z-p.tx*(road.width/2+1.8);batch.box(roof,x,p.y+3.8,z,.11,7.6,.11);batch.box(m.lamp,x,p.y+7.5,z,1.4,.13,.4);streetLights.push({x,y:p.y+7.2,z});}
 // Scenic overlook rests on the high pass; no solid obstacles across the road.
 const lookout=sampleRoad(network.mountain,network.mountain.length*.54);sign(lookout.x-8,lookout.y+3,lookout.z,['雲見峠  ·  海を望む道'],'#315b59',10,1.8);
 for(let d=0;d<network.mountain.length;d+=5){const p=sampleRoad(network.mountain,d),yaw=Math.atan2(-p.tx,-p.tz);for(const side of [-1,1]){const x=p.x-p.tz*side*4.4,z=p.z+p.tx*side*4.4;batch.box(guard,x,p.y+.65,z,.1,.22,5.15,yaw,Math.atan(p.grade));batch.box(guard,x,p.y+.35,z,.1,.7,.1);}}
 const water=createWater(scene),ambience=createValleyAtmosphere(scene);
 return {update(time,sky,state){water.update(time);ambience.update(time,sky,state);},mall,garage:GARAGE};
}
function createWater(scene){
 const material=new T.MeshStandardMaterial({color:'#247f89',metalness:.48,roughness:.21,side:T.DoubleSide});let shader;
 material.onBeforeCompile=s=>{shader=s;s.uniforms.waterTime={value:0};s.vertexShader='varying vec3 waterPos;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n waterPos=position;');s.fragmentShader='uniform float waterTime; varying vec3 waterPos;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float wave=sin(waterPos.x*.42+waterTime*1.4+sin(waterPos.z*.25))*sin(waterPos.z*.7-waterTime*.7);
 diffuseColor.rgb*=.86+.16*wave;
 diffuseColor.rgb+=vec3(.32,.48,.42)*pow(max(0.,wave),12.)*.5;`).replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
 normal=normalize(normal+vec3(sin(waterPos.x*.2+waterTime)*.14,cos(waterPos.z*.31-waterTime*.7)*.13,0.));`);};
 const pos=[],indices=[];
 function quad(x0,z0,x1,z1,x2,z2,x3,z3){const b=pos.length/3;pos.push(x0,WATER_LEVEL,z0,x1,WATER_LEVEL,z1,x2,WATER_LEVEL,z2,x3,WATER_LEVEL,z3);indices.push(b,b+2,b+1,b,b+3,b+2);}
 quad(910,-2200,2200,-2200,2200,2200,910,2200);quad(600,660,910,660,910,840,600,840);
 for(let z=-1120;z<820;z+=10){const a=riverCenter(z),b=riverCenter(z+10),wa=riverWidth(z),wb=riverWidth(z+10);quad(a-wa,z,a+wa,z,b+wb,z+10,b-wb,z+10);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);
 return {update(time){if(shader)shader.uniforms.waterTime.value=time;}};
}
function createValleyAtmosphere(scene){
 const mistMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},strength:{value:.12}},vertexShader:'varying vec2 uvMist; void main(){uvMist=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uvMist;uniform float time,strength;void main(){vec2 p=uvMist;float fade=sin(p.x*3.14159)*sin(p.y*3.14159);float w=.55+.2*sin(p.x*24.+time*.2)+.15*sin(p.x*43.-p.y*5.-time*.12);gl_FragColor=vec4(.72,.83,.8,pow(max(fade,0.),2.)*w*strength);}' }),mist=[];for(const [x,z]of [[-135,-410],[-120,-580],[520,-790],[700,-445]]){const mesh=new T.Mesh(new T.PlaneGeometry(140,7),mistMaterial);mesh.position.set(x,3,z);scene.add(mesh);mist.push(mesh);}
 const positions=new Float32Array(220*3);for(let i=0;i<220;i++){const z=-680+(i%110)*4;positions[i*3]=i<110?-145+Math.sin(i*3)*45:riverCenter(z)-riverWidth(z)-7;positions[i*3+1]=.6+(i%9)*.35;positions[i*3+2]=z;}
 const base=positions.slice(),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));const m=new T.PointsMaterial({color:'#e4ffd0',size:.25,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});const lights=new T.Points(g,m);scene.add(lights);
 return {update(time,sky,state){mistMaterial.uniforms.time.value=time;mistMaterial.uniforms.strength.value=.12+sky.twilight*.22;for(const mesh of mist)mesh.rotation.y=state.yaw;m.opacity=.75*sky.night;lights.visible=sky.night>.08;for(let i=0;i<220;i++){positions[i*3+1]=base[i*3+1]+Math.sin(time*.8+i)*.65;positions[i*3]=base[i*3]+Math.sin(time*.23+i*3)*1.8;}g.attributes.position.needsUpdate=true;}};
}
// A single reusable blossom atlas: many tiny petals with a broken, organic edge.
function blossomTexture(){const c=document.createElement('canvas');c.width=c.height=512;const a=c.getContext('2d');let seed=34;const r=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<1050;i++){const angle=r()*Math.PI*2,rad=Math.sqrt(r())*220*(.8+.2*Math.sin(angle*5)),x=256+Math.cos(angle)*rad,y=256+Math.sin(angle)*rad,sz=3+r()*6;for(let k=0;k<5;k++){const t=k*Math.PI*.4;a.save();a.translate(x,y);a.rotate(t);a.fillStyle=['#f8e2ec','#e8b6cb','#fff0ee','#d49cb5'][Math.floor(r()*4)];a.beginPath();a.ellipse(0,-sz*.7,sz*.58,sz,0,0,Math.PI*2);a.fill();a.restore();}a.fillStyle='#ad6281';a.beginPath();a.arc(x,y,sz*.19,0,Math.PI*2);a.fill();}const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;return texture;}
