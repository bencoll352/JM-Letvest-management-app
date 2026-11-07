'use client';

import React, { useState } from 'react';
import { evaluateDealAnalyser } from '../lib/deal-analyser';

export function DealAnalyserCard() {
  const [headRent, setHeadRent] = useState(2100);
  const [roomCount, setRoomCount] = useState(6);
  const [avgRoomRent, setAvgRoomRent] = useState(675);
  const [monthlyBills, setMonthlyBills] = useState(580);
  const [licenceFee, setLicenceFee] = useState(1200);

  const result = evaluateDealAnalyser({
    guaranteedHeadRent: headRent,
    projectedRoomRents: Array.from({ length: Math.max(1, roomCount) }, () => avgRoomRent),
    monthlyBills,
    fiveYearLicenceFee: licenceFee
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">R2R HMO Deal Analyser & Downside Stress Test</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
          Verdict: {result.verdict}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <label className="text-xs text-slate-600">
          Head Rent (£/mo)
          <input
            type="number"
            value={headRent}
            onChange={e => setHeadRent(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Lettable Rooms
          <input
            type="number"
            min={1}
            value={roomCount}
            onChange={e => setRoomCount(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Room Rent (£/mo)
          <input
            type="number"
            value={avgRoomRent}
            onChange={e => setAvgRoomRent(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Monthly Bills (£)
          <input
            type="number"
            value={monthlyBills}
            onChange={e => setMonthlyBills(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          5-Yr HMO Licence (£)
          <input
            type="number"
            value={licenceFee}
            onChange={e => setLicenceFee(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3 text-xs">
          <div className="font-semibold text-slate-800">Baseline Case (5% Void Allowance)</div>
          <div className="mt-1">Effective Income: £{result.effectiveMonthlyIncome}/mo</div>
          <div>Net Spread: <strong>£{result.baselineMonthlyNetSpread}/mo</strong> (£{result.baselineSpreadPerRoom}/room)</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-xs">
          <div className="font-semibold text-amber-900">Stress Test (12% Void + 15% Bills Increase)</div>
          <div className="mt-1">Stressed Income: £{result.stressTest.effectiveIncome}/mo</div>
          <div>Stressed Spread: <strong>£{result.stressTest.stressedMonthlyNetSpread}/mo</strong> (£{result.stressTest.stressedSpreadPerRoom}/room)</div>
        </div>
      </div>
    </section>
  );
}
