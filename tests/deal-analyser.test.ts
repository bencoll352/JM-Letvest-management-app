import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDealAnalyser } from '../src/lib/deal-analyser.ts';

test('evaluateDealAnalyser calculates baseline spread, HMO licence amortisation, and 12% void + 15% bills stress test', () => {
  // 6-bed HMO @ £675/room = £4,050 gross; 5% void = £202.50 -> £3,847.50 effective
  // Costs: £2,100 head rent + £580 bills + £20 licence (£1,200 / 60) + £120 reserve = £2,820
  // Baseline net spread = £1,027.50 (£171.25/room >= £150 target -> PASS)
  const strongDeal = evaluateDealAnalyser({
    guaranteedHeadRent: 2100,
    projectedRoomRents: [675, 675, 675, 675, 675, 675],
    monthlyBills: 580,
    fiveYearLicenceFee: 1200,
    monthlyMaintenanceReserve: 120
  });

  assert.equal(strongDeal.grossMonthlyRoomIncome, 4050);
  assert.equal(strongDeal.monthlyLicenceAmortisation, 20);
  assert.equal(strongDeal.baselineMonthlyNetSpread, 1027.5);
  assert.equal(strongDeal.baselineSpreadPerRoom, 171.25);
  assert.equal(strongDeal.verdict, 'PASS');
  assert.ok(strongDeal.stressTest.stressedMonthlyNetSpread > 0);
  assert.equal(strongDeal.checkWithSolicitor, true);

  // Over-leveraged head rent turns negative under 12% void + 15% bills stress test
  const riskyDeal = evaluateDealAnalyser({
    guaranteedHeadRent: 2950,
    projectedRoomRents: [650, 650, 650, 650, 650, 650],
    monthlyBills: 600,
    fiveYearLicenceFee: 1500,
    monthlyMaintenanceReserve: 120
  });

  assert.equal(riskyDeal.verdict, 'HIGH_RISK_NEGATIVE_STRESS_SPREAD');
  assert.ok(riskyDeal.stressTest.stressedMonthlyNetSpread < 0);
});
