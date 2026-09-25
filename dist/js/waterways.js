// One shoreline definition is shared by terrain, water meshes, maps and navigation.
export const WATER_LEVEL=-1.5;
export const MARINA={car:{x:878,y:.04,z:350,yaw:-Math.PI/2},boat:{x:945,y:WATER_LEVEL,z:362,yaw:-Math.PI/2}};
export const riverCenter=z=>610+62*Math.sin(z*.0045);
export const riverWidth=z=>46+8*Math.sin(z*.009);
export function waterDistance(x,z){
 const sea=910-x;
 const river=Math.max(Math.abs(x-riverCenter(z))-riverWidth(z),-1120-z,z-820);
 const estuary=Math.max(600-x,Math.abs(z-750)-90);
 return Math.min(sea,river,estuary);
}
export function isWater(x,z,margin=0){return waterDistance(x,z)<-margin;}
export function canBoatNavigate(x,z){return isWater(x,z,3)&&!(x>883&&x<950&&z>344.5&&z<355.5)&&!(x>925.5&&x<936.5&&z>301.5&&z<398.5);}
export function waterBed(x,z){const d=waterDistance(x,z);return d>=12?-.04:Math.max(-7,-.04-(12-d)*.23);}
export function boardBoat(s){Object.assign(s,MARINA.boat,{boat:true,flight:false,airborne:false,landing:false,speed:0,boatYawRate:0,verticalSpeed:0,gear:'D',parking:false,throttle:0,brake:0,steering:0,roadWheel:0});}
export function leaveBoat(s){Object.assign(s,MARINA.car,{boat:false,speed:0,boatYawRate:0,gear:'P',parking:true,throttle:0,brake:0,steering:0,roadWheel:0});}
export function stepBoat(s,dt,time=0){
 const direction=s.gear==='R'?-1:s.gear==='D'?1:0;
 const anchor=s.parking||s.gear==='P',drive=anchor?0:direction*s.throttle*3.2;
 const resistance=.15*s.speed+.023*s.speed*Math.abs(s.speed),brake=(anchor?7:s.brake*3)*Math.sign(s.speed);
 const next=s.speed+(drive-resistance-brake)*dt;s.speed=brake&&next*s.speed<0?0:Math.max(-4.5,Math.min(14,next));
 s.roadWheel=s.steering/540*.6;
 const desired=-s.roadWheel*s.speed*.085;s.boatYawRate=(s.boatYawRate||0)+(desired-(s.boatYawRate||0))*(1-Math.exp(-dt*2));s.yaw+=s.boatYawRate*dt;
 const x=s.x-Math.sin(s.yaw)*s.speed*dt,z=s.z-Math.cos(s.yaw)*s.speed*dt;
 let hit=false;
 if(canBoatNavigate(x,z)){s.x=x;s.z=z;}else{hit=Math.abs(s.speed)>.8;s.speed*=Math.exp(-dt*15);s.boatYawRate=0;}
 s.y=WATER_LEVEL+Math.sin(time*1.4+s.x*.06)*.09;s.grade=0;s.distance+=Math.abs(s.speed)*dt;s.rpm=750+Math.abs(s.speed)*210+s.throttle*1800;s.gearStep=1;
 return hit;
}
