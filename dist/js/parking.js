// Four driveable decks and three stacked, two-way ramps. Height continuity chooses
// the deck under the wheels; X/Z alone must never teleport a car between storeys.
export const GARAGE={x0:420,x1:492,z0:-435,z1:-335,levels:4,height:4,rampX0:473,rampX1:491,rampZ0:-420,rampZ1:-350};
export function parkingSurface(x,z,referenceY=0,available=()=>true){
 const g=GARAGE;if(x<g.x0||x>g.x1||z<g.z0||z>g.z1)return null;
 const ramp=x>=g.rampX0&&z>g.rampZ0&&z<g.rampZ1;
 const candidates=[];
 if(ramp){for(let i=0;i<g.levels-1;i++)candidates.push({y:.04+i*g.height+(g.rampZ1-z)/(g.rampZ1-g.rampZ0)*g.height,grade:-g.height/(g.rampZ1-g.rampZ0),level:i+1,ramp:true});}
 else for(let i=0;i<g.levels;i++)candidates.push({y:.04+i*g.height,grade:0,level:i+1,ramp:false});
 return candidates.filter(c=>available(c.y)).sort((a,b)=>Math.abs(a.y-referenceY)-Math.abs(b.y-referenceY))[0]||null;
}
