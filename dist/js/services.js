import {Enforcement} from './enforcement.js?v=9';
import {EmergencyTraffic,hasYielded} from './emergency.js?v=9';
import {createPoliceBike,createAmbulance} from './service-models.js?v=9';
export function createServices(scene,world,traffic,onEvent){
 const enforcement=new Enforcement(world.roads,onEvent),emergency=new EmergencyTraffic(world.roads,traffic.cars);
 const bikes=Array.from({length:3},()=>createPoliceBike()),van=createAmbulance();for(const m of [...bikes,van]){scene.add(m.root);m.root.visible=false;}
 return {enforcement,emergency,
  advanceTime(dt,state){enforcement.advanceTime(dt,state);emergency.advanceTime(dt,state);},
  physics(dt,state){enforcement.update(dt,state,emergency.ambulance?[...traffic.cars.filter(c=>!c.destroyed),emergency.ambulance]:traffic.cars.filter(c=>!c.destroyed));return emergency.update(dt,state,world.junctions);},
  render(dt,time,night,state){for(let i=0;i<3;i++){const a=enforcement.officers[i],m=bikes[i];m.root.visible=!!a?.visible;if(a){m.root.position.set(a.x,a.y+.03,a.z);m.root.rotation.y=a.yaw;m.animate(dt,a.speed,a.steer||0,time+i*.2,night);}}const a=emergency.ambulance;van.root.visible=!!a;if(a){van.root.position.set(a.x,a.y+.03,a.z);van.root.rotation.y=a.yaw;van.animate(dt,a.speed,time,night);}},
  cues(state){const proximity=a=>Math.max(0,1-Math.hypot(a.x-state.x,a.z-state.z)/150);return {police:enforcement.active?Math.max(0,...enforcement.officers.map(proximity)):0,ambulance:emergency.ambulance?proximity(emergency.ambulance):0};},
  status(state){const e=enforcement,approach=emergency.getApproach(state);return {police:e.active?`白バイ ${e.count}台で追跡中 · ${Math.floor(e.elapsed/60)}:${String(Math.floor(e.elapsed%60)).padStart(2,'0')}`:'',ambulance:approach?`救急車 ${Math.max(0,Math.round(approach.distance))}m · ${hasYielded(emergency.ambulance,state,world.junctions)?'そのまま進路を空けて':'車道内で左へ寄せて減速'}`:''};}
 };
}
