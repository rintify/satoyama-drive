// Metres. The eye sits above the driver's seat, behind the steering wheel.
export const DRIVER_EYE={x:.43,y:1.23,z:.64};
export function cockpitFov(aspect){return Math.min(74,2*Math.atan(Math.tan(82*Math.PI/360)/Math.max(.1,aspect))*180/Math.PI);}
export const SEAT_LIMITS={fore:[-.24,.24],height:[-.12,.16]};
export function seatPosition(value={}){const seat={};for(const key of ['fore','height']){const n=Number(value?.[key]);seat[key]=Number.isFinite(n)?Math.max(SEAT_LIMITS[key][0],Math.min(SEAT_LIMITS[key][1],n)):0;}return seat;}
export function driverEye(seat={}){const p=seatPosition(seat);return {x:DRIVER_EYE.x,y:DRIVER_EYE.y+p.height,z:DRIVER_EYE.z-p.fore};}
