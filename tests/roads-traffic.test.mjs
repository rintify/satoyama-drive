import test from 'node:test';import assert from 'node:assert/strict';
import {createRoadNetwork,makeRoad,nearestRoad,sampleRoad,indexRoads} from '../dist/js/road-network.js';
import {createAgent,positionAgent,stepTraffic,laneClear,seedFollowers,rearTraffic} from '../dist/js/traffic-ai.js';
import {carsOverlap} from '../dist/js/simulation.js';
const network=createRoadNetwork();
test('expanded road network is connected and has substantial elevation',()=>{assert.ok(network.totalLength>10000);assert.equal(network.roads.length,26);assert.ok(Math.max(...network.hill.samples.map(s=>s.y))>55);for(const r of network.roads){for(const p of [r.samples[0],r.samples.at(-1)]){const q=nearestRoad(network.roads.filter(o=>o!==r),p.x,p.z);assert.ok(q.distance<1,`${r.id} endpoint disconnected: ${q.distance}`);assert.ok(Math.abs(q.y-p.y)<.15,`${r.id} height mismatch`);}}});
test('roads have finite grades and smooth bounded turns instead of sharp corners',()=>{for(const r of network.roads){for(let d=2;d<r.length-3;d+=3){const a=sampleRoad(r,d),b=sampleRoad(r,d+1);assert.ok(Number.isFinite(a.grade));assert.ok(Math.abs(a.grade)<.26,`${r.id} slope`);const angle=Math.acos(Math.min(1,Math.max(-1,a.tx*b.tx+a.tz*b.tz)));assert.ok(angle<.2,`${r.id} sharp turn`);}}});
test('indexed height lookup agrees with complete road search on every road',()=>{const plain=[...network.roads];for(const r of plain)for(let d=0;d<r.length;d+=43){const p=sampleRoad(r,d),a=nearestRoad(network.roads,p.x,p.z),b=nearestRoad(plain,p.x,p.z);assert.ok(Math.abs(a.y-b.y)<1e-8);assert.ok(Math.abs(a.distance-b.distance)<1e-8);}});
test('traffic loops close with continuous position and heading',()=>{for(const r of network.routes){const a=sampleRoad(r,.01),b=sampleRoad(r,r.length-.01);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.03,r.id);assert.ok(a.tx*b.tx+a.tz*b.tz>.99,r.id);}});
function setup(){const road=makeRoad('test-highway',[[0,.04,1000],[0,.04,-1000]],{width:16,limit:80,highway:true,area:'highway'});const roads=indexRoads([road]);const player={x:-5.65,y:.04,z:0,yaw:0,speed:3};const car=createAgent(road,925,1,21);car.speed=18;positionAgent(car,roads);return {road,roads,player,car};}
test('faster follower overtakes on the right and returns left without contact',()=>{const {roads,player,car}=setup();let passed=false,changed=false,returned=false;for(let i=0;i<60*55;i++){player.z-=player.speed/60;stepTraffic([car],1/60,player,roads,[],[]);changed ||=car.targetLane===1;passed ||=car.z<player.z-7;returned ||=passed&&car.targetLane===0&&car.lane<.01;assert.ok(!carsOverlap(car,player),`contact at ${i/60}s`);}assert.ok(changed);assert.ok(passed);assert.ok(returned);});
test('a fast approaching car in the passing lane prevents a dangerous merge',()=>{const {roads,player,car,road}=setup();const rear=createAgent(road,900,1,28);rear.speed=28;rear.lane=rear.targetLane=rear.laneFrom=1;positionAgent(rear,roads);assert.equal(laneClear(car,[player,rear],1),false);stepTraffic([car,rear],1/60,player,roads,[],[]);assert.equal(car.targetLane,0);});
test('town follower stops behind player and resumes when player moves',()=>{const {road,roads,player,car}=setup();road.highway=false;road.limit=30;road.area='town';road.width=9;road.widthAt=()=>9;positionAgent(car,roads);player.x=-2.18;player.speed=0;car.speed=8;car.d=975;positionAgent(car,roads);for(let i=0;i<60*20;i++){stepTraffic([car],1/60,player,roads,[],[]);assert.ok(!carsOverlap(car,player));assert.equal(car.targetLane,0);}assert.ok(car.speed<.05);assert.ok(car.z>5&&car.z<7);player.speed=6;for(let i=0;i<600;i++){player.z-=.1;stepTraffic([car],1/60,player,roads,[],[]);}assert.ok(car.speed>3);});
test('area change establishes rear traffic in the same carriageway',()=>{const route=network.routes.find(r=>r.id==='express-circuit'),cars=Array.from({length:4},(_,i)=>createAgent(route,i*100,1,20)),state={x:294.35,y:7,z:-125,yaw:0,speed:0};seedFollowers(cars,state,network.roads);assert.ok(cars.slice(0,3).every(c=>c.z>state.z&&c.x<300&&Math.cos(c.yaw)>.95));});
test('rounded intersection pavement is driveable while the curb interior remains grass',()=>{assert.equal(nearestRoad(network.roads,-5,-155).onSurface,true);assert.equal(nearestRoad(network.roads,-12,-148).onSurface,false);});

test('each departure area seeds visible rear traffic on its local route',()=>{
 const country=sampleRoad(network.rural,160),hill=sampleRoad(network.hill,400);
 const onRoad=p=>({x:p.x+p.tz*2.1,y:p.y,z:p.z-p.tx*2.1,yaw:Math.atan2(-p.tx,-p.tz),speed:0});
 const states=[{x:-2.25,y:.04,z:102,yaw:0,speed:0},{x:-2.25,y:.04,z:28,yaw:0,speed:0},onRoad(country),onRoad(hill),{x:294.35,y:7,z:-125,yaw:0,speed:0},{x:48,y:.04,z:357.8,yaw:-Math.PI/2,speed:0}];
 for(const state of states){const cars=network.routes.flatMap(route=>Array.from({length:6},(_,i)=>{const c=createAgent(route,route.length*(i+.25)/6,i%2?1:-1,14);c.homeRoute=route;positionAgent(c,network.roads);return c;}));
  seedFollowers(cars,state,network.roads);const rear=rearTraffic(cars,state);assert.ok(rear,`rear car missing at ${state.x},${state.z}`);assert.ok(rear.behind<45);assert.ok(!carsOverlap(rear.car,state));
 }
});
test('traffic stops at the marked approach before continuing through',()=>{
 const {road,roads,car}=setup();road.highway=false;road.area='town';road.limit=30;road.width=9;road.widthAt=()=>9;car.d=955;car.speed=7;positionAgent(car,roads);
 const stop={id:'test-stop',x:0,z:0,axis:'z',dir:-1,offset:11};let stopped=false,crossed=false;
 for(let i=0;i<60*25;i++){stepTraffic([car],1/60,{x:50,z:0,yaw:0,speed:0},roads,[],[],'green',[stop]);if(car.z>13.2&&car.z<16.2&&car.speed<.2)stopped=true;if(car.z<13.2){assert.ok(stopped);assert.ok(car.stopHolds['test-stop']>=.9);crossed=true;break;}}
 assert.ok(crossed);
});
test('destroyed traffic is neither simulated, followed, nor reused as rear traffic',()=>{const {roads,player,car}=setup();car.destroyed=true;const before={x:car.x,z:car.z,d:car.d};stepTraffic([car],1/60,player,roads,[],[]);assert.equal(car.x,before.x);assert.equal(car.z,before.z);assert.equal(car.d,before.d);assert.equal(rearTraffic([car],player),null);assert.equal(seedFollowers([car],player,roads),0);});
