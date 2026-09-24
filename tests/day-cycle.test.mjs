import test from 'node:test';
import assert from 'node:assert/strict';
import {DayClock,sampleDay,DAY_SECONDS} from '../dist/js/day-cycle.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('one day takes 360 active seconds and passes smoothly through midnight',()=>{
 const clock=new DayClock(15.7);assert.equal(DAY_SECONDS,360);close(clock.advance(90).hour,21.7);close(clock.advance(90).hour,3.7);close(clock.advance(180).hour,15.7);assert.equal(clock.sample().clock,'15:42');
 const end=sampleDay(23.999999),start=sampleDay(24);assert.equal(start.clock,'00:00');close(end.daylight,start.daylight);close(end.night,start.night);
});
test('pausing freezes time and frame rate cannot change the day length',()=>{
 const clock=new DayClock(6);clock.advance(100,false);assert.equal(clock.sample().clock,'06:00');clock.advance(15);assert.equal(clock.sample().clock,'07:00');
 const fine=new DayClock(6),slow=new DayClock(6);for(let i=0;i<3600;i++)fine.advance(1/60);for(let i=0;i<20;i++)slow.advance(3);close(fine.sample().hour,slow.sample().hour);clock.advance(NaN);clock.advance(-20);assert.equal(clock.sample().clock,'07:00');
});
test('daylight, twilight and automatic lighting are bounded and continuous all day',()=>{
 const noon=sampleDay(12),night=sampleDay(0),sunset=sampleDay(18);assert.equal(noon.daylight,1);assert.equal(noon.night,0);assert.equal(night.night,1);assert.equal(night.daylight,0);assert.ok(sunset.twilight>.95);
 let prev=sampleDay(0);for(let h=.01;h<=24;h+=.01){const s=sampleDay(h);close(Math.hypot(...s.sunDirection),1);for(const key of ['daylight','night','twilight']){assert.ok(s[key]>=0&&s[key]<=1);assert.ok(Math.abs(s[key]-prev[key])<.03);}prev=s;}
});
