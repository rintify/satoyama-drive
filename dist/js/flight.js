import {clamp} from './simulation.js?v=10';
const G=9.81;
// Accessible fixed-wing game model: aerodynamic lift, drag and coordinated turns.
// Speeds are m/s; pitch is nose-up, bank is right-wing-down, all angles in radians.
export function takeOff(s){Object.assign(s,{flight:true,landing:false,airborne:false,flightImpact:0,flightPitch:.055,flightBank:0,pitchRate:0,rollRate:0,verticalSpeed:0,flightThrottle:.72,stall:false,steering:0,roadWheel:0,gear:'D',parking:false,speed:Math.max(0,s.speed)});}
export function requestLanding(s,clear){if(!s.flight)return false;if(!s.airborne){s.flight=false;s.flightThrottle=0;return true;}if(!clear)return false;s.landing=true;return true;}
export function stepFlight(s,dt,floor,input={},canLand=true){
 dt=clamp(dt,0,1/30);if(!s.flight||dt===0)return false;
 if(typeof input==='number')input={elevator:input};
 let elevator=clamp(input.elevator||0,-1,1),aileron=clamp(input.aileron||0,-1,1),rudder=clamp(input.rudder||0,-1,1);
 const altitude=Math.max(0,s.y-floor),v=Math.hypot(s.speed,s.verticalSpeed),gamma=Math.atan2(s.verticalSpeed,Math.max(1,s.speed)),authority=clamp(v/22,.12,1);
 let throttle=clamp(s.flightThrottle??s.throttle,0,1);
 if(s.landing&&(Math.abs(elevator)+Math.abs(aileron)>.15||!canLand)){s.landing=false;if(!canLand){s.flightPitch=Math.max(s.flightPitch,.18);s.flightThrottle=throttle=.9;}}
 if(s.landing){const sink=altitude>7?-2.4:-.9,trimAoA=clamp((1/(Math.max(.25,(v/26)**2))-.65)/6,-.06,.22),targetPitch=Math.atan2(sink,Math.max(18,s.speed))+trimAoA;elevator=clamp((targetPitch-s.flightPitch)*3,-.7,.7);aileron=clamp(-s.flightBank*2,-1,1);throttle=clamp(.4+(25-v)*.09,.08,.85);}
 s.throttle=throttle;s.pitchRate+=(elevator*.64*authority-s.pitchRate)*(1-Math.exp(-4*dt));s.rollRate+=(aileron*1.25*authority-s.rollRate)*(1-Math.exp(-4.5*dt));
 s.flightPitch=clamp(s.flightPitch+(s.pitchRate-(s.flightPitch-.055)*.13)*dt,-.78,.8);
 s.flightBank=clamp(s.flightBank+(s.rollRate-s.flightBank*.15)*dt,-1.1,1.1);
 if(!s.airborne){s.flightBank=0;s.flightPitch=clamp(s.flightPitch,-.03,.28);}
 const aoa=s.flightPitch-gamma,stallLoss=clamp((Math.abs(aoa)-.28)/.33,0,.82),cl=clamp(.65+aoa*6,-.9,2.2)*(1-stallLoss);
 const lift=G*(v/26)**2*cl,drag=.65+.0018*v*v+.026*lift*lift+Math.max(0,s.brake)*8,thrust=throttle*11;
 s.stall=s.airborne&&(v<15||Math.abs(aoa)>.34);if(s.stall)s.flightPitch-=clamp((15-v)*.012+stallLoss*.32,.04,.55)*dt;
 const ay=lift*Math.cos(s.flightBank)*Math.cos(gamma)+thrust*Math.sin(s.flightPitch)-drag*Math.sin(gamma)-G;
 s.speed=clamp(s.speed+(thrust*Math.cos(s.flightPitch)-drag*Math.cos(gamma)-lift*Math.sin(gamma))*dt,0,95);
 s.verticalSpeed+=ay*dt;
 if(!s.airborne&&s.y<=floor+.02&&s.verticalSpeed<0)s.verticalSpeed=0;
 const yawRate=s.airborne?G*Math.tan(s.flightBank)/Math.max(12,v)+rudder*.17*authority:(aileron*.6+rudder*.8)*Math.min(1,s.speed/8);
 s.yaw-=yawRate*dt;s.x-=Math.sin(s.yaw)*s.speed*dt;s.z-=Math.cos(s.yaw)*s.speed*dt;s.y+=s.verticalSpeed*dt;s.distance+=s.speed*dt;s.grade=0;s.roadWheel=0;s.rpm+=(1200+throttle*3900-s.rpm)*(1-Math.exp(-4*dt));
 if(s.y>floor+.18)s.airborne=true;
 if(s.y<=floor){s.y=floor;if(s.airborne){s.flightImpact=Math.max(0,-s.verticalSpeed-2.6)+(Math.abs(s.flightBank)>.55?4:0);s.flight=false;s.airborne=false;s.landing=false;s.stall=false;s.flightBank=s.flightPitch=s.pitchRate=s.rollRate=0;s.verticalSpeed=0;s.throttle=0;s.flightThrottle=0;return true;}s.verticalSpeed=0;}
 return false;
}
// Segment/OBB slab test prevents fast projectiles from tunnelling through targets.
export function segmentHit(from,to,box){if(box.destroyed)return null;const yaw=box.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);const local=p=>{const dx=p.x-box.x,dz=p.z-box.z;return {x:dx*c-dz*s,z:dx*s+dz*c,y:p.y-(box.y||0)}};const a=local(from),b=local(to),bounds={x:[-(box.hx??.88)-.15,(box.hx??.88)+.15],z:[-(box.hz??2.2)-.15,(box.hz??2.2)+.15],y:[-.15,(box.height??1.7)+.15]};let enter=0,exit=1;for(const axis of ['x','y','z']){const d=b[axis]-a[axis],[min,max]=bounds[axis];if(Math.abs(d)<1e-8){if(a[axis]<min||a[axis]>max)return null;continue;}let t0=(min-a[axis])/d,t1=(max-a[axis])/d;if(t0>t1)[t0,t1]=[t1,t0];enter=Math.max(enter,t0);exit=Math.min(exit,t1);if(enter>exit)return null;}return enter;}
export function distanceToBox(p,b){const c=Math.cos(b.yaw||0),s=Math.sin(b.yaw||0),dx=p.x-b.x,dz=p.z-b.z;return Math.hypot(Math.max(0,Math.abs(dx*c-dz*s)-(b.hx??.88)),Math.max(0,Math.abs(dx*s+dz*c)-(b.hz??2.2)),Math.max((b.y||0)-p.y,0,p.y-(b.y||0)-(b.height??1.7)));}
export class MissileSystem{
 constructor(onExplode=()=>{}){this.items=[];this.cooldown=0;this.shots=0;this.onExplode=onExplode;}
 fire(origin,direction){if(this.cooldown>0||this.items.length>=6)return null;const length=Math.hypot(direction.x,direction.y,direction.z);if(length<.01)return null;const m={...origin,vx:direction.x/length*90,vy:direction.y/length*90,vz:direction.z/length*90,life:0,id:++this.shots};this.items.push(m);this.cooldown=1.1;return m;}
 step(dt,targets,groundHeight=()=>0){this.cooldown=Math.max(0,this.cooldown-dt);const alive=[];for(const m of this.items){m.life+=dt;const end={x:m.x+m.vx*dt,y:m.y+m.vy*dt,z:m.z+m.vz*dt};let first=1,target=null;for(const b of targets){const t=segmentHit(m,end,b);if(t!==null&&t<first){first=t;target=b;}}
 const ground=groundHeight(end.x,end.z);let terrain=false;if(end.y<=ground+.1){const t=m.y>ground+.1?clamp((m.y-ground-.1)/(m.y-end.y),0,1):0;if(t<first){first=t;target=null;terrain=true;}}
 if(target||terrain){const hit={x:m.x+(end.x-m.x)*first,y:m.y+(end.y-m.y)*first,z:m.z+(end.z-m.z)*first};this.onExplode(hit,target);continue;}Object.assign(m,end);if(m.life<4.5)alive.push(m);}this.items=alive;}
}
