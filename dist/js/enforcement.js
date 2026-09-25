import {nearestRoad,sampleRoad} from './road-network.js?v=10';
import {createRoadNavigator,followRoadPath,roadSegmentClear} from './road-navigation.js?v=10';
export const LICENSE_POINTS=20;
// Fictional game tariffs. These are not Japan's legal demerit points or fines.
export function sanctionFor({key='',amount=0,message=''}){const text=key+' '+message;
 if(key==='destruction')return {points:6,fine:50000};
 if(/collision-person|歩行者に接触/.test(text))return {points:6,fine:50000};
 if(/car|building|tram|barrier|接触事故/.test(text))return {points:4,fine:25000};
 if(/emergency|緊急車両/.test(text))return {points:2,fine:12000};
 if(/shoulder|clearance|路側帯|路端/.test(text))return {points:1,fine:6000};
 if(/offroad|歩道|路外/.test(text))return {points:3,fine:12000};
 if(/stop:|一時停止/.test(text))return {points:2,fine:7000};
 if(/signal:|赤信号/.test(text))return {points:2,fine:9000};
 if(key==='lane'||/逆走|reverse|後退/.test(text))return {points:3,fine:15000};
 if(/speed|速度超過/.test(text))return amount>=40?{points:3,fine:18000}:{points:1,fine:9000};
 if(/person|横断歩行者|横断する歩行者/.test(text))return {points:3,fine:18000};
 if(/yellow|黄色/.test(text))return {points:2,fine:9000};
 return {points:1,fine:6000};
}
export const pursuitCount=seconds=>seconds>=300?3:seconds>=180?2:1;
export function isAlongside(officer,player){const fx=-Math.sin(player.yaw),fz=-Math.cos(player.yaw),dx=officer.x-player.x,dz=officer.z-player.z,along=dx*fx+dz*fz,side=Math.abs(dx*-fz+dz*fx);return !player.boat&&Math.abs(along)<2.7&&side>1.3&&side<3.5&&Math.cos(officer.yaw-player.yaw)>.82&&Math.abs(officer.y-player.y)<1.3;}
export class Enforcement{
 constructor(roads,onEvent=()=>{}){this.roads=roads;this.nav=createRoadNavigator(roads);this.onEvent=onEvent;this.points=LICENSE_POINTS;this.fines=0;this.history=[];this.pending=new Map();this.officers=[];this.active=false;this.elapsed=0;this.grace=0;this.sequence=0;}
 report(violation,state){if(this.grace>0)return false;const tariff=sanctionFor(violation),key=violation.key.split(':')[0],old=this.pending.get(key);if(!old||tariff.points>old.points)this.pending.set(key,{...violation,...tariff});if(!this.active){this.active=true;this.elapsed=0;this.sequence++;this.officers=[];this.spawn(state);this.onEvent({type:'start',message:'白バイが追跡中。安全な場所で速度を落としてください。'});}return true;}
 spawn(state){const offset=65+this.officers.length*25,n=this.nav.behind(state,offset),p=sampleRoad(n.road,n.d),lane=n.road.highway?Math.max(2,n.road.widthAt(p.d)/2-2.35):2.18;const officer={x:p.x+p.tz*n.dir*lane,y:p.y,z:p.z-p.tx*n.dir*lane,yaw:Math.atan2(-p.tx*n.dir,-p.tz*n.dir),speed:5,path:[],pathIndex:0,routeTimer:2,sideTime:0,visible:true,hx:.5,hz:1.1,index:this.officers.length};this.officers.push(officer);}
 advanceTime(dt,state){if(!Number.isFinite(dt)||dt<=0)return;this.grace=Math.max(0,this.grace-dt);if(!this.active)return;this.elapsed+=dt;const count=pursuitCount(this.elapsed);while(this.officers.length<count){this.spawn(state);this.onEvent({type:'reinforcement',message:`白バイの増援：${this.officers.length}台で追跡中`});}}
 update(dt,state,obstacles=[]){for(const a of this.officers){if(!a.visible)continue;if(!this.active){followRoadPath(a,a.path,12,dt);if(Math.hypot(a.x-state.x,a.z-state.z)>130||a.pathIndex>=a.path.length-1)a.visible=false;continue;}
  a.routeTimer+=dt;const near=Math.hypot(a.x-state.x,a.z-state.z)<25,road=nearestRoad(this.roads,state.x,state.z);let goal=null;
  if(near){for(const side of [1,-1]){const p={x:state.x+Math.cos(state.yaw)*1.9*side,y:road.y,z:state.z-Math.sin(state.yaw)*1.9*side,yaw:state.yaw},r=nearestRoad(this.roads,p.x,p.z);if(r.distance<r.road.widthAt(r.d)/2-.55&&roadSegmentClear(this.roads,a,p)){goal=p;break;}}}
  if(goal){a.path=[goal];a.pathIndex=0;a.routeTimer=2;}else if(a.routeTimer>1.2||!a.path.length){a.routeTimer=0;a.path=this.nav.route(a,state);a.pathIndex=Math.min(1,a.path.length-1);}
  let speed=Math.min(38,Math.max(13,Math.abs(state.speed)+8));if(goal){const gap=Math.hypot(a.x-goal.x,a.z-goal.z);speed=Math.min(speed,Math.max(0,Math.abs(state.speed)+gap*.8));}
  // Route locally around a stopped car/ambulance, staying on the same carriageway.
  const blocker=obstacles.find(o=>{const dx=o.x-a.x,dz=o.z-a.z,along=dx*-Math.sin(a.yaw)+dz*-Math.cos(a.yaw),side=Math.abs(dx*Math.cos(a.yaw)-dz*Math.sin(a.yaw));return along>0&&along<16&&side<(o.hx||.88)+.65&&Math.abs((o.y||0)-a.y)<2;});
  if(!a.bypass&&blocker){const fx=-Math.sin(blocker.yaw),fz=-Math.cos(blocker.yaw);for(const side of [1,-1]){const points=[-5.5,5.5].map(d=>({x:blocker.x+Math.cos(blocker.yaw)*2.3*side+fx*d,y:blocker.y,z:blocker.z-Math.sin(blocker.yaw)*2.3*side+fz*d}));if(points.some(q=>{const r=nearestRoad(this.roads,q.x,q.z);return r.distance>r.road.widthAt(r.d)/2-.7||obstacles.some(o=>o!==blocker&&Math.hypot(o.x-q.x,o.z-q.z)<3);})||!roadSegmentClear(this.roads,a,points[0])||!roadSegmentClear(this.roads,points[0],points[1]))continue;a.bypass=points;a.bypassIndex=0;break;}}
  if(a.bypass){if(Math.hypot(a.x-a.bypass.at(-1).x,a.z-a.bypass.at(-1).z)<.8){a.bypass=null;a.routeTimer=2;}else{a.path=a.bypass;a.pathIndex=a.bypassIndex;speed=Math.min(speed,6);}}
  for(const o of obstacles){const dx=o.x-a.x,dz=o.z-a.z,along=dx*-Math.sin(a.yaw)+dz*-Math.cos(a.yaw),lateral=Math.abs(dx*Math.cos(a.yaw)-dz*Math.sin(a.yaw));if(along>0&&along<7&&lateral<1.25&&Math.abs((o.y||0)-a.y)<2)speed=Math.min(speed,Math.max(0,along-3));}
  followRoadPath(a,a.path,speed,dt);if(a.bypass)a.bypassIndex=a.pathIndex;if(goal&&!a.bypass&&Math.hypot(a.x-goal.x,a.z-goal.z)<1&&a.speed<1.5)a.yaw+=Math.atan2(Math.sin(state.yaw-a.yaw),Math.cos(state.yaw-a.yaw))*(1-Math.exp(-3*dt));a.sideTime=isAlongside(a,state)?a.sideTime+dt:0;if(a.sideTime>=1.0){this.catch(state);break;}
 }}
 catch(state){if(!this.active)return;const charges=[...this.pending.values()],points=charges.reduce((s,c)=>s+c.points,0),fine=charges.reduce((s,c)=>s+c.fine,0);this.points=Math.max(0,this.points-points);this.fines+=fine;this.history.unshift({charges,points,fine,elapsed:this.elapsed});this.history.length=Math.min(10,this.history.length);this.pending.clear();this.active=false;this.grace=12;
  for(const a of this.officers){const r=nearestRoad(this.roads,a.x,a.z),dir=(-Math.sin(a.yaw)*r.tx-Math.cos(a.yaw)*r.tz)>0?1:-1,p=sampleRoad(r.road,r.d+dir*130);a.path=this.nav.route(a,{...p,yaw:Math.atan2(-p.tx*dir,-p.tz*dir)});a.pathIndex=1;}
  this.onEvent({type:'caught',points,fine,charges,message:`取り締まり成立：免許 −${points}点 / 反則金 ¥${fine.toLocaleString('ja-JP')}`});
 }
 get count(){return this.active?this.officers.length:0;}
}
