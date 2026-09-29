import * as T from '../vendor/three.module.js';
import {nearestRoad,sampleRoad} from './road-network.js?v=13';
export function createUrbanDistrict(scene,batch,m,network,colliders,sign,tree,house,streetLights,nightMaterials){
 const pavement=new T.MeshStandardMaterial({color:'#8c9292',roughness:.95}),stone=new T.MeshStandardMaterial({color:'#c1c5c4',roughness:.85}),office=new T.MeshStandardMaterial({color:'#8b9da3',metalness:.65,roughness:.2}),frame=new T.MeshStandardMaterial({color:'#434d54',metalness:.5,roughness:.35}),warm=new T.MeshStandardMaterial({color:'#dcc3a1',emissive:'#927440',emissiveIntensity:.16}),blue=new T.MeshStandardMaterial({color:'#234c68',roughness:.6}),orange=new T.MeshStandardMaterial({color:'#d47b40',roughness:.6});
 office.emissive.set('#a4bacf');nightMaterials.push({material:warm,day:.16,night:1.8},{material:office,night:.20});
 const colors=[m.walls[0],m.walls[1],stone,m.walls[3]],shopNames=['桜町銀行','駅前薬局','珈琲 日和','さくら書店','SATOYAMA HOTEL','暮らしの雑貨'];
 const reserved=(x,z)=>x>86&&x<154&&z>370&&z<432;
 function clear(x,z,w,d){if(reserved(x,z))return false;const r=nearestRoad(network.roads,x,z);if(r.distance<Math.max(w,d)/2+r.road.width/2+2.1)return false;return !colliders.some(c=>Math.abs(c.x-x)<c.hx+w/2+1.3&&Math.abs(c.z-z)<c.hz+d/2+1.3);}
 let index=0;
 function building(x,z,w,d,floors){if(!clear(x,z,w,d))return false;const h=floors*3.2+3.9,wall=colors[index%colors.length],isGlass=index%3===0;
  const collider={x,z,hx:w/2,hz:d/2,y:0,height:h+1.8,type:'building',objects:[]};colliders.push(collider);batch.owner=collider;batch.box(pavement,x,.06,z,w+2,.12,d+2);batch.box(wall,x,h/2,z,w,h,d);
  batch.box(frame,x,h+.1,z,w+.6,.25,d+.6);batch.box(stone,x,h+.65,z-1,w*.45,1.1,d*.4);batch.box(frame,x+2,h+1.4,z-1,2,.4,1.5);
  for(let f=1;f<=floors;f++){const y=f*3.2+1.4;batch.box(frame,x,y-1.25,z,w+.1,.12,d+.1);
   for(const side of [-1,1]){for(let col=-w/2+1.7;col<w/2-1;col+=2.9){const glass=(f+Math.round(col*4)+index)%7<3?warm:office;batch.box(glass,x+col,y,z+side*(d/2+.035),2.28,2.25,.06);if(!isGlass){batch.box(stone,x+col,y-1.18,z+side*(d/2+.45),2.65,.14,.85);batch.box(frame,x+col,y-.7,z+side*(d/2+.87),2.62,.8,.04);}}
    for(let col=-d/2+1.8;col<d/2-1;col+=3)batch.box(office,x+side*(w/2+.035),y,z+col,.06,2.15,2.3);
   }
  }
  const near=nearestRoad(network.roads,x,z),frontZ=Math.abs(near.z-z)>Math.abs(near.x-x),s=frontZ?Math.sign(near.z-z):Math.sign(near.x-x);
  if(frontZ){batch.box(office,x,1.8,z+s*(d/2+.06),w-.8,3.4,.12);batch.box(index%2?blue:orange,x,3.5,z+s*(d/2+.35),w+.4,.6,.65);if(index%2===0)sign(x,3.5,z+s*(d/2+.71),[shopNames[index%shopNames.length]],index%2?'#37586c':'#8a4d2f',Math.min(9,w-1),.55,s>0?0:Math.PI);}
  else{batch.box(office,x+s*(w/2+.06),1.8,z,.12,3.4,d-.8);batch.box(blue,x+s*(w/2+.35),3.5,z,.65,.6,d+.4);if(index%3===0)sign(x+s*(w/2+.71),3.5,z,[shopNames[index%shopNames.length]],'#37586c',Math.min(9,d-1),.55,s>0?Math.PI/2:-Math.PI/2);}
  batch.owner=null;index++;return true;
 }
 // Continuous street frontage: smaller parcels fill the old empty lawns.
 for(const r of network.roads){if(!['town','station'].includes(r.area))continue;for(let d=22;d<r.length-20;d+=19){const p=sampleRoad(r,d);if(network.junctions.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<21))continue;for(const side of [-1,1]){const parcelWidth=r.area==='station'?12+(index%3)*2:12,offset=r.width/2+Math.max(parcelWidth,12)/2+3.2,x=p.x-p.tz*side*offset,z=p.z+p.tx*side*offset;if(reserved(x,z))continue;
   if(r.area==='station')building(x,z,parcelWidth,12,3+index%8);
   else if(x>35&&x<138&&z>-145&&z<145&&index%3!==0)building(x,z,11,12,3+index%4);
   else if(clear(x,z,7.4,9.3))house(x,z,7.4,9.3,5.1+(index++%3)*.3,index);
  }}}
 // Fill the interior of residential blocks instead of leaving vacant grass lots.
 for(let x=-248;x<225;x+=24)for(let z=28;z<330;z+=26){if(z>270&&x>80)continue;if(clear(x,z,8,10))house(x,z,8,10,5.6,index++);}
 // A recognisable station, paved forecourt, covered entrance and raised platforms.
 const sx=122,sz=394;
 batch.box(pavement,sx,.03,375,63,.06,20);for(let x=93;x<153;x+=4)batch.box(stone,x,.067,375,.04,.012,20);
 const stationCollider={x:sx,z:sz,hx:25,hz:11.5,y:0,height:8.8,type:'building',objects:[]};colliders.push(stationCollider);batch.owner=stationCollider;
 batch.box(stone,sx,4.2,sz,50,8.4,23);batch.box(office,sx,4.4,382.43,47,6.5,.1);batch.box(frame,sx,8.5,sz,52,.3,25);batch.box(blue,sx,7.4,382.22,50,1.2,.3);
 sign(sx,7.45,382.02,['桜町駅  SAKURAMACHI'],'#183f5b',26,1.03,Math.PI);
 for(const x of [102,112,132,142])batch.box(frame,x,2.6,382.25,.15,5,.3);
 batch.box(frame,sx,4.9,378.5,54,.18,8);for(const x of [97,147])batch.box(stone,x,2.5,375,.3,5,.3);
 batch.owner=null;
 for(const x of [97,147]){tree(x,369,.8);batch.box(m.wood,x, .7,372,3.1,.18,.55);}
 // Station platforms/track sit above the intersecting streets with clear headroom.
 batch.box(stone,90,5.1,420,350,.6,13);for(const z of [417.2,418.7,422,423.5])batch.box(m.metal,90,5.47,z,350,.08,.08);
 for(let x=-65;x<259;x+=32){const r=nearestRoad(network.roads,x,420);if(r.distance>8)batch.box(stone,x,2.45,420,1.1,4.9,7);}
 batch.box(stone,sx,6.0,415,69,1.1,3.5);batch.box(frame,sx,9.3,415,74,.18,5.6);for(let x=92;x<=152;x+=15)batch.box(stone,x,7.4,415,.15,3.7,.15);
 for(let i=0;i<3;i++){const x=97+i*19;batch.box(stone,x,7.25,421.2,18,3.3,2.7);batch.box(blue,x,6.6,419.82,18,.32,.06);for(let w=-7;w<8;w+=2.8)batch.box(office,x+w,7.8,419.8,2.05,1.1,.07);batch.box(frame,x,9.02,421.2,18.3,.18,2.9);}
 // Street lights, shop canopies and trees reinforce the scale of the avenues.
 for(let x=-143;x<230;x+=24)for(const z of [351.5,368.5]){if(network.junctions.some(q=>Math.hypot(q.x-x,q.z-z)<13))continue;batch.box(frame,x,4.1,z,.12,8.2,.12);batch.box(frame,x+1,8.2,z,2,.08,.1);batch.box(m.lamp,x+1.8,8.15,z,.65,.1,.35);streetLights.push({x:x+1.8,y:7.9,z});}
 sign(73,3.4,347,['駅前通り'],'#315971',3.4,.65);sign(178,5.6,363,['← 桜町駅   駅前商店街 →'],'#275446',9,1.2,Math.PI);
 return {urbanBuildings:index,station:{x:sx,z:sz}};
}
