import test from 'node:test';
import assert from 'node:assert/strict';
import {hill,plaqueAt,runPeriodic,runRechallenge,runGingivitis,equilibriaAtU,forcingForEquilibrium,REFERENCE,UNIT_DAYS} from '../docs/model.mjs';
const near=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} should be within ${tol} of ${b}`);
test('Hill response is half-maximal at threshold',()=>near(hill(.8,.8,4),.5,1e-14));
test('Plaque starts at zero and attains requested peak',()=>{const p={peak:.575,T:60,k:.05};near(plaqueAt(0,p),0,1e-14);near(plaqueAt(60,p),.575,1e-12);});
test('Three equilibrium branches at comparison baseline',()=>{const roots=equilibriaAtU(.2,REFERENCE);assert.equal(roots.length,3);for(const h of roots)near(forcingForEquilibrium(h,REFERENCE),.2,1e-9);});
test('Experiments 14C: three progression criteria are implemented independently',()=>{
 const r=runPeriodic({...REFERENCE,cycles:60});
 assert.equal(r.cycleMetrics.length,60);assert.ok(r.points.length>100);
 assert.ok(r.firstInflamed!==null&&r.firstDamaging!==null&&r.memoryConversion!==null);
 assert.ok(r.firstInflamed<=r.firstDamaging);assert.ok(r.firstInflamed<=r.memoryConversion);
 for(const p of r.points){assert.ok(Number.isFinite(p.H)&&Number.isFinite(p.A));assert.ok(p.H>=0&&p.H<=1);}
});
test('Experiment 14B: debridement begins with diseased H and reset M; comparison retains naive low H',()=>{
 const r=runRechallenge({epsilon:.03,recovery:0,duration:50,protocol:'treatment'});
 assert.ok(r.points[0].treated>.9);assert.ok(r.points[0].naive<.01);
 assert.ok(r.challengeStart===4);assert.ok(r.challengeEnd===54);
});
test('Earlier matched-state reset is available as a control with equal H at t0',()=>{
 const r=runRechallenge({protocol:'reset',recovery:0,duration:30});
 near(r.points[0].treated,r.points[0].naive,1e-12);
 assert.equal(r.challengeStart,0);
});
test('Experiment 14A: fixed 21-day challenge and expected qualitative contrasts',()=>{
 const r=runGingivitis({epsilon:.03,recoveryDays:0,U:.4,baseline:.1,D:.1});
 assert.equal(r.histories.length,3);
 assert.equal(r.histories[0].trace.at(-1).t,21);
 assert.ok(r.histories[0].peak<r.histories[1].peak);
 assert.ok(r.histories[1].peak<r.histories[2].peak);
 // Reference export 14A: eps=.03, baseline=.10, U=.40, recovery=0;
 // peak_H naive 0.06076, treated D0 0.97972, treated D=.10 0.99007.
 // Loose tolerance flags a major mismatch without claiming a bitwise reimplementation.
 near(r.histories[0].peak,.0607617055,.01);
 near(r.histories[1].peak,.9797228753,.015);
 near(r.histories[2].peak,.9900747263,.015);
});
test('Illustrative time conversion is 1.667 days per unit',()=>near(12.6*UNIT_DAYS,21,1e-12));
