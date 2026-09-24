// One complete day is exactly six minutes of active play, independent of physics FPS.
export const DAY_SECONDS=360;
export const START_HOUR=15.7;
const wrap=h=>((h%24)+24)%24;
const smooth=(lo,hi,x)=>{const t=Math.min(1,Math.max(0,(x-lo)/(hi-lo)));return t*t*(3-2*t);};
export function sampleDay(hour){
 hour=wrap(hour);const a=(hour-6)/24*Math.PI*2,elevation=Math.sin(a)*.9;
 const daylight=smooth(-.14,.28,elevation),night=1-smooth(-.10,.16,elevation),twilight=Math.exp(-(((elevation-.025)/.16)**2));
 const minutes=Math.floor((hour*60+1e-7)%1440),clock=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
 return {hour,clock,elevation,daylight,night,twilight,sunDirection:[Math.cos(a),elevation,Math.sin(a)*Math.sqrt(.19)],period:hour<5?'夜':hour<7?'朝焼け':hour<16.5?'昼':hour<19?'夕焼け':'夜'};
}
export class DayClock{
 constructor(hour=START_HOUR){this.elapsed=0;this.startHour=wrap(hour);}
 advance(seconds,running=true){if(running&&Number.isFinite(seconds)&&seconds>0)this.elapsed+=seconds;return this.sample();}
 sample(){return sampleDay(this.startHour+this.elapsed*24/DAY_SECONDS);}
}
