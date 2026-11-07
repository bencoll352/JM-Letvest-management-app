import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spread,totals,daysUntil } from '../src/lib/finance.ts';
test('vacant rooms earn no scheduled revenue but fixed costs remain',()=>{assert.equal(spread({occupied:0,roomRent:750,headRent:2000,expenses:500}),-2500);assert.equal(spread({occupied:4,roomRent:750,headRent:2000,expenses:500}),500)});
test('empty portfolio has zero totals',()=>assert.deepEqual(totals([]),{revenue:0,cost:0,net:0,occupied:0,rooms:0}));
test('compliance includes the 30 day boundary and expired dates',()=>{const now=new Date(2026,9,29);assert.equal(daysUntil('2026-11-28',now),30);assert.equal(daysUntil('2026-10-28',now),-1)});
