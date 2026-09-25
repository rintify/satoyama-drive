import * as T from '../vendor/three.module.js';
import {createCar,createPerson,createTram} from './vehicle.js?v=6';
import {createAgent,positionAgent,stepTraffic,seedFollowers,rearTraffic} from './traffic-ai.js?v=6';
import {clamp} from './simulation.js?v=6';
export function createTraffic(scene,world){
 const cars=[],people=[];const colors=['#dadcd2','#879791','#455964','#b8afa0','#563c3b','#cbd6d7'];
 const counts=[6,6,5,10,5,4,8,5,6,5,5,6,4];
 world.routes.forEach((route,r)=>{for(let i=0;i<counts[r];i++){const model=createCar(colors[(i+r)%colors.length],{van:i%4===0});scene.add(model.root);model.interior.visible=false;const c=createAgent(route,route.length*(i+.25)/counts[r],i%2?1:-1,route.id==='express-circuit'?19+i%4*1.4:11+i%3);c.model=model;c.homeRoute=route;positionAgent(c,world.roads);cars.push(c);}});
 for(let i=0;i<14;i++){const child=i===2||i===8;const person=createPerson(child);scene.add(person.root);const x=i%2===0?-6.4:6.5;const z=-140+i*21;people.push({...person,x,z,startX:x,startZ:z,direction:i%2?1:-1,phase:'walk',timer:i*2,triggered:false});}
 // Station forecourt and shopfront walkers remain inside each pavement block.
 for(let i=0;i<18;i++){const plaza=i<6,west=i>=12,minX=plaza?103:west?-68:13,maxX=plaza?141:west?-13:67,x=minX+(i%6+.4)/6*(maxX-minX),z=plaza?374+(i%3)*1.1:353.3;const p=createPerson(false);scene.add(p.root);people.push({...p,x,z,startX:x,startZ:z,axis:'x',min:minX,max:maxX,direction:i%2?1:-1,phase:'walk',timer:i,triggered:false});}
 // Two crossing events are proximity-triggered and reset only once the car leaves.
 for(const [x,z]of [[-6.2,43],[6.3,-58]]){const p=createPerson(true);scene.add(p.root);people.push({...p,x,z,startX:x,startZ:z,direction:x<0?1:-1,phase:'waiting',timer:0,triggered:false,event:true});}
 const tram=createTram();scene.add(tram.root);tram.root.rotation.y=Math.PI/2;let tramX=-105,tramDir=1,tramWait=0,trafficTimer=0;
 function syncCars(dt){for(const c of cars){c.model.root.position.set(c.x,c.y+.035,c.z);c.model.root.rotation.set(Math.atan(c.grade),c.yaw,0,'YXZ');c.model.animate(clamp(c.steer||0,-.6,.6),c.speed,dt,c.braking,c.signal);}}
 function update(dt,time,state,phase,ambulance=null){
  stepTraffic(ambulance?[...cars,ambulance]:cars,dt,state,world.roads,world.junctions,people,phase,world.stops);
  trafficTimer+=dt;if(trafficTimer>12){trafficTimer=0;if(!rearTraffic(cars,state))seedFollowers(cars,state,world.roads,{distant:true});}
  syncCars(dt);
  for(const p of people){p.timer+=dt;if(p.event){if(p.phase==='waiting'&&Math.abs(state.z-p.z)<29&&Math.abs(state.z-p.z)>10&&Math.abs(state.x)<7&&Math.abs(state.speed)>1&&!p.triggered){p.phase='cross';p.triggered=true;p.timer=0;}if(p.phase==='cross'){p.x+=p.direction*2.5*dt;if(Math.abs(p.x)>6.5){p.phase='done';p.timer=0;}}if(p.phase==='done'&&Math.hypot(state.x-p.x,state.z-p.z)>90){p.x=p.startX;p.phase='waiting';p.triggered=false;}}else{const axis=p.axis||'z';p[axis]+=p.direction*.67*dt;if(p[axis]>(p.max??140)||p[axis]<(p.min??-142))p.direction*=-1;}
   p.root.position.set(p.x,.12,p.z);p.root.rotation.y=(p.event||p.axis==='x')?(p.direction===1?-Math.PI/2:Math.PI/2):(p.direction===1?Math.PI:0);const walk=p.phase==='cross'||!p.event;for(let i=0;i<4;i++)p.limbs[i].rotation.x=walk?Math.sin(p.timer*(p.child?10:5)+i%2*Math.PI)*.45:0;
  }
  if(tramWait>0)tramWait-=dt;else{const prev=tramX;tramX+=tramDir*6*dt;for(const stop of [60,210])if((prev-stop)*(tramX-stop)<0)tramWait=4;}if(tramX>282||tramX< -145){tramDir*=-1;tramX=clamp(tramX,-145,282);}tram.root.position.set(tramX,.11,150.3);tram.root.rotation.y=tramDir===1?-Math.PI/2:Math.PI/2;
 }
 // Establish positions before the first collision/render pass.
 update(0,0,{x:Infinity,z:Infinity},'green');
 return {cars,people,tram,update,seedFollowers(state){seedFollowers(cars,state,world.roads);syncCars(0);},rear(state){return rearTraffic(cars,state);},get tramState(){return {x:tramX,z:150.3,hx:5.5,hz:1.2};}};
}
