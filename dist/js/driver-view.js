// Metres. The eye sits above the driver's seat, behind the steering wheel.
export const DRIVER_EYE={x:.43,y:1.23,z:.64};
export function cockpitFov(aspect){return Math.min(74,2*Math.atan(Math.tan(82*Math.PI/360)/Math.max(.1,aspect))*180/Math.PI);}
