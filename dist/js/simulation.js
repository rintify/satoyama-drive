// Pure, deterministic vehicle/rule logic. Units: metres, seconds, radians.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createVehicleState(){return {x:-2.25,y:.04,z:102,yaw:0,speed:0,steering:0,roadWheel:0,throttle:0,brake:0,gear:'P',parking:true,score:1000,distance:0,rpm:800,signal:0,gearStep:1};}
export function shiftGear(state,gear){if(!['P','R','N','D'].includes(gear))return {ok:false,message:'P・R・N・D を選択してください。'};if(gear===state.gear)return {ok:true};if(Math.abs(state.speed)>.5)return {ok:false,message:'停車してからシフトを切り替えてください。'};if(state.brake<.2)return {ok:false,message:'ブレーキを踏みながらシフトを選んでください。'};state.gear=gear;state.speed=0;return {ok:true};}
// Longitudinal force balance, expressed as acceleration (force / vehicle mass).
// Gear selects torque direction, never constrains the direction gravity can roll the car.
export function stepVehicle(s,dt,offroad=false,slope=0){
 dt=clamp(dt,0,1/30);s.throttle=clamp(s.throttle,0,1);s.brake=clamp(s.brake,0,1);s.steering=clamp(s.steering,-540,540);
 const direction=s.gear==='D'?1:s.gear==='R'?-1:0;
 const v=Math.abs(s.speed),coupledSpeed=s.speed*direction;
 const throttle=s.brake>.08?0:s.throttle;
 const creep=direction?1.02*clamp(1-coupledSpeed/1.85,0,1.6):0;
 const traction=throttle*(s.gear==='R'?2.4:4.05)/(1+v*.042);
 const engineBrake=direction&&coupledSpeed>1.85?(1-throttle)*Math.min(1.05,.12+(coupledSpeed-1.85)*.028):0;
 const gravity=-9.81*Math.sin(slope);
 const freeSpeed=s.speed+(direction*(creep+traction-engineBrake)+gravity)*dt;
 const resistance=.115+v*.009+v*v*.00065+(offroad?.8:0);
 const friction=resistance+s.brake*10.5+(s.parking?12:0);
 s.speed=Math.sign(freeSpeed)*Math.max(0,Math.abs(freeSpeed)-friction*dt)||0;
 if(s.gear==='P')s.speed=0;
 s.speed=clamp(s.speed,-45,55);
 if(offroad)s.speed=clamp(s.speed,-9,12);
 s.grade=Math.tan(slope)*100;
 const targetRoadWheel=s.steering/15.9*Math.PI/180;
 s.roadWheel+=(targetRoadWheel-s.roadWheel)*(1-Math.exp(-12*dt));
 const slip=1+v*v*.004,horizontalSpeed=s.speed*Math.cos(slope);
 s.yaw-=horizontalSpeed/2.65*Math.tan(s.roadWheel)/slip*dt;
 s.x-=Math.sin(s.yaw)*horizontalSpeed*dt;s.z-=Math.cos(s.yaw)*horizontalSpeed*dt;s.distance+=Math.abs(s.speed)*dt;
 const speeds=[0,7,14,22,30];let gearStep=1;for(let i=1;i<speeds.length;i++)if(v>speeds[i])gearStep=i+1;s.gearStep=gearStep;
 const base=direction?850+(v-(speeds[gearStep-1]||0))*180+throttle*1150:800+throttle*3200;
 s.rpm+=(clamp(base,750,6100)-s.rpm)*(1-Math.exp(-7*dt));
}
export function carCorners(s,hx=.88,hz=2.2){const c=Math.cos(s.yaw),si=Math.sin(s.yaw);return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([x,z])=>({x:s.x+x*c+z*si,z:s.z-x*si+z*c}));}
export function intersectsBox(s,box,padding=0){const corners=carCorners(s,.88+padding,2.2+padding),other=[{x:box.x-box.hx,z:box.z-box.hz},{x:box.x+box.hx,z:box.z-box.hz},{x:box.x+box.hx,z:box.z+box.hz},{x:box.x-box.hx,z:box.z+box.hz}];return polygonOverlap(corners,other);}
export function carsOverlap(a,b){return polygonOverlap(carCorners(a),carCorners(b));}
function polygonOverlap(a,b){for(const poly of [a,b])for(let i=0;i<2;i++){const p=poly[i],q=poly[(i+1)%4],ax=-(q.z-p.z),az=q.x-p.x;let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;for(const v of a){const n=v.x*ax+v.z*az;minA=Math.min(minA,n);maxA=Math.max(maxA,n);}for(const v of b){const n=v.x*ax+v.z*az;minB=Math.min(minB,n);maxB=Math.max(maxB,n);}if(maxA<minB||maxB<minA)return false;}return true;}
export function personOverlap(s,p){const dx=p.x-s.x,dz=p.z-s.z,c=Math.cos(s.yaw),si=Math.sin(s.yaw);return Math.abs(dx*c-dz*si)<1.13&&Math.abs(dx*si+dz*c)<2.45;}
export function lightPhase(time,axis='z'){const t=((time%32)+32)%32;if(axis==='x')return t>=23&&t<29?'green':t>=29&&t<31?'yellow':'red';return t<18?'green':t<21?'yellow':'red';}
export function crossedStopLine(prev,s,intersection,phase){
 const phases=typeof phase==='string'?{z:phase}:phase;
 for(const axis of Object.keys(phases)){if(phases[axis]!=='red')continue;const lateral=axis==='z'?'x':'z';if(Math.abs(s[lateral]-intersection[lateral])>4.6)continue;const delta=s[axis]-prev[axis],center=intersection[axis];if(delta<0&&prev[axis]>center+11&&s[axis]<=center+11)return true;if(delta>0&&prev[axis]<center-11&&s[axis]>=center-11)return true;}return false;
}
export {RuleBook} from './traffic-rules.js';

// The inside wheel follows a tighter radius than the outside wheel.
export function ackermannAngles(steer, wheelbase=2.65, track=1.8) {
 if(Math.abs(steer)<1e-6)return {left:0,right:0};
 const radius=wheelbase/Math.tan(Math.abs(steer));
 const inside=Math.atan(wheelbase/Math.max(.1,radius-track/2));
 const outside=Math.atan(wheelbase/(radius+track/2));
 return steer>0?{left:outside,right:inside}:{left:-inside,right:-outside};
}
