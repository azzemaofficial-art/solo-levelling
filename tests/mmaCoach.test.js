import test from 'node:test';
import assert from 'node:assert/strict';
import { observeMmaPose, createMmaObserver, initialMmaClock, advanceMmaClock, summarizeMmaSession } from '../lib/mmaCoachEngine.js';
import { readMmaStore, saveMmaReport } from '../lib/mmaCoachStorage.js';

function pose() {
  const points = Array.from({length:33}, () => ({ x:.5, y:.5, visibility:.99 }));
  for (const [i,x,y] of [[0,.5,.15],[11,.4,.32],[12,.6,.32],[13,.33,.44],[14,.67,.44],[15,.4,.24],[16,.6,.24],[23,.43,.6],[24,.57,.6],[25,.4,.73],[26,.6,.73],[27,.37,.9],[28,.63,.9]]) points[i] = { x,y,visibility:.99 };
  return points;
}
function extended(side='L') {
  const p=pose();
  const elbow=side==='L'?13:14, wrist=side==='L'?15:16;
  p[elbow]={x:side==='L'?.24:.76,y:.32,visibility:.99};
  p[wrist]={x:side==='L'?.08:.92,y:.32,visibility:.99};
  return p;
}
function driver(options={}) {
  const observer=createMmaObserver(options); let now=0;
  return { observer, run(points,ms,opts={}) {let result;for(let i=0;i<ms;i+=100){now+=100;result=observer.update(points,now,opts);}return result;}, gap(ms){now+=ms;}, calibrate(){return this.run(pose(),2300,{calibrate:true});} };
}
test('calibration needs two continuous seconds with the whole body and both hands in guard',()=>{
  const d=driver();assert.equal(d.run(pose(),1500,{calibrate:true}).calibrated,false);
  const hidden=pose();hidden[27].visibility=.2;d.run(hidden,100,{calibrate:true});
  assert.equal(d.run(pose(),1500,{calibrate:true}).calibrated,false);
  assert.equal(d.run(pose(),700,{calibrate:true}).calibrated,true);
});
test('missing confidence, hands outside frame, and degenerate shoulders cannot be evaluated',()=>{
  for(const i of [0,11,12,13,14,15,16,23,24]){const p=pose();p[i].visibility=.2;assert.equal(observeMmaPose(p).visible,false);}
  const p=pose();p[15].x=1.1;assert.equal(observeMmaPose(p).visible,false);
  assert.equal(observeMmaPose([]).visible,false);
});
test('angles use aspect ratio so a portrait crop does not change the same geometry',()=>{
  const a=pose(), b=pose().map(p=>({...p,x:.5+(p.x-.5)/2}));
  const A=observeMmaPose(a,1), B=observeMmaPose(b,2);
  assert.ok(Math.abs(A.arms.L.angle-B.arms.L.angle)<.0001);assert.equal(A.bothGuard,B.bothGuard);
});
test('a straight counts only after guard, extension and a stable return',()=>{
  const d=driver({lessonId:'jab'});d.calibrate();d.run(pose(),300,{active:true});
  d.run(extended(),400,{active:true});assert.equal(d.observer.snapshot().jab,0);
  d.run(pose(),300,{active:true});assert.equal(d.observer.snapshot().jab,1);
  d.run(pose(),3000,{active:true});assert.equal(d.observer.snapshot().jab,1);
});
test('alternating arms is not a combo unless lead precedes rear with complete returns',()=>{
  const d=driver({lessonId:'one-two'});d.calibrate();d.run(pose(),300,{active:true});
  d.run(extended('R'),400,{active:true});d.run(pose(),300,{active:true});assert.equal(d.observer.snapshot().combos,0);
  d.run(extended('L'),400,{active:true});d.run(pose(),300,{active:true});
  d.run(extended('R'),400,{active:true});d.run(pose(),300,{active:true});assert.equal(d.observer.snapshot().combos,1);
});
test('southpaw swaps the anatomical lead and rear without relying on mirrored pixels',()=>{
  const d=driver({lessonId:'jab',lead:'R'});d.calibrate();d.run(pose(),300,{active:true});d.run(extended('R'),400,{active:true});d.run(pose(),300,{active:true});
  assert.equal(d.observer.snapshot().jab,1);assert.equal(d.observer.snapshot().cross,0);
});
test('occlusion, frame gaps and pause discard a half-finished punch',()=>{
  for(const interruption of ['occlusion','gap','pause']){
    const d=driver({lessonId:'jab'});d.calibrate();d.run(pose(),300,{active:true});d.run(extended(),300,{active:true});
    if(interruption==='occlusion')d.run([],200,{active:true});
    if(interruption==='gap')d.gap(900);
    if(interruption==='pause')d.run(pose(),200,{active:false});
    d.run(pose(),400,{active:true});assert.equal(d.observer.snapshot().jab,0,interruption);
  }
});
test('holding the extended arm never manufactures repeated punches',()=>{
  const d=driver({lessonId:'jab'});d.calibrate();d.run(pose(),300,{active:true});d.run(extended(),6000,{active:true});d.run(pose(),400,{active:true});assert.equal(d.observer.snapshot().jab,0);
});
test('unobserved periods cannot increase guard or observed time',()=>{
  const d=driver();d.calibrate();d.run(pose(),1000,{active:true});const before=d.observer.snapshot();d.run([],2000,{active:true});
  const after=d.observer.snapshot();assert.equal(after.guardMs,before.guardMs);assert.equal(after.observedMs,before.observedMs);
});
test('clock handles warmup, countdown, rest, final round and overshoot without adding rounds',()=>{
  const config={rounds:2,workMs:60000,restMs:60000};
  let c=advanceMmaClock({phase:'warmup',round:1,remaining:180000,completed:0},180000,config);
  assert.equal(c.phase,'countdown');assert.equal(c.remaining,5000);
  c=advanceMmaClock(c,65000,config);assert.equal(c.phase,'rest');assert.equal(c.completed,1);assert.equal(c.round,2);
  c=advanceMmaClock(c,125000,config);assert.equal(c.phase,'done');assert.equal(c.completed,2);assert.equal(c.remaining,0);
  assert.equal(advanceMmaClock(initialMmaClock(),7000,config).remaining,58000);
});
test('no-camera and low-coverage sessions cannot invent a technique metric',()=>{
  const stats={observedMs:2000,guardEligibleMs:2000,guardMs:2000};
  const config={lessonId:'stance',rounds:3,completed:3,activeMs:360000,mode:'camera'};
  const r=summarizeMmaSession(stats,config);assert.equal(r.guard,null);assert.equal(r.practiced,false);assert.equal(r.enough,false);
  const guided=summarizeMmaSession({}, {...config,mode:'guided'});assert.equal(guided.guard,null);assert.equal(guided.coverage,0);assert.equal(guided.practiced,true);
});
test('history survives preference changes, deduplicates a reflected session and preserves existing data',()=>{
  let json=JSON.stringify({done:{stance:true},stage:2,lessonId:'clinch',legacy:'keep'});
  const storage={getItem:()=>json,setItem:(_,v)=>{json=v;}};
  const report={id:'one',lessonId:'jab',practiced:false};saveMmaReport(report,storage);saveMmaReport({...report,selfCheck:[0]},storage);
  const result=readMmaStore(storage);assert.equal(result.history.length,1);assert.equal(result.legacy,'keep');assert.equal(result.stage,2);assert.equal(result.done.jab,undefined);assert.deepEqual(result.history[0].selfCheck,[0]);
  assert.equal(saveMmaReport(report,{getItem:()=>null,setItem:()=>{throw Error('quota');}}),false);
});
test('one noisy extended frame and simultaneous arms do not manufacture a 1–2',()=>{
  const d=driver({lessonId:'one-two'});d.calibrate();d.run(pose(),300,{active:true});
  d.run(extended(),100,{active:true});d.run(pose(),400,{active:true});assert.equal(d.observer.snapshot().jab,0);
  const both=extended('L'), right=extended('R');both[14]=right[14];both[16]=right[16];
  d.run(both,400,{active:true});d.run(pose(),300,{active:true});assert.equal(d.observer.snapshot().combos,0);
});
