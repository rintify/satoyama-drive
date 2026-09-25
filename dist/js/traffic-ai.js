import {sampleRoad,nearestRoad} from './road-network.js?v=11';
import {clamp} from './simulation.js?v=11';
const wrap=(d,length)=>((d%length)+length)%length;
const smooth=t=>t*t*(3-2*t);
const laneWidth=r=>r.highway?3.7:r.width/(r.oneWay?r.lanes:2*r.lanes);
const drivingLane=(r,d)=>r.highway?Math.max(2.18,r.widthAt(d)/2-2.35):r.lanes>1?r.width/2-laneWidth(r)/2:Math.min(2.18,r.width/4);
export function createAgent(route,d,dir=1,cruise=14){return {route,d,dir:route.oneWay?1:dir,cruise,speed:0,lane:0,targetLane:0,laneFrom:0,laneTime:3,passTime:0,signal:0,x:0,y:0,z:0,yaw:0,braking:false};}
export function positionAgent(c,roads){
 const p=sampleRoad(c.route,c.d),roadInfo=c.route.sourceRoad?{road:c.route.sourceRoad,d:p.d,y:p.y,grade:p.grade}:nearestRoad(roads,p.x,p.z);
 c.road=roadInfo.road;c.roadD=roadInfo.d;c.fx=p.tx*c.dir;c.fz=p.tz*c.dir;
 const width=c.road.widthAt(c.roadD),normalLane=drivingLane(c.road,c.roadD);
 const lane=c.emergency?(c.road.highway?1.95:(width>=8?.25:-.15)):normalLane-laneWidth(c.road)*c.lane+(c.yieldShift||0);
 c.x=p.x+p.tz*c.dir*lane;c.z=p.z-p.tx*c.dir*lane;c.y=roadInfo.y;
 c.yaw=Math.atan2(-c.fx,-c.fz);c.grade=roadInfo.grade*(p.tx*roadInfo.tx+p.tz*roadInfo.tz)*c.dir;
 c.canPass=c.road.highway?c.road.hasBarrier(c.roadD)&&c.roadD>155&&c.roadD<c.road.length-155:c.road.lanes>1;
 return c;
}
function relative(c,o){const dx=o.x-c.x,dz=o.z-c.z;return {along:dx*c.fx+dz*c.fz,side:dx*(-c.fz)+dz*c.fx,speed:('fx'in o?o.fx*o.speed:-Math.sin(o.yaw||0)*(o.speed||0))*c.fx+('fz'in o?o.fz*o.speed:-Math.cos(o.yaw||0)*(o.speed||0))*c.fz};}
export function laneClear(c,obstacles,targetLane){
 const desiredSide=(targetLane-c.lane)*laneWidth(c.road);
 return !obstacles.some(o=>{if(o===c||Math.abs((o.y||0)-c.y)>2.5)return false;const r=relative(c,o);if(Math.abs(r.side-desiredSide)>2.05)return false;const rearGap=Math.max(18,(r.speed-c.speed)*3.5+12),frontGap=Math.max(18,c.speed*1.1);return r.along>-rearGap&&r.along<frontGap;});
}
export function planAgent(c,obstacles,people,junctions,phase,dt,stops=[]){
 let limit=Math.min(c.cruise,c.road.limit/3.6*(c.emergency?1.5:.94)),leader=null,gap=Infinity;
 const rescue=obstacles.find(o=>o.emergency&&o!==c&&Math.cos(o.yaw-c.yaw)>.6&&Math.abs((o.y||0)-c.y)<2.5&&relative(c,o).along<8&&relative(c,o).along>-75&&Math.abs(relative(c,o).side)<5);
 const width=c.road.widthAt(c.roadD),normal=drivingLane(c.road,c.roadD),edge=c.road.edgeLineAt?.(c.roadD)??width/2-.25;
 const yieldTarget=rescue?Math.max(0,Math.min(.85,edge-.88-.12-normal)):0;c.yieldShift=(c.yieldShift||0)+(yieldTarget-(c.yieldShift||0))*(1-Math.exp(-dt*1.4));if(rescue){limit=Math.min(limit,2);c.targetLane=0;c.laneFrom=c.lane;c.laneTime=Math.min(c.laneTime,2.8);c.signal=-1;}

 for(const o of obstacles){if(o===c||Math.abs((o.y||0)-c.y)>2.5)continue;const r=relative(c,o);if(r.along>0&&r.along<140&&Math.abs(r.side)<2.05&&r.along<gap){leader=r;gap=r.along;}}
 c.passTime+=dt;
 if(!rescue&&!c.emergency&&c.targetLane===0&&c.laneTime>=3&&c.canPass&&leader&&gap<75&&c.cruise>leader.speed+2&&laneClear(c,obstacles,1)){
  c.targetLane=1;c.laneFrom=c.lane;c.laneTime=0;c.signal=1;c.passTime=0;
 }else if(c.targetLane===1&&c.laneTime>=3&&c.passTime>4&&laneClear(c,obstacles,0)&&(!leader||gap>20)){
  c.targetLane=0;c.laneFrom=c.lane;c.laneTime=0;c.signal=-1;c.passTime=0;
 }
 c.laneTime=Math.min(3,c.laneTime+dt);c.lane=c.laneFrom+(c.targetLane-c.laneFrom)*smooth(c.laneTime/3);if(c.laneTime>=3)c.signal=0;
 // Leave room to merge before the two-lane section narrows into its ramp.
 if(c.lane>.1&&!c.canPass){const mergeRoom=Math.min(c.roadD-95,c.road.length-95-c.roadD)-25;limit=Math.min(limit,Math.sqrt(Math.max(0,mergeRoom)*3));}
 // Obey marked stop approaches, with a short complete halt before proceeding.
 c.stopHolds??={};for(const stop of c.emergency?[]:stops){const forward=stop.axis==='x'?c.fx:c.fz;if(forward*stop.dir<.7)continue;const other=stop.axis==='x'?'z':'x';if(Math.abs(c[other]-stop[other])>4.8)continue;const dist=(stop[stop.axis]-c[stop.axis])*stop.dir-stop.offset-2.2;let held=c.stopHolds[stop.id]||0;if(dist>45)held=0;if(dist>=0&&dist<3&&c.speed<.05)held+=dt;c.stopHolds[stop.id]=held;if(held<.9&&dist>-.1&&dist<60)limit=Math.min(limit,Math.sqrt(Math.max(0,dist-1.5)*4));}
 // Signal approaches are evaluated in the car's own forward frame.
 for(const q of junctions){if(c.emergency){if(Math.hypot(c.x-q.x,c.z-q.z)<20)limit=Math.min(limit,6);continue;}if(!q.signal||!['town','station'].includes(c.road.area))continue;const r=relative(c,q);if(Math.abs(r.side)>6)continue;const axis=Math.abs(c.fz)>.7?'z':'x';const red=typeof phase==='string'?(axis==='z'?phase!=='green':phase!=='red'):phase[axis]!=='green';const stop=r.along-12;if(red&&stop>-1&&stop<100)limit=Math.min(limit,Math.sqrt(Math.max(0,stop)*4));}
 for(const p of people){const r=relative(c,p);if(r.along>0&&r.along<35&&Math.abs(r.side)<2.2)limit=Math.min(limit,Math.sqrt(Math.max(0,r.along-4)*4));}
 let acceleration=1.6*(1-(c.speed/Math.max(.5,limit))**4);
 if(leader){const closing=c.speed-leader.speed,desired=5.6+Math.max(0,c.speed*1.45+c.speed*closing/(2*Math.sqrt(1.6*3)));acceleration=Math.min(acceleration,1.6*(1-(c.speed/Math.max(1,limit))**4-(desired/Math.max(1,gap))**2));}
 if(limit<.1)acceleration=Math.min(acceleration,-3);
 return {acceleration:clamp(acceleration,-8,1.6),gap,leaderSpeed:leader?.speed};
}
export function stepTraffic(cars,dt,player,roads,junctions,people=[],phase='green',stops=[],extraObstacles=[]){
 cars=cars.filter(c=>!c.destroyed);const obstacles=[player,...cars,...extraObstacles];const plans=cars.map(c=>planAgent(c,obstacles,people,junctions,phase,dt,stops));
 cars.forEach((c,i)=>{const plan=plans[i];c.speed=Math.max(0,c.speed+plan.acceleration*dt);let distance=c.speed*dt;if(Number.isFinite(plan.gap))distance=Math.min(distance,Math.max(0,plan.gap-5.6));if(distance===0&&plan.gap<5.7)c.speed=0;c.braking=plan.acceleration<-.7;c.d=wrap(c.d+c.dir*distance,c.route.length);const oldX=c.x,oldZ=c.z,oldYaw=c.yaw;positionAgent(c,roads);if(dt>0&&Math.hypot(c.x-oldX,c.z-oldZ)>.00001){const desired=Math.atan2(-(c.x-oldX),-(c.z-oldZ));const difference=Math.atan2(Math.sin(desired-oldYaw),Math.cos(desired-oldYaw));c.yaw=oldYaw+clamp(difference,-1.3*dt,1.3*dt);}c.steer=Math.atan2(Math.sin(c.yaw-oldYaw),Math.cos(c.yaw-oldYaw))*-2.65/Math.max(.3,c.speed*dt);});
}
export function closestTrafficRoute(cars,state){
 let best=null;for(const route of new Set(cars.filter(c=>!c.destroyed).map(c=>c.homeRoute||c.route))){const q=nearestRoad([route],state.x,state.z);if(!best||q.distance<best.q.distance)best={route,q};}return best;
}
export function rearTraffic(cars,state){const fx=-Math.sin(state.yaw),fz=-Math.cos(state.yaw);return cars.filter(c=>!c.destroyed).map(c=>{const dx=c.x-state.x,dz=c.z-state.z;return {car:c,behind:-(dx*fx+dz*fz),side:Math.abs(dx*-fz+dz*fx)};}).filter(v=>v.behind>3&&v.behind<150&&v.side<7&&Math.cos(v.car.yaw-state.yaw)>.5&&Math.abs(v.car.y-(state.y||0))<4).sort((a,b)=>a.behind-b.behind)[0]||null;}
export function seedFollowers(cars,state,roads,{distant=false}={}){
 const match=closestTrafficRoute(cars,state);if(!match||match.q.distance>10)return 0;const {route,q}=match,p=sampleRoad(route,q.d),dir=route.oneWay?1:(-Math.sin(state.yaw)*p.tx-Math.cos(state.yaw)*p.tz)>0?1:-1;
 const pool=cars.filter(c=>!c.destroyed&&(!distant||Math.hypot(c.x-state.x,c.z-state.z)>280)).sort((a,b)=>Math.hypot(b.x-state.x,b.z-state.z)-Math.hypot(a.x-state.x,a.z-state.z));
 let placed=0;for(const gap of distant?[180,230]:[18,43,80]){const c=pool.shift();if(!c)break;const old={...c};c.homeRoute??=c.route;c.route=route;c.dir=dir;c.d=wrap(q.d-dir*gap,route.length);c.lane=c.targetLane=c.laneFrom=0;c.laneTime=3;c.passTime=0;c.signal=0;c.speed=distant?Math.max(7,Math.abs(state.speed)):0;c.cruise=23+placed;positionAgent(c,roads);
 if(cars.some(o=>!o.destroyed&&o!==c&&Math.abs((o.x-c.x)*c.fx+(o.z-c.z)*c.fz)<9&&Math.abs((o.x-c.x)*-c.fz+(o.z-c.z)*c.fx)<2.3&&Math.abs(o.y-c.y)<3)){Object.assign(c,old);continue;}placed++;}
 return placed;
}
