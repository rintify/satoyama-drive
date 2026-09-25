import {createPerson} from './vehicle.js?v=11';
import {Enforcement} from './enforcement.js?v=11';
import {EmergencyTraffic,hasYielded} from './emergency.js?v=11';
import {createPoliceBike,createAmbulance} from './service-models.js?v=11';
export function createServices(scene,world,traffic,onEvent){
 const enforcement=new Enforcement(world.roads,onEvent),emergency=new EmergencyTraffic(world.roads,traffic.cars);
 const walkers=Array.from({length:3},()=>createPerson(false,true));for(const p of walkers){scene.add(p.root);p.root.visible=false;}
 const bikes=Array.from({length:3},()=>createPoliceBike()),van=createAmbulance();for(const m of [...bikes,van]){scene.add(m.root);m.root.visible=false;}
 return {enforcement,emergency,
  advanceTime(dt,state){enforcement.advanceTime(dt,state);emergency.advanceTime(dt,state);},
  physics(dt,state){enforcement.update(dt,state,emergency.ambulance?[...traffic.cars.filter(c=>!c.destroyed),emergency.ambulance]:traffic.cars.filter(c=>!c.destroyed));const violation=emergency.update(dt,state,world.junctions);return state.onFoot||state.boat?null:violation;},
  render(dt,time,night,state){for(let i=0;i<3;i++){const a=enforcement.officers[i],m=bikes[i],p=walkers[i];m.root.visible=!!a?.visible;p.root.visible=!!a?.visible&&a.mode==='foot';if(a){const pose=a.bikePose||a;m.setMounted(a.mode!=='foot');m.root.position.set(pose.x,pose.y+.03,pose.z);m.root.rotation.y=pose.yaw;m.animate(dt,a.mode==='foot'?0:a.speed,a.steer||0,time+i*.2,night);if(p.root.visible){p.root.position.set(a.x,a.y,a.z);p.root.rotation.y=a.yaw;p.limbs.forEach((limb,j)=>limb.rotation.x=Math.sin(time*11+(j%2)*Math.PI)*(a.speed>.2?.65:0));}}}const a=emergency.ambulance;van.root.visible=!!a;if(a){van.root.position.set(a.x,a.y+.03,a.z);van.root.rotation.y=a.yaw;van.animate(dt,a.speed,time,night);}},
  cues(state){const proximity=a=>Math.max(0,1-Math.hypot(a.x-state.x,a.z-state.z)/150);return {police:enforcement.active?Math.max(0,...enforcement.officers.map(proximity)):0,ambulance:emergency.ambulance?proximity(emergency.ambulance):0};},
  status(state){const e=enforcement,approach=emergency.getApproach(state);return {police:e.active?`${e.officers.some(a=>a.mode==='foot')?'警官 '+e.officers.filter(a=>a.mode==='foot').length+'人 · 白バイ':'白バイ'} ${e.officers.filter(a=>a.mode!=='foot').length}台で追跡中 · ${Math.floor(e.elapsed/60)}:${String(Math.floor(e.elapsed%60)).padStart(2,'0')}`:'',ambulance:approach?`救急車 ${Math.max(0,Math.round(approach.distance))}m · ${hasYielded(emergency.ambulance,state,world.junctions)?'そのまま進路を空けて':'車道内で左へ寄せて減速'}`:''};}
 };
}
