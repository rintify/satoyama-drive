import * as T from '../vendor/three.module.js';
// Reuse the photographed HDR clouds; recolour them continuously rather than loading four skies.
export function createDaylight(scene,renderer,assets,sun,ambient,world,car,traffic){
 const uniforms={clouds:{value:assets.sky},sunDirection:{value:new T.Vector3()},daylight:{value:1},night:{value:0},twilight:{value:0}};
 const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms,
 vertexShader:'varying vec3 direction; void main(){direction=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`precision highp float;
 uniform sampler2D clouds; uniform vec3 sunDirection; uniform float daylight,night,twilight; varying vec3 direction;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){
  vec3 d=normalize(direction);vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5+.10345,asin(clamp(d.y,-1.,1.))/3.14159265+.5);
  uv.x=fract(uv.x);vec3 photo=texture2D(clouds,uv).rgb;float cloudLuma=dot(photo,vec3(.2126,.7152,.0722));
  float height=clamp(d.y,0.,1.),horizon=exp(-height*5.5),towards=pow(max(0.,dot(normalize(vec3(d.x,.001,d.z)),normalize(vec3(sunDirection.x,.001,sunDirection.z)))),4.);
  vec3 dark=mix(vec3(.014,.026,.057),vec3(.003,.008,.025),sqrt(height));dark+=min(cloudLuma,1.)*vec3(.009,.013,.023);
  vec3 day=photo*.7*mix(vec3(1.),vec3(1.27,.66,.43),twilight*.68);
  vec3 color=mix(dark,day,daylight);
  color+=vec3(.65,.16,.032)*twilight*horizon*(.25+.75*towards);
  float sunDot=dot(d,sunDirection);float disc=smoothstep(.99994,.99999,sunDot);
  color+=vec3(7.,4.2,1.5)*disc*daylight+vec3(.6,.23,.055)*pow(max(sunDot,0.),150.)*twilight;
  float moonDot=dot(d,-sunDirection);float moon=smoothstep(.99988,.99997,moonDot);
  color+=vec3(.7,.82,1.)*moon*night+vec3(.015,.022,.04)*pow(max(moonDot,0.),110.)*night;
  vec2 grid=uv*vec2(850.,425.);float seed=hash(floor(grid));float star=(1.-smoothstep(.015,.17,length(fract(grid)-.5)))*step(.997,seed);
  color+=vec3(.42,.53,.7)*star*night*smoothstep(.08,.35,height)*(1.-min(cloudLuma*.45,.7));
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});
 const sky=new T.Mesh(new T.SphereGeometry(1800,32,16),skyMaterial);sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);scene.background=null;
 const beam=new T.SpotLight('#e8f2ff',0,75,.46,.64,2);beam.position.set(0,.78,-2.26);beam.target.position.set(0,-.35,-38);beam.castShadow=true;beam.shadow.mapSize.set(512,512);beam.shadow.bias=-.0004;beam.shadow.normalBias=.04;beam.shadow.camera.near=.15;car.root.add(beam,beam.target);
 // A fixed light pool avoids one real-time light per street lamp across the entire town.
 const lamps=Array.from({length:4},()=>{const light=new T.PointLight('#ffdaa3',0,27,2);scene.add(light);return light;});
 const nightFog=new T.Color('#19283c'),dayFog=new T.Color('#bacbd1'),warmFog=new T.Color('#c68c77'),nightSky=new T.Color('#64799e'),daySky=new T.Color('#e1edf3'),duskSky=new T.Color('#e6a885'),nightGround=new T.Color('#29394a'),dayGround=new T.Color('#67705b'),sunDay=new T.Color('#fff2db'),sunDusk=new T.Color('#ff9760'),moonColor=new T.Color('#9db7e7');
 const direction=new T.Vector3();let lightTimer=1,lastNight=-1;
 return {update(sample,state,dt=0){
  const {daylight,night,twilight}=sample;sky.position.set(state.x,state.y,state.z);uniforms.sunDirection.value.fromArray(sample.sunDirection);uniforms.daylight.value=daylight;uniforms.night.value=night;uniforms.twilight.value=twilight;
  ambient.color.copy(nightSky).lerp(daySky,daylight).lerp(duskSky,twilight*.32);ambient.groundColor.copy(nightGround).lerp(dayGround,daylight);ambient.intensity=.21+.44*daylight;
  scene.fog.color.copy(nightFog).lerp(dayFog,daylight).lerp(warmFog,twilight*.48);scene.fog.density=.00075+night*.00035;scene.environmentIntensity=.035+.615*daylight;renderer.toneMappingExposure=.94+night*.10;
  direction.fromArray(sample.sunDirection);if(direction.y<0)direction.negate();sun.position.set(state.x+direction.x*135,state.y+Math.max(.06,direction.y)*135,state.z+direction.z*135);sun.target.position.set(state.x,state.y,state.z);sun.target.updateMatrixWorld();sun.color.copy(moonColor).lerp(sunDay,daylight).lerp(sunDusk,twilight*daylight);sun.intensity=.13*night+2.9*Math.max(0,sample.elevation);
  beam.intensity=12500*night;beam.visible=night>.005;
  lightTimer+=dt;if(lightTimer>=.2||Math.abs(night-lastNight)>.02){lightTimer=0;lastNight=night;
   for(const c of [car,...traffic.cars.map(c=>c.model)])c.setNight(night);
   for(const {material,day=0,night:power}of world.nightMaterials)material.emissiveIntensity=day+(power-day)*night;
   const nearest=world.streetLights.map(p=>({p,d:(p.x-state.x)**2+(p.z-state.z)**2})).filter(v=>v.d<55**2).sort((a,b)=>a.d-b.d).slice(0,lamps.length);
   lamps.forEach((light,i)=>{const v=nearest[i];light.intensity=v?95*night:0;if(v)light.position.set(v.p.x,v.p.y,v.p.z);});
  }
 }};
}
