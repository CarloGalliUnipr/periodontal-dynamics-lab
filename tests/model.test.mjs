import test from 'node:test';
import assert from 'node:assert/strict';
import {hill,plaqueAt,runPeriodic,runRechallenge,equilibriaAtU,forcingForEquilibrium,REFERENCE} from '../docs/model.mjs';
test('Hill response is half-maximal at its threshold',()=>assert.ok(Math.abs(hill(.8,.8,4)-.5)<1e-14));
test('Plaque forcing begins at zero and attains requested peak',()=>{const p={peak:.575,T:60,k:.05};assert.equal(plaqueAt(0,p),0);assert.ok(Math.abs(plaqueAt(60,p)-.575)<1e-12);});
test('Three equilibrium roots exist at comparator baseline',()=>{const roots=equilibriaAtU(.2,REFERENCE);assert.equal(roots.length,3);for(const h of roots)assert.ok(Math.abs(forcingForEquilibrium(h,REFERENCE)-.2)<1e-10);});
test('Periodic simulations have finite trajectories and intact cycle count',()=>{const a=runPeriodic({...REFERENCE,cycles:8});assert.equal(a.cycleMetrics.length,8);assert.ok(a.points.length>100);for(const x of a.points){assert.ok(Number.isFinite(x.H));assert.ok(x.H>=0&&x.H<=1);assert.ok(x.A>=0);}});
test('Rechallenge controls share identical initial H',()=>{const p=runRechallenge({recovery:0,duration:30});assert.ok(Math.abs(p.points[0].treated-p.points[0].naive)<1e-14);assert.ok(p.high>p.low);});
