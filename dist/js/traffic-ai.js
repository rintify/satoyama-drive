import {sampleRoad,nearestRoad} from './road-network.js';
import {clamp} from './simulation.js';
const wrap=(d,length)=>((d%length)+length)%length;
const smooth=t=>t*t*(3-2*t);
export function createAgent(route,d,dir=1,cruise=14){return {route,d,dir,cruise,speed:0,lane:0,targetLane:0,laneFrom:0,laneTime:3,passTime:0,signal:0,x:0,y:0,z:0,yaw:0,braking:false};}
export function positionAgent(c,roads){
 const p=sampleRoad(c.route,c.d),roadInfo=nearestRoad(roads,p.x,p.z);
 c.road=roadInfo.road;c.roadD=roadInfo.d;c.fx=p.tx*c.dir;c.fz=p.tz*c.dir;
 const width=c.road.widthAt(c.roadD),normalLane=c.road.highway?Math.max(2.18,width/2-2.35):Math.min(2.18,width/4);
 const lane=normalLane+(1.95-normalLane)*c.lane;
 c.x=p.x+p.tz*c.dir*lane;c.z=p.z-p.tx*c.dir*lane;c.y=roadInfo.y;
 c.yaw=Math.atan2(-c.fx,-c.fz);c.grade=roadInfo.grade*(p.tx*roadInfo.tx+p.tz*roadInfo.tz)*c.dir;
 c.canPass=c.road.highway&&c.road.hasBarrier(c.roadD)&&c.roadD>155&&c.roadD<c.road.length-155;
 return c;
}
function relative(c,o){const dx=o.x-c.x,dz=o.z-c.z;return {along:dx*c.fx+dz*c.fz,side:dx*(-c.fz)+dz*c.fx,speed:('fx'in o?o.fx*o.speed:-Math.sin(o.yaw||0)*(o.speed||0))*c.fx+('fz'in o?o.fz*o.speed:-Math.cos(o.yaw||0)*(o.speed||0))*c.fz};}
export function laneClear(c,obstacles,targetLane){
 const desiredSide=(targetLane-c.lane)*3.7;
 return !obstacles.some(o=>{if(o===c||Math.abs((o.y||0)-c.y)>2.5)return false;const r=relative(c,o);if(Math.abs(r.side-desiredSide)>2.05)return false;const rearGap=Math.max(18,(r.speed-c.speed)*3.5+12),frontGap=Math.max(18,c.speed*1.1);return r.along>-rearGap&&r.along<frontGap;});
}
export function planAgent(c,obstacles,people,junctions,phase,dt){
 let limit=Math.min(c.cruise,c.road.limit/3.6*.94),leader=null,gap=Infinity;
 for(const o of obstacles){if(o===c||Math.abs((o.y||0)-c.y)>2.5)continue;const r=relative(c,o);if(r.along>0&&r.along<140&&Math.abs(r.side)<2.05&&r.along<gap){leader=r;gap=r.along;}}
 c.passTime+=dt;
 if(c.targetLane===0&&c.laneTime>=3&&c.canPass&&leader&&gap<75&&c.cruise>leader.speed+2&&laneClear(c,obstacles,1)){
  c.targetLane=1;c.laneFrom=c.lane;c.laneTime=0;c.signal=1;c.passTime=0;
 }else if(c.targetLane===1&&c.laneTime>=3&&c.passTime>4&&laneClear(c,obstacles,0)&&(!leader||gap>20)){
  c.targetLane=0;c.laneFrom=c.lane;c.laneTime=0;c.signal=-1;c.passTime=0;
 }
 c.laneTime=Math.min(3,c.laneTime+dt);c.lane=c.laneFrom+(c.targetLane-c.laneFrom)*smooth(c.laneTime/3);if(c.laneTime>=3)c.signal=0;
 // Leave room to merge before the two-lane section narrows into its ramp.
 if(c.lane>.1&&!c.canPass){const mergeRoom=Math.min(c.roadD-95,c.road.length-95-c.roadD)-25;limit=Math.min(limit,Math.sqrt(Math.max(0,mergeRoom)*3));}
 // Signal approaches are evaluated in the car's own forward frame.
 for(const q of junctions){if(!q.signal||c.road.area!=='town')continue;const r=relative(c,q);if(Math.abs(r.side)>6)continue;const axis=Math.abs(c.fz)>.7?'z':'x';const red=typeof phase==='string'?(axis==='z'?phase!=='green':phase!=='red'):phase[axis]!=='green';const stop=r.along-12;if(red&&stop>-1&&stop<100)limit=Math.min(limit,Math.sqrt(Math.max(0,stop)*4));}
 for(const p of people){const r=relative(c,p);if(r.along>0&&r.along<35&&Math.abs(r.side)<2.2)limit=Math.min(limit,Math.sqrt(Math.max(0,r.along-4)*4));}
 let acceleration=1.6*(1-(c.speed/Math.max(.5,limit))**4);
 if(leader){const closing=c.speed-leader.speed,desired=5.6+Math.max(0,c.speed*1.45+c.speed*closing/(2*Math.sqrt(1.6*3)));acceleration=Math.min(acceleration,1.6*(1-(c.speed/Math.max(1,limit))**4-(desired/Math.max(1,gap))**2));}
 if(limit<.1&&c.speed<.1)acceleration=-2;
 return {acceleration:clamp(acceleration,-8,1.6),gap,leaderSpeed:leader?.speed};
}
export function stepTraffic(cars,dt,player,roads,junctions,people=[],phase='green'){
 const obstacles=[player,...cars];const plans=cars.map(c=>planAgent(c,obstacles,people,junctions,phase,dt));
 cars.forEach((c,i)=>{const plan=plans[i];c.speed=Math.max(0,c.speed+plan.acceleration*dt);let distance=c.speed*dt;if(Number.isFinite(plan.gap))distance=Math.min(distance,Math.max(0,plan.gap-5.6));if(distance===0&&plan.gap<5.7)c.speed=0;c.braking=plan.acceleration<-.7;c.d=wrap(c.d+c.dir*distance,c.route.length);const oldX=c.x,oldZ=c.z,oldYaw=c.yaw;positionAgent(c,roads);if(dt>0&&Math.hypot(c.x-oldX,c.z-oldZ)>.00001){const desired=Math.atan2(-(c.x-oldX),-(c.z-oldZ));const difference=Math.atan2(Math.sin(desired-oldYaw),Math.cos(desired-oldYaw));c.yaw=oldYaw+clamp(difference,-1.3*dt,1.3*dt);}c.steer=Math.atan2(Math.sin(c.yaw-oldYaw),Math.cos(c.yaw-oldYaw))*-2.65/Math.max(.3,c.speed*dt);});
}
// Only used when the player explicitly changes departure area, never during driving.
export function seedFollowers(cars,state,roads){
 const selected=cars.filter(c=>c.route.id==='express-circuit');if(selected.length<4)return;
 const route=selected[0].route,q=nearestRoad([route],state.x,state.z),p=sampleRoad(route,q.d);
 if(q.distance>12)return;
 const dir=(-Math.sin(state.yaw)*p.tx-Math.cos(state.yaw)*p.tz)>0?1:-1;
 selected.slice(0,4).forEach((c,i)=>{c.dir=dir;c.d=wrap(q.d-dir*[30,75,125,-105][i],route.length);c.lane=c.targetLane=c.laneFrom=0;c.laneTime=3;c.passTime=0;c.speed=i===0?6:10;c.cruise=19+i*1.4;positionAgent(c,roads);});
}
