export const CAPTURE_SPEED_KMH=5;
export function captureSpeedAllowed(state){return !!state.onFoot||Math.abs(state.speed||0)*3.6<=CAPTURE_SPEED_KMH;}
export class PoliceEncounter{
 constructor(officer){this.officer={...officer};this.elapsed=0;this.done=false;this.knocks=0;}
 step(dt){const previous=this.elapsed;this.elapsed+=Math.max(0,Math.min(.1,dt));const sounds=[.12,.4,.68].filter(t=>previous<t&&this.elapsed>=t).length;this.knocks+=sounds;const p=Math.max(0,Math.min(1,(this.elapsed-.35)/1.25)),turn=p*p*(3-2*p);const ready=!this.done&&this.elapsed>=2.2;if(ready)this.done=true;return {sounds,turn,ready,knocking:this.elapsed<1.05};}
}
