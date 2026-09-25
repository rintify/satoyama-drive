import test from 'node:test';import assert from 'node:assert/strict';
import {resolveImpact,createVehicleState} from '../dist/js/simulation.js';
import {cockpitFov,DRIVER_EYE} from '../dist/js/driver-view.js';
test('impact stops contact without changing gear, parking brake, pedal inputs or steering',()=>{const s={...createVehicleState(),gear:'D',parking:false,throttle:.6,brake:.2,steering:145,speed:9,x:4,z:8};resolveImpact(s,{x:3,z:9});assert.deepEqual([s.x,s.z,s.speed,s.gear,s.parking,s.throttle,s.brake,s.steering],[3,9,0,'D',false,.6,.2,145]);});
test('landscape camera preserves horizontal scale and portrait view stays bounded',()=>{for(const a of [16/9,844/390]){const v=cockpitFov(a)*Math.PI/180;assert.ok(Math.abs(2*Math.atan(Math.tan(v/2)*a)*180/Math.PI-82)<1e-8);}assert.equal(cockpitFov(390/844),74);assert.ok(DRIVER_EYE.z+.13>.7);});
