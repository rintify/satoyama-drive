// Pure, deterministic vehicle/rule logic. Units: metres, seconds, radians.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createVehicleState(){return {x:-2.25,y:.04,z:102,yaw:0,speed:0,steering:0,roadWheel:0,throttle:0,brake:0,gear:'P',parking:true,score:1000,distance:0,rpm:800,signal:0,gearStep:1};}
export function shiftGear(state,gear){if(!['P','R','N','D'].includes(gear))return {ok:false,message:'P・R・N・D を選択してください。'};if(gear===state.gear)return {ok:true};if(Math.abs(state.speed)>.5)return {ok:false,message:'停車してからシフトを切り替えてください。'};if(state.brake<.2)return {ok:false,message:'ブレーキを踏みながらシフトを選んでください。'};state.gear=gear;state.speed=0;return {ok:true};}
export function stepVehicle(s,dt,offroad=false,slope=0){dt=clamp(dt,0,1/30);s.throttle=clamp(s.throttle,0,1);s.brake=clamp(s.brake,0,1);s.steering=clamp(s.steering,-540,540);
 const direction=s.gear==='D'?1:s.gear==='R'?-1:0;const v=Math.abs(s.speed);const throttle=s.brake>.08?0:s.throttle;let drive=0;
 if(direction){drive=throttle*(s.gear==='R'?2.2:3.9)/(1+v*.041);if(v<1.45&&s.brake<.03)drive+=.72*(1-v/1.45);}
 const resistance=.12+v*.013+v*v*.00125+(offroad?.95:0);const rolling=Math.sign(s.speed)*resistance;
 let accel=direction*drive-rolling-Math.sin(slope)*9.81;
 if(s.brake>0||s.parking){const decel=s.brake*9+(s.parking?8:0);if(v<decel*dt){s.speed=0;accel=0;}else accel-=Math.sign(s.speed)*decel;}
 if(s.gear==='P'){s.speed=0;accel=0;}
 const prior=s.speed;s.speed+=accel*dt;if(!direction&&prior*s.speed<0)s.speed=0;if(direction&&s.speed*direction<0)s.speed=0;
 s.speed=clamp(s.speed,s.gear==='R'?-8:0,s.gear==='D'?42:Math.max(0,s.speed));
 if(offroad)s.speed=clamp(s.speed,-4,9);
 const targetRoadWheel=s.steering/15.9*Math.PI/180;s.roadWheel+=(targetRoadWheel-s.roadWheel)*(1-Math.exp(-12*dt));
 const slip=1+v*v*.004;s.yaw-=s.speed/2.65*Math.tan(s.roadWheel)/slip*dt;
 s.x-=Math.sin(s.yaw)*s.speed*dt;s.z-=Math.cos(s.yaw)*s.speed*dt;s.distance+=Math.abs(s.speed)*dt;
 const speeds=[0,7,14,22,30];let gearStep=1;for(let i=1;i<speeds.length;i++)if(v>speeds[i])gearStep=i+1;s.gearStep=gearStep;
 const base=direction?850+(v-(speeds[gearStep-1]||0))*180+throttle*1150:800+throttle*3200;s.rpm+=(clamp(base,750,6100)-s.rpm)*(1-Math.exp(-7*dt));
}
export function carCorners(s,hx=.88,hz=2.2){const c=Math.cos(s.yaw),si=Math.sin(s.yaw);return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([x,z])=>({x:s.x+x*c+z*si,z:s.z-x*si+z*c}));}
export function intersectsBox(s,box,padding=0){const corners=carCorners(s,.88+padding,2.2+padding),other=[{x:box.x-box.hx,z:box.z-box.hz},{x:box.x+box.hx,z:box.z-box.hz},{x:box.x+box.hx,z:box.z+box.hz},{x:box.x-box.hx,z:box.z+box.hz}];return polygonOverlap(corners,other);}
export function carsOverlap(a,b){return polygonOverlap(carCorners(a),carCorners(b));}
function polygonOverlap(a,b){for(const poly of [a,b])for(let i=0;i<2;i++){const p=poly[i],q=poly[(i+1)%4],ax=-(q.z-p.z),az=q.x-p.x;let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;for(const v of a){const n=v.x*ax+v.z*az;minA=Math.min(minA,n);maxA=Math.max(maxA,n);}for(const v of b){const n=v.x*ax+v.z*az;minB=Math.min(minB,n);maxB=Math.max(maxB,n);}if(maxA<minB||maxB<minA)return false;}return true;}
export function personOverlap(s,p){const dx=p.x-s.x,dz=p.z-s.z,c=Math.cos(s.yaw),si=Math.sin(s.yaw);return Math.abs(dx*c-dz*si)<1.13&&Math.abs(dx*si+dz*c)<2.45;}
export function lightPhase(time){const t=((time%32)+32)%32;return t<18?'green':t<21?'yellow':'red';}
export function crossedStopLine(prev,s,intersection,phase){if(phase!=='red')return false;if(Math.abs(s.x-intersection.x)>4.6)return false;const dz=s.z-prev.z;if(dz<0&&prev.z>intersection.z+11&&s.z<=intersection.z+11)return true;if(dz>0&&prev.z<intersection.z-11&&s.z>=intersection.z-11)return true;return false;}
export class RuleBook {
 constructor(onPenalty){this.time=0;this.cooldowns=new Map();this.timers={speed:0,lane:0,offroad:0};this.onPenalty=onPenalty;}
 penalize(state,key,amount,message,cooldown=6){if((this.cooldowns.get(key)||0)>this.time)return false;state.score=Math.max(0,state.score-amount);this.cooldowns.set(key,this.time+cooldown);this.onPenalty?.(message,amount);return true;}
 tick(dt,s,roadInfo,previous,intersections,phase){this.time+=dt;const speed=Math.abs(s.speed)*3.6;this.timers.speed=speed>roadInfo.road.limit+3?this.timers.speed+dt:0;if(this.timers.speed>2.5){this.penalize(s,'speed',20,'速度超過',6);this.timers.speed=0;}
 const onRoad=roadInfo.distance<roadInfo.road.width/2-.3;const headingDot=-Math.sin(s.yaw)*roadInfo.tx-Math.cos(s.yaw)*roadInfo.tz;const wrong=roadInfo.side*headingDot>.7&&onRoad&&speed>9&&Math.abs(headingDot)>.75&&!intersections.some(p=>Math.hypot(p.x-s.x,p.z-s.z)<15);
 this.timers.lane=wrong?this.timers.lane+dt:0;if(this.timers.lane>3){this.penalize(s,'lane',30,'対向車線の走行',7);this.timers.lane=0;}
 this.timers.offroad=!onRoad&&speed>8?this.timers.offroad+dt:0;if(this.timers.offroad>2){this.penalize(s,'offroad',15,'路外走行',7);this.timers.offroad=0;}
 for(const q of intersections)if(crossedStopLine(previous,s,q,phase))this.penalize(s,'signal:'+q.x+','+q.z,80,'赤信号での進入',10);
 }
}
