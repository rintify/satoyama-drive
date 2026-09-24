import * as T from '../vendor/three.module.js';
import {createCar,createPerson,createTram} from './vehicle.js';
import {createAgent,positionAgent,stepTraffic,seedFollowers} from './traffic-ai.js';
import {clamp} from './simulation.js';
export function createTraffic(scene,world){
 const cars=[],people=[];const colors=['#dadcd2','#879791','#455964','#b8afa0','#563c3b','#cbd6d7'];
 const counts=[5,5,4,10,4,3];
 world.routes.forEach((route,r)=>{for(let i=0;i<counts[r];i++){const model=createCar(colors[(i+r)%colors.length],{van:i%4===0});scene.add(model.root);model.interior.visible=false;const c=createAgent(route,route.length*(i+.25)/counts[r],i%2?1:-1,route.id==='express-circuit'?19+i%4*1.4:11+i%3);c.model=model;positionAgent(c,world.roads);cars.push(c);}});
 for(let i=0;i<14;i++){const child=i===2||i===8;const person=createPerson(child);scene.add(person.root);const x=i%2===0?-6.4:6.5;const z=-140+i*21;people.push({...person,x,z,startX:x,startZ:z,direction:i%2?1:-1,phase:'walk',timer:i*2,triggered:false});}
 // Two crossing events are proximity-triggered and reset only once the car leaves.
 for(const [x,z]of [[-6.2,43],[6.3,-58]]){const p=createPerson(true);scene.add(p.root);people.push({...p,x,z,startX:x,startZ:z,direction:x<0?1:-1,phase:'waiting',timer:0,triggered:false,event:true});}
 const tram=createTram();scene.add(tram.root);tram.root.rotation.y=Math.PI/2;let tramX=-105,tramDir=1,tramWait=0;
 function update(dt,time,state,phase){
  stepTraffic(cars,dt,state,world.roads,world.junctions,people,phase);
  for(const c of cars){c.model.root.position.set(c.x,c.y+.035,c.z);c.model.root.rotation.set(Math.atan(c.grade),c.yaw,0,'YXZ');c.model.animate(clamp(c.steer||0,-.6,.6),c.speed,dt,c.braking,c.signal);}
  for(const p of people){p.timer+=dt;if(p.event){if(p.phase==='waiting'&&Math.abs(state.z-p.z)<29&&Math.abs(state.z-p.z)>10&&Math.abs(state.x)<7&&Math.abs(state.speed)>1&&!p.triggered){p.phase='cross';p.triggered=true;p.timer=0;}if(p.phase==='cross'){p.x+=p.direction*2.5*dt;if(Math.abs(p.x)>6.5){p.phase='done';p.timer=0;}}if(p.phase==='done'&&Math.hypot(state.x-p.x,state.z-p.z)>90){p.x=p.startX;p.phase='waiting';p.triggered=false;}}else{p.z+=p.direction*.67*dt;if(p.z>140||p.z< -142)p.direction*=-1;}
   p.root.position.set(p.x,.12,p.z);p.root.rotation.y=p.event?(p.direction===1?-Math.PI/2:Math.PI/2):(p.direction===1?Math.PI:0);const walk=p.phase==='cross'||!p.event;for(let i=0;i<4;i++)p.limbs[i].rotation.x=walk?Math.sin(p.timer*(p.child?10:5)+i%2*Math.PI)*.45:0;
  }
  if(tramWait>0)tramWait-=dt;else{const prev=tramX;tramX+=tramDir*6*dt;for(const stop of [60,210])if((prev-stop)*(tramX-stop)<0)tramWait=4;}if(tramX>282||tramX< -145){tramDir*=-1;tramX=clamp(tramX,-145,282);}tram.root.position.set(tramX,.11,150.3);tram.root.rotation.y=tramDir===1?-Math.PI/2:Math.PI/2;
 }
 // Establish positions before the first collision/render pass.
 update(0,0,{x:Infinity,z:Infinity},'green');
 return {cars,people,tram,update,seedFollowers(state){seedFollowers(cars,state,world.roads);},get tramState(){return {x:tramX,z:150.3,hx:5.5,hz:1.2};}};
}
