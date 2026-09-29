import {sampleRoad,nearestRoad} from './road-network.js?v=14';
import {createAgent,positionAgent,closestTrafficRoute} from './traffic-ai.js?v=14';
export function emergencyApproach(ambulance,player){if(!ambulance||ambulance.destroyed)return null;const fx=ambulance.fx??-Math.sin(ambulance.yaw),fz=ambulance.fz??-Math.cos(ambulance.yaw),dx=player.x-ambulance.x,dz=player.z-ambulance.z,along=dx*fx+dz*fz,side=Math.abs(dx*-fz+dz*fx);if(along< -7||along>100||side>9||Math.cos(ambulance.yaw-player.yaw)<.55||Math.abs(ambulance.y-player.y)>3)return null;return {distance:along,side};}
export function hasYielded(ambulance,player,junctions=[]){const r=emergencyApproach(ambulance,player);if(!r)return true;const fx=-Math.sin(ambulance.yaw),fz=-Math.cos(ambulance.yaw),dx=player.x-ambulance.x,dz=player.z-ambulance.z,left=dx*fz-dz*fx;return left>2.17&&Math.abs(player.speed)<10/3.6&&!junctions.some(q=>Math.hypot(player.x-q.x,player.z-q.z)<12);}
export class EmergencyTraffic{
 constructor(roads,cars){this.roads=roads;this.cars=cars;this.ambulance=null;this.clock=0;this.nextAt=18;this.id=0;this.alertTime=0;this.blockTime=0;this.reported=false;this.activeTime=0;}
 advanceTime(dt,state){this.clock+=dt;if(this.ambulance?.destroyed&&this.activeTime>160){this.ambulance=null;this.nextAt=this.clock+90;}if(!this.ambulance&&this.clock>=this.nextAt)this.spawn(state);if(this.ambulance)this.activeTime+=dt;}
 spawn(state){const match=closestTrafficRoute(this.cars,state);if(!match||match.q.distance>20){this.nextAt=this.clock+10;return;}const p=sampleRoad(match.route,match.q.d),dir=(-Math.sin(state.yaw)*p.tx-Math.cos(state.yaw)*p.tz)>0?1:-1;const a=createAgent(match.route,match.q.d-dir*85,dir,20);a.emergency=true;a.hx=1.03;a.hz=2.7;a.speed=7;a.id=++this.id;positionAgent(a,this.roads);this.ambulance=a;this.alertTime=this.blockTime=this.activeTime=0;this.reported=false;}
 update(dt,state,junctions=[]){const a=this.ambulance;if(!a||a.destroyed)return null;const near=emergencyApproach(a,state);if(near&&near.distance<75)this.alertTime+=dt;const blocking=near&&near.distance>0&&near.distance<45&&!hasYielded(a,state,junctions);this.blockTime=blocking&&this.alertTime>6?this.blockTime+dt:0;let violation=null;if(this.blockTime>2.5&&!this.reported){this.reported=true;violation={key:'emergency:'+a.id,amount:60,message:'緊急車両の進路を譲らなかった'};}
 if(this.activeTime>160||(this.activeTime>25&&Math.hypot(a.x-state.x,a.z-state.z)>155)){this.ambulance=null;this.nextAt=this.clock+90;}
 return violation;}
 getApproach(state){return emergencyApproach(this.ambulance,state);}
}
