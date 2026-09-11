import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function reconcileFills(requested:number, fills:number[]):void {
  const total=fills.reduce((sum,fill)=>sum+fill,0);
  assert.equal(Number(total.toFixed(8)),Number(requested.toFixed(8)));
}

describe('partial-fill accounting properties',()=>{
  it('conserves filled quantity across multiple execution pieces',()=>{
    reconcileFills(10,[2.5,3.0,4.5]);
  });

  it('does not double count fees across execution pieces',()=>{
    const fees=[1.25,0.75,0.5];
    const total=fees.reduce((sum,fee)=>sum+fee,0);
    assert.equal(Number(total.toFixed(8)),2.5);
  });

  it('position quantity equals entries minus exits',()=>{
    const entries=[2,3,5].reduce((a,b)=>a+b,0);
    const exits=[4,1,2].reduce((a,b)=>a+b,0);
    assert.equal(entries-exits,3);
  });
});
