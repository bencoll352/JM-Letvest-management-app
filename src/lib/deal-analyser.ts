export type DealAnalyserInput = {
  guaranteedHeadRent: number;
  projectedRoomRents: number[];
  baselineVoidRate?: number; // default 0.05 (5%)
  monthlyBills: number;
  fiveYearLicenceFee: number;
  monthlyMaintenanceReserve?: number; // default £120
  stressVoidRate?: number; // default 0.12 (12%)
  stressBillsIncreaseRate?: number; // default 0.15 (+15%)
  targetMinSpreadPerRoom?: number; // default £150/room/mo
};

export type DealAnalyserResult = {
  roomCount: number;
  grossMonthlyRoomIncome: number;
  baselineVoidDeduction: number;
  effectiveMonthlyIncome: number;
  guaranteedHeadRent: number;
  monthlyBills: number;
  monthlyLicenceAmortisation: number;
  monthlyMaintenanceReserve: number;
  totalBaselineCosts: number;
  baselineMonthlyNetSpread: number;
  baselineSpreadPerRoom: number;
  stressTest: {
    voidRate: number;
    billsIncreaseRate: number;
    effectiveIncome: number;
    stressedBills: number;
    totalStressedCosts: number;
    stressedMonthlyNetSpread: number;
    stressedSpreadPerRoom: number;
  };
  verdict: 'PASS' | 'BELOW_TARGET_SPREAD' | 'HIGH_RISK_NEGATIVE_STRESS_SPREAD';
  checkWithSolicitor: true;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function evaluateDealAnalyser(input: DealAnalyserInput): DealAnalyserResult {
  const roomCount = input.projectedRoomRents.length;
  if (roomCount === 0) {
    throw new Error('Deal analyser requires at least one room in projectedRoomRents');
  }

  const baselineVoidRate = input.baselineVoidRate ?? 0.05;
  const stressVoidRate = input.stressVoidRate ?? 0.12;
  const stressBillsIncreaseRate = input.stressBillsIncreaseRate ?? 0.15;
  const monthlyMaintenanceReserve = input.monthlyMaintenanceReserve ?? 120;
  const targetMinSpreadPerRoom = input.targetMinSpreadPerRoom ?? 150;

  const grossMonthlyRoomIncome = round2(
    input.projectedRoomRents.reduce((sum, rent) => sum + Math.max(0, Number(rent || 0)), 0)
  );
  const baselineVoidDeduction = round2(grossMonthlyRoomIncome * baselineVoidRate);
  const effectiveMonthlyIncome = round2(grossMonthlyRoomIncome - baselineVoidDeduction);
  const monthlyLicenceAmortisation = round2(Math.max(0, input.fiveYearLicenceFee) / 60);

  const totalBaselineCosts = round2(
    input.guaranteedHeadRent +
      input.monthlyBills +
      monthlyLicenceAmortisation +
      monthlyMaintenanceReserve
  );
  const baselineMonthlyNetSpread = round2(effectiveMonthlyIncome - totalBaselineCosts);
  const baselineSpreadPerRoom = round2(baselineMonthlyNetSpread / roomCount);

  // Stress test calculation (12% void + 15% bills shock)
  const stressedEffectiveIncome = round2(grossMonthlyRoomIncome * (1 - stressVoidRate));
  const stressedBills = round2(input.monthlyBills * (1 + stressBillsIncreaseRate));
  const totalStressedCosts = round2(
    input.guaranteedHeadRent +
      stressedBills +
      monthlyLicenceAmortisation +
      monthlyMaintenanceReserve
  );
  const stressedMonthlyNetSpread = round2(stressedEffectiveIncome - totalStressedCosts);
  const stressedSpreadPerRoom = round2(stressedMonthlyNetSpread / roomCount);

  let verdict: DealAnalyserResult['verdict'] = 'PASS';
  if (stressedMonthlyNetSpread < 0) {
    verdict = 'HIGH_RISK_NEGATIVE_STRESS_SPREAD';
  } else if (baselineSpreadPerRoom < targetMinSpreadPerRoom) {
    verdict = 'BELOW_TARGET_SPREAD';
  }

  return {
    roomCount,
    grossMonthlyRoomIncome,
    baselineVoidDeduction,
    effectiveMonthlyIncome,
    guaranteedHeadRent: round2(input.guaranteedHeadRent),
    monthlyBills: round2(input.monthlyBills),
    monthlyLicenceAmortisation,
    monthlyMaintenanceReserve: round2(monthlyMaintenanceReserve),
    totalBaselineCosts,
    baselineMonthlyNetSpread,
    baselineSpreadPerRoom,
    stressTest: {
      voidRate: stressVoidRate,
      billsIncreaseRate: stressBillsIncreaseRate,
      effectiveIncome: stressedEffectiveIncome,
      stressedBills,
      totalStressedCosts,
      stressedMonthlyNetSpread,
      stressedSpreadPerRoom
    },
    verdict,
    checkWithSolicitor: true
  };
}
