import * as T from '../vendor/three.module.js';
import {createCar,createPerson,createTram} from './vehicle.js';
import {sampleRoad} from './world.js';
import {clamp} from './simulation.js';
export function createTraffic(scene,world){
 const cars=[],people=[];const colors=['#dadcd2','#879791','#455964','#b8afa0','#563c3b','#cbd6d7'];
 const town=world.roads.find(r=>r.id==='town-main');const west=world.roads.find(r=>r.id==='town-west');
 for(let i=0;i<18;i++){const road=i<6?town:i<9?west:i<13?world.rural:world.highway;const dir=i%2===0?1:-1;const model=createCar(colors[i%colors.length],{van:i%4===0});scene.add(model.root);model.interior.visible=false;cars.push({model,road,dir,d:road.length*(i*.173%1),speed:0,cruise:road.highway?17+i%3*2:road.area==='country'?8:5.6,wait:0,x:0,z:0,yaw:0});}
 for(let i=0;i<14;i++){const child=i===2||i===8;const person=createPerson(child);scene.add(person.root);const x=i%2===0?-6.4:6.5;const z=-140+i*21;people.push({...person,x,z,startX:x,startZ:z,direction:i%2?1:-1,phase:'walk',timer:i*2,triggered:false});}
 // Two crossing events are proximity-triggered and reset only once the car leaves.
 for(const [x,z]of [[-6.2,43],[6.3,-58]]){const p=createPerson(true);scene.add(p.root);people.push({...p,x,z,startX:x,startZ:z,direction:x<0?1:-1,phase:'waiting',timer:0,triggered:false,event:true});}
 const tram=createTram();scene.add(tram.root);tram.root.rotation.y=Math.PI/2;let tramX=-105,tramDir=1,tramWait=0;
 function update(dt,time,state,phase){
  for(const c of cars){const p=sampleRoad(c.road,c.d);const nx=-p.tz,nz=p.tx;const lane=c.road.highway?2.3:2.18;const targetX=p.x-nx*c.dir*lane,targetZ=p.z-nz*c.dir*lane;let targetSpeed=c.cruise;
   if(c.road.area==='town'){for(const q of world.intersections){if(Math.abs(targetX-q.x)>5)continue;const fwdZ=p.tz*c.dir;const approach=(q.z-targetZ)*fwdZ;const stopDist=approach-13;if(phase!=='green'&&stopDist> -1&&stopDist<38)targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,stopDist)*3.5));}}
   const fx=p.tx*c.dir,fz=p.tz*c.dir;
   for(const obstacle of [state,...cars]){if(obstacle===c)continue;if(Math.abs((obstacle.y||0)-p.y)>3)continue;const dx=obstacle.x-targetX,dz=obstacle.z-targetZ,along=dx*fx+dz*fz,lateral=Math.abs(dx*(-fz)+dz*fx);if(along>0&&along<25&&lateral<1.9)targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,along-6)*2.3));}
   for(const person of people){const dx=person.x-targetX,dz=person.z-targetZ,along=dx*fx+dz*fz,lateral=Math.abs(dx*(-fz)+dz*fx);if(along>0&&along<20&&lateral<2)targetSpeed=Math.min(targetSpeed,Math.sqrt(Math.max(0,along-4)*2.4));}
   c.speed+=clamp(targetSpeed-c.speed,-4*dt,1.4*dt);c.d+=c.dir*c.speed*dt;
   if(c.d>c.road.length||c.d<0){c.dir*=-1;c.d=clamp(c.d,0,c.road.length);c.speed=0;}
   c.x=targetX;c.z=targetZ;c.y=p.y;c.yaw=Math.atan2(-p.tx*c.dir,-p.tz*c.dir);c.model.root.position.set(c.x,p.y+.035,c.z);c.model.root.rotation.y=c.yaw;c.model.animate(0,c.speed,dt,targetSpeed<c.speed-.2);
  }
  for(const p of people){p.timer+=dt;if(p.event){if(p.phase==='waiting'&&Math.abs(state.z-p.z)<29&&Math.abs(state.z-p.z)>10&&Math.abs(state.x)<7&&Math.abs(state.speed)>1&&!p.triggered){p.phase='cross';p.triggered=true;p.timer=0;}if(p.phase==='cross'){p.x+=p.direction*2.5*dt;if(Math.abs(p.x)>6.5){p.phase='done';p.timer=0;}}if(p.phase==='done'&&Math.hypot(state.x-p.x,state.z-p.z)>90){p.x=p.startX;p.phase='waiting';p.triggered=false;}}else{p.z+=p.direction*.67*dt;if(p.z>140||p.z< -142)p.direction*=-1;}
   p.root.position.set(p.x,.12,p.z);p.root.rotation.y=p.event?(p.direction===1?-Math.PI/2:Math.PI/2):(p.direction===1?Math.PI:0);const walk=p.phase==='cross'||!p.event;for(let i=0;i<4;i++)p.limbs[i].rotation.x=walk?Math.sin(p.timer*(p.child?10:5)+i%2*Math.PI)*.45:0;
  }
  if(tramWait>0)tramWait-=dt;else{const prev=tramX;tramX+=tramDir*6*dt;for(const stop of [60,210])if((prev-stop)*(tramX-stop)<0)tramWait=4;}if(tramX>282||tramX< -145){tramDir*=-1;tramX=clamp(tramX,-145,282);}tram.root.position.set(tramX,.11,150.3);tram.root.rotation.y=tramDir===1?-Math.PI/2:Math.PI/2;
 }
 // Establish positions before the first collision/render pass.
 update(0,0,{x:Infinity,z:Infinity},'green');
 return {cars,people,tram,update,get tramState(){return {x:tramX,z:150.3,hx:5.5,hz:1.2};}};
}
