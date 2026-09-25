import {crossedStopLine} from './simulation.js?v=8';
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const SCORING_RULES=[
 ['右左折の合図なし・逆の合図','25','交差点で35°以上曲がったとき'],
 ['右左折の合図が遅い','15','交差点30m手前までに合図を出していない'],
 ['車線変更の合図なし・逆の合図','20','高速道路で走行車線と追越車線を移るとき'],
 ['車線変更の合図が遅い','10','合図から3秒未満で車線を移る'],
 ['一般道の逆走','50','対向車線を2km/h超で1秒走行'],
 ['高速道路の逆走・後退','80 / 40','逆走は0.5秒、後退は1秒で判定'],
 ['黄色の中央線を越える','45','峠道・里山の黄色い線を走行中に横断'],
 ['赤信号で進入','80','赤信号の停止線を越えたとき'],
 ['一時停止をしない','40','「止まれ」の線の手前4m以内で0.8秒停止していない'],
 ['速度超過','20 / 40','制限＋3km/h超が1.5秒。＋20km/h超は3点 / ¥18,000'],
 ['車間距離不足','25','15km/h超で、前車との車間が走行0.8秒分未満の状態が1.5秒'],
 ['横断する歩行者を妨げる','60','前方8m以内の横断者に近づきながら2km/h超で走行'],
 ['歩道・路外を走る','30','車道外を3km/h超で0.8秒走行'],
 ['路側帯への進入・路端との間隔不足','20','車体が白線外へ進入、または路端との間隔50cm未満で走行'],
 ['緊急車両に進路を譲らない','60','接近の告知後、車道内で左へ寄り、交差点を避けて減速する'],
 ['接触事故','70–200','ガードレール・車・建物・電車への接触。歩行者への接触は6点 / ¥50,000']
];
export class RuleBook{
 constructor(onPenalty,{deductScore=true}={}){this.deductScore=deductScore;this.time=0;this.cooldowns=new Map();this.history=[];this.onPenalty=onPenalty;this.resetMotion();}
 resetMotion(){this.timers={speed:0,lane:0,offroad:0,tail:0,reverse:0,person:0};this.turn=null;this.lane=null;this.center=null;this.signalValue=0;this.signalSince=0;this.signalOrigin=null;this.stopped=new Map();}
 penalize(state,key,amount,message,cooldown=6){if((this.cooldowns.get(key)||0)>this.time)return false;if(this.deductScore)state.score=Math.max(0,state.score-amount);this.cooldowns.set(key,this.time+cooldown);this.history.unshift({time:this.time,amount,message});this.history.length=Math.min(12,this.history.length);this.onPenalty?.(message,amount,key);return true;}
 signalCheck(s,direction,kind,q){const missing=s.signal!==direction;const late=!missing&&(kind==='turn'?Math.hypot((this.signalOrigin?.x??s.x)-q.x,(this.signalOrigin?.z??s.z)-q.z)<30:this.time-this.signalSince<3);if(missing)this.penalize(s,kind+'-signal',kind==='turn'?25:20,(kind==='turn'?'右左折':'車線変更')+'の合図なし・方向違い',3);else if(late)this.penalize(s,kind+'-late',kind==='turn'?15:10,(kind==='turn'?'右左折':'車線変更')+'の合図が遅い',3);}
 tick(dt,s,info,previous,junctions,phase,{cars=[],people=[],stops=[]}={}){
  this.time+=dt;const speed=Math.abs(s.speed)*3.6,road=info.road,heading=-Math.sin(s.yaw)*info.tx-Math.cos(s.yaw)*info.tz,onRoad=info.onSurface??info.distance<road.width/2-.3;
  if(s.signal!==this.signalValue){this.signalValue=s.signal;this.signalSince=this.time;this.signalOrigin={x:s.x,z:s.z};}
  const hold=(key,condition,duration,amount,message,cooldown=6)=>{this.timers[key]=condition?(this.timers[key]||0)+dt:0;if(this.timers[key]>=duration){this.penalize(s,key,amount,message,cooldown);this.timers[key]=0;}};
  hold('speed',speed>road.limit+3,1.5,speed>road.limit+20?40:20,'速度超過',4);
  const nearJunction=junctions.some(q=>Math.hypot(q.x-s.x,q.z-s.z)<18),motionHeading=heading*Math.sign(s.speed||1);
  const width=road.widthAt?.(info.d)||road.width,edgeLine=road.edgeLineAt?.(info.d)??width/2-.25;
  const bodyWidth=.88*Math.abs(heading)+2.2*Math.sqrt(Math.max(0,1-heading*heading)),outer=Math.abs(info.side)+bodyWidth;
  hold('shoulder',onRoad&&!nearJunction&&!road.highway&&speed>3&&outer>edgeLine,.55,20,'路側帯へのはみ出し',7);
  hold('clearance',onRoad&&!nearJunction&&!road.highway&&speed>3&&outer<=edgeLine&&width/2-outer<.5,1.2,20,'路端との間隔50cm未満',7);
  const wrong=!(road.highway&&s.speed<0)&&onRoad&&speed>2&&info.side*motionHeading>.8&&Math.abs(heading)>.7&&!nearJunction&&!(s.gear==='R'&&speed<=5&&!road.highway);
  hold('lane',wrong,road.highway?.5:1,road.highway?80:50,road.highway?'高速道路の逆走':'対向車線の逆走',5);
  hold('reverse',road.highway&&s.speed<-.5,1,40,'高速道路での後退',5);
  hold('offroad',!onRoad&&speed>3,.8,30,'歩道・路外の走行',5);
  // A bend in a road is not a junction turn; capture an approach heading only at junctions.
  if(this.turn&&Math.hypot(s.x-this.turn.q.x,s.z-this.turn.q.z)>28)this.turn=null;
  if(!this.turn&&s.speed>.5){const q=junctions.find(q=>Math.hypot(s.x-q.x,s.z-q.z)<20);if(q)this.turn={q,yaw:s.yaw,checked:false};}
  if(this.turn&&!this.turn.checked&&Math.abs(angle(s.yaw-this.turn.yaw))>Math.PI*35/180&&s.speed>.5){this.signalCheck(s,angle(s.yaw-this.turn.yaw)<0?1:-1,'turn',this.turn.q);this.turn.checked=true;}
  const roadKey=road.id||'road',ownSide=info.side*heading;
  if(road.highway&&onRoad&&ownSide<-.7&&Math.abs(heading)>.8&&speed>2){const slot=Math.abs(info.side)>4.2?0:Math.abs(info.side)<3.3?1:null;if(slot!==null){if(this.lane?.id===roadKey&&this.lane.dir===Math.sign(heading)&&this.lane.slot!==slot)this.signalCheck(s,slot===1?1:-1,'lane');this.lane={id:roadKey,dir:Math.sign(heading),slot};}}
  else this.lane=null;
  if(onRoad&&Math.abs(info.side)>.45){const side=Math.sign(info.side);if(this.center?.id===roadKey&&this.center.side!==side&&speed>2&&!nearJunction&&(road.area==='hill'||road.id==='rural'))this.penalize(s,'yellow',45,'黄色の中央線を横断',5);this.center={id:roadKey,side};}
  for(const q of junctions)if(q.signal!==false&&crossedStopLine(previous,s,q,phase))this.penalize(s,'signal:'+q.x+','+q.z,80,'赤信号での進入',10);
  for(const stop of stops){const axis=stop.axis,other=axis==='x'?'z':'x',forward=axis==='x'?-Math.sin(s.yaw):-Math.cos(s.yaw);if(forward*stop.dir<.7||Math.abs(s[other]-stop[other])>4.8)continue;const line=stop[axis]-stop.dir*stop.offset,dist=(line-s[axis])*stop.dir-2.2,prevDist=(line-previous[axis])*stop.dir-2.2;let held=this.stopped.get(stop.id)||0;if(dist>=0&&dist<=4&&Math.abs(s.speed)<.15)held+=dt;else if(dist>45)held=0;this.stopped.set(stop.id,held);if(prevDist>0&&dist<=0&&held<.8)this.penalize(s,'stop:'+stop.id,40,'一時停止なし（止まれ）',12);}
  const fx=-Math.sin(s.yaw),fz=-Math.cos(s.yaw);
  let tail=false;for(const c of cars){if(Math.abs((c.y||0)-(s.y||0))>2.5)continue;const dx=c.x-s.x,dz=c.z-s.z,along=dx*fx+dz*fz,lateral=Math.abs(dx*-fz+dz*fx),same=Math.cos(c.yaw-s.yaw)>.75;if(same&&along>4.4&&lateral<1.9&&along-4.4<Math.max(3,Math.abs(s.speed)*.8))tail=true;}
  hold('tail',tail&&s.speed>15/3.6,1.5,25,'前の車との車間距離不足',5);
  const blocking=people.some(p=>{const dx=p.x-s.x,dz=p.z-s.z,along=dx*fx+dz*fz,lateral=Math.abs(dx*-fz+dz*fx);return p.phase==='cross'&&along>1&&along<8&&lateral<3.8&&Math.abs(s.y||0)<2;});
  hold('person',blocking&&s.speed>2/3.6,.2,60,'横断歩行者の通行を妨げました',8);
 }
}
