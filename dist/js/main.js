import * as T from '../vendor/three.module.js';
import {createWorld} from './world.js';
import {createCar} from './vehicle.js';
const canvas=document.querySelector('#scene');
try {
const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
const scene=new T.Scene();scene.background=new T.Color('#b4cbd0');scene.fog=new T.FogExp2('#b9c9bb',.0024);scene.add(new T.HemisphereLight('#e1effa','#828268',2.6));const sun=new T.DirectionalLight('#fff0cc',3.1);sun.position.set(-80,100,55);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,near:1,far:330});sun.shadow.bias=-.0008;sun.shadow.normalBias=.045;scene.add(sun,sun.target);
const world=createWorld(scene);const car=createCar('#d7dcce',{player:true});car.root.position.set(-2.2,.07,102);scene.add(car.root);car.interior.visible=false;
const camera=new T.PerspectiveCamera( sixty(),innerWidth/innerHeight,.06,2000);function sixty(){return innerWidth<innerHeight?74: sixtyW()}function sixtyW(){return 61}
camera.position.set(-2.1,2.1,105);camera.lookAt(-1.8,1.9,45);
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);
document.querySelector('#loading').hidden=true;
document.querySelector('#start').onclick=()=>{document.body.classList.add('playing');document.querySelector('#drive-status').textContent='READY';};
renderer.setAnimationLoop(()=>renderer.render(scene,camera));
window.__satoyama={scene,renderer,camera,world,car};
} catch(error){document.querySelector('#loading-message').textContent='3D表示を開始できませんでした。WebGL対応のブラウザで開いてください。';console.error(error);}
