import {nearestRoad,sampleRoad} from './road-network.js?v=12';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// A directed lane graph: the motorway median cannot be crossed to take a shortcut.
export function createRoadNavigator(roads){
 const nodes=[],grid=new Map(),byRoad=new Map();
 function link(a,b){a.edges.push({to:b.id,cost:dist(a,b)+.1});b.incoming.push(a.id);}
 for(const road of roads){const samples=road.samples.filter((_,i)=>i%2===0);if(samples.at(-1)!==road.samples.at(-1))samples.push(road.samples.at(-1));const rows=[];
  for(const p of samples){const row=[];for(const dir of road.oneWay?[1]:[1,-1]){const lane=road.highway?Math.max(.55,road.widthAt(p.d)/2-6):.55;const n={id:nodes.length,road,d:p.d,dir,cx:p.x,cz:p.z,x:p.x+p.tz*dir*lane,y:p.y,z:p.z-p.tx*dir*lane,tx:p.tx*dir,tz:p.tz*dir,edges:[],incoming:[]};nodes.push(n);row.push(n);const key=Math.floor(p.x/5)+','+Math.floor(p.z/5);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(n);}rows.push(row);}
  for(let i=1;i<rows.length;i++){link(rows[i-1][0],rows[i][0]);if(!road.oneWay)link(rows[i][1],rows[i-1][1]);}if(road.closed){link(rows.at(-1)[0],rows[0][0]);if(!road.oneWay)link(rows[0][1],rows.at(-1)[1]);}else if(!road.oneWay){link(rows[0][1],rows[0][0]);link(rows.at(-1)[0],rows.at(-1)[1]);}byRoad.set(road,rows);
 }
 for(const n of nodes){if(n.road.highway&&n.road.hasBarrier(n.d))continue;const gx=Math.floor(n.cx/5),gz=Math.floor(n.cz/5);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const m of grid.get((gx+dx)+','+(gz+dz))||[]){if(n.road===m.road||Math.abs(n.y-m.y)>1.1||Math.hypot(n.cx-m.cx,n.cz-m.cz)>4.4||m.road.highway&&m.road.hasBarrier(m.d))continue;link(n,m);}}
 function closest(p,heading=true){const road=nearestRoad(roads,p.x,p.z).road,fx=-Math.sin(p.yaw||0),fz=-Math.cos(p.yaw||0);let best=null,cost=Infinity;for(const row of byRoad.get(road))for(const n of row){const score=dist(p,n)+Math.abs((p.y||0)-n.y)*3+(heading?12*(1-fx*n.tx-fz*n.tz):0);if(score<cost){cost=score;best=n;}}return best;}
 function route(from,to){const start=closest(from),goal=closest(to),cost=new Float64Array(nodes.length).fill(Infinity),prev=new Int32Array(nodes.length).fill(-1),open=[];cost[start.id]=0;
  const push=(id,priority)=>{let i=open.length;open.push({id,priority});while(i){const p=(i-1)>>1;if(open[p].priority<=priority)break;[open[p],open[i]]=[open[i],open[p]];i=p;}};
  const pop=()=>{const first=open[0],last=open.pop();if(open.length){open[0]=last;let i=0;while(true){const a=i*2+1,b=a+1;let m=i;if(a<open.length&&open[a].priority<open[m].priority)m=a;if(b<open.length&&open[b].priority<open[m].priority)m=b;if(m===i)break;[open[i],open[m]]=[open[m],open[i]];i=m;}}return first;};
  push(start.id,dist(start,goal));const visited=new Set();while(open.length){const {id}=pop();if(visited.has(id))continue;if(id===goal.id)break;visited.add(id);for(const e of nodes[id].edges){const value=cost[id]+e.cost;if(value<cost[e.to]){cost[e.to]=value;prev[e.to]=id;push(e.to,value+dist(nodes[e.to],goal));}}}
  if(!Number.isFinite(cost[goal.id]))return [];const result=[];for(let id=goal.id;id!==-1;id=prev[id])result.push(nodes[id]);return result.reverse();
 }
 function behind(p,distance){let n=closest(p),walked=0;const seen=new Set([n.id]);while(walked<distance){const options=n.incoming.map(id=>nodes[id]).filter(v=>!seen.has(v.id)).sort((a,b)=>(b.tx*n.tx+b.tz*n.tz)-(a.tx*n.tx+a.tz*n.tz));if(!options.length)break;const next=options[0];walked+=dist(n,next);seen.add(next.id);n=next;}return n;}
 return {nodes,closest,route,behind,roads};
}
export function followRoadPath(a,path,targetSpeed,dt){
 if(!path?.length){a.speed=0;return;}while(a.pathIndex<path.length-1&&dist(a,path[a.pathIndex])<1.1)a.pathIndex++;
 let target=path[Math.min(a.pathIndex,path.length-1)],dx=target.x-a.x,dz=target.z-a.z,d=Math.hypot(dx,dz);if(d<.12){a.speed=0;return;}
 const desired=Math.atan2(-dx,-dz),angle=Math.atan2(Math.sin(desired-a.yaw),Math.cos(desired-a.yaw));const corner=Math.min(targetSpeed,Math.max(3.2,targetSpeed/(1+Math.abs(angle)*2.8)));a.speed+=Math.max(-7*dt,Math.min(3.4*dt,corner-a.speed));const step=Math.min(d,a.speed*dt),oldYaw=a.yaw;a.x+=dx/d*step;a.z+=dz/d*step;a.y+=(target.y-a.y)*Math.min(1,step/Math.max(d,.1));a.yaw+=angle*(1-Math.exp(-7*dt));a.fx=-Math.sin(a.yaw);a.fz=-Math.cos(a.yaw);a.steer=-(a.yaw-oldYaw)*2.65/Math.max(.1,step);
}
export function roadSegmentClear(roads,a,b){for(let i=0;i<=8;i++){const t=i/8,r=nearestRoad(roads,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);if(!r.onSurface||Math.abs(r.y-(a.y+(b.y-a.y)*t))>2)return false;if(r.road.highway&&r.road.hasBarrier(r.d)&&Math.abs(r.side)<.85)return false;}return true;}
