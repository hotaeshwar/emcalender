import assert from 'assert';
import {
  generateWeeklyAllocation,
  generateDailySchedule,
  decomposeRequirements
} from '../lib/allocationEngine.js';
import {
  calculateDailyEmployeeCapacity,
  calculateWeeklyEmployeeCapacity,
  getEffectiveWorkingDays,
  calculateUtilization
} from '../lib/capacityCalculator.js';
import { ROLES, CONTENT_TYPES, SURPLUS_REASONS } from '../lib/constants.js';

async function runWorkWeekCapacityAllocationTests() {
  console.log('🧪 Starting Work Week & Daily Capacity Allocation Test Suite...\n');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  };

  // Mock standard employees
  const employees = [
    { id: 'emp_gd_1', name: 'Harshita (Designer)', role: ROLES.GRAPHIC_DESIGNER, employeeCode: 'GD01', status: 'active' },
    { id: 'emp_gd_2', name: 'Sahil (Designer)', role: ROLES.GRAPHIC_DESIGNER, employeeCode: 'GD02', status: 'active' },
    { id: 'emp_ve_1', name: 'Gurjeet (Editor)', role: ROLES.VIDEO_EDITOR, employeeCode: 'VE01', status: 'active' },
  ];

  // Mock standard capacity rules
  const capacityRules = [
    {
      id: 'rule_gd',
      role: ROLES.GRAPHIC_DESIGNER,
      dailyLimits: { posts: 3, reels: 1, stories: 1 },
      weights: { posts: 1, reels: 3, stories: 1 },
    },
    {
      id: 'rule_ve',
      role: ROLES.VIDEO_EDITOR,
      dailyLimits: { posts: 0, reels: 3, stories: 1 },
      weights: { posts: 0, reels: 1, stories: 1 },
    }
  ];

  // TEST 1: Baseline Daily Capacities
  await test('1. Baseline Daily Capacities: GD = 7 units/day, VE = 4 units/day', async () => {
    const gdCap = calculateDailyEmployeeCapacity(employees[0], capacityRules);
    const veCap = calculateDailyEmployeeCapacity(employees[2], capacityRules);

    assert.strictEqual(gdCap, 7, 'Graphic Designer daily capacity should be 7 units (3P + 1R [3 units] + 1S)');
    assert.strictEqual(veCap, 4, 'Video Editor daily capacity should be 4 units (3R + 1S)');
  });

  // TEST 2: 3-Day Work Week (Week 1: Thu, Fri, Sat)
  await test('2. 3-Day Work Week (Week 1: 2026-09-02 to 2026-09-05, Thu-Sat active)', async () => {
    const week1 = {
      id: 'week_1',
      name: 'Week 1',
      startDate: '2026-09-02',
      endDate: '2026-09-05',
      workingDates: ['2026-09-03', '2026-09-04', '2026-09-05'], // Thu, Fri, Sat = 3 Days
      holidays: [],
      status: 'active'
    };

    const { effectiveWorkingDaysCount } = getEffectiveWorkingDays(week1, []);
    assert.strictEqual(effectiveWorkingDaysCount, 3, 'Week 1 should have exactly 3 effective working days');

    const gd1Weekly = calculateWeeklyEmployeeCapacity(employees[0], capacityRules, week1.workingDates, []);
    const ve1Weekly = calculateWeeklyEmployeeCapacity(employees[2], capacityRules, week1.workingDates, []);

    assert.strictEqual(gd1Weekly.weeklyCapacityUnits, 21, 'GD Weekly Capacity for 3-day week must be 3 * 7 = 21 units');
    assert.strictEqual(ve1Weekly.weeklyCapacityUnits, 12, 'VE Weekly Capacity for 3-day week must be 3 * 4 = 12 units');

    // Run allocation for Week 1
    const requirements = [
      { clientId: 'c1', clientName: 'Client 1', weekId: 'week_1', requirements: { posts: 4, reels: 2, stories: 2 } }, // 4P (4u) + 2R (6u GD + 2u VE) + 2S (2u GD) = 12u GD, 2u VE
      { clientId: 'c2', clientName: 'Client 2', weekId: 'week_1', requirements: { posts: 6, reels: 2, stories: 0 } }, // 6P (6u) + 2R (6u GD + 2u VE) = 12u GD, 2u VE
    ];

    const result = generateWeeklyAllocation({
      workWeek: week1,
      clients: [{ id: 'c1', name: 'Client 1' }, { id: 'c2', name: 'Client 2' }],
      employees,
      capacityRules,
      workRequirements: requirements,
      holidays: [],
      availabilityList: [],
    });

    assert.strictEqual(result.validation.passed, true, 'Mathematical Invariant must be verified');
    // Total GD capacity across 2 designers = 2 * 21 = 42 units
    // Total GD demand = 12 + 12 = 24 units. Fits comfortably within 42 units!
    // Total VE capacity across 1 editor = 12 units
    // Total VE demand = 4 units. Fits comfortably within 12 units!
    assert.strictEqual(result.surplus.length, 0, 'Should have 0 surplus since demand fits within 3-day capacity');

    // Check Day-Wise schedule distribution: all dates must be from week1.workingDates
    const daily = result.dailySchedules;
    const gdScheduleDates = Object.keys(daily['emp_gd_1']?.days || {});
    assert.deepStrictEqual(gdScheduleDates, week1.workingDates, 'Daily schedule must match Week 1 active dates exactly');
  });

  // TEST 3: 5-Day Work Week (Week 2: Mon-Fri = 5 days)
  await test('3. 5-Day Work Week (Week 2: 2026-09-07 to 2026-09-11, Mon-Fri active)', async () => {
    const week2 = {
      id: 'week_2',
      name: 'Week 2',
      startDate: '2026-09-07',
      endDate: '2026-09-11',
      workingDates: ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'],
      holidays: [],
      status: 'active'
    };

    const gd1Weekly = calculateWeeklyEmployeeCapacity(employees[0], capacityRules, week2.workingDates, []);
    const ve1Weekly = calculateWeeklyEmployeeCapacity(employees[2], capacityRules, week2.workingDates, []);

    assert.strictEqual(gd1Weekly.weeklyCapacityUnits, 35, 'GD Weekly Capacity for 5-day week must be 5 * 7 = 35 units');
    assert.strictEqual(ve1Weekly.weeklyCapacityUnits, 20, 'VE Weekly Capacity for 5-day week must be 5 * 4 = 20 units');
  });

  // TEST 4: 6-Day Work Week (Week 3: Mon-Sat = 6 days)
  await test('4. 6-Day Work Week (Week 3: 2026-09-14 to 2026-09-19, Mon-Sat active)', async () => {
    const week3 = {
      id: 'week_3',
      name: 'Week 3',
      startDate: '2026-09-14',
      endDate: '2026-09-19',
      workingDates: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
      holidays: [],
      status: 'active'
    };

    const gd1Weekly = calculateWeeklyEmployeeCapacity(employees[0], capacityRules, week3.workingDates, []);
    const ve1Weekly = calculateWeeklyEmployeeCapacity(employees[2], capacityRules, week3.workingDates, []);

    assert.strictEqual(gd1Weekly.weeklyCapacityUnits, 42, 'GD Weekly Capacity for 6-day week must be 6 * 7 = 42 units');
    assert.strictEqual(ve1Weekly.weeklyCapacityUnits, 24, 'VE Weekly Capacity for 6-day week must be 6 * 4 = 24 units');
  });

  // TEST 5: Date Generation Fallback when workingDates is not explicitly provided
  await test('5. Fallback Date Generation: Automatically generates dates from startDate & endDate', async () => {
    const weekAuto = {
      id: 'week_auto',
      name: 'Week Auto',
      startDate: '2026-09-07',
      endDate: '2026-09-12', // Mon to Sat = 6 days (excludes Sun)
      holidays: [],
    };

    const { effectiveWorkingDaysCount, effectiveWorkingDates } = getEffectiveWorkingDays(weekAuto, []);
    assert.strictEqual(effectiveWorkingDaysCount, 6, 'Should generate 6 working days (Mon-Sat)');
    assert.strictEqual(effectiveWorkingDates[0], '2026-09-07');
    assert.strictEqual(effectiveWorkingDates[5], '2026-09-12');
  });

  // TEST 6: Custom Employee Daily Capacity Override
  await test('6. Custom Employee Daily Capacity Override is strictly respected', async () => {
    const customEmp = {
      id: 'emp_custom',
      name: 'Custom Pro',
      role: ROLES.GRAPHIC_DESIGNER,
      dailyCapacityUnits: 10, // Explicit custom quota of 10 units/day
      status: 'active'
    };

    const cap = calculateDailyEmployeeCapacity(customEmp, capacityRules);
    assert.strictEqual(cap, 10, 'Should use custom dailyCapacityUnits directly');

    const workingDates = ['2026-09-07', '2026-09-08', '2026-09-09']; // 3 days
    const weekly = calculateWeeklyEmployeeCapacity(customEmp, capacityRules, workingDates, []);
    assert.strictEqual(weekly.weeklyCapacityUnits, 30, 'Weekly capacity should be 3 * 10 = 30 units');
  });

  // TEST 7: Accurate Surplus Generation when demand exceeds a 3-day week vs 6-day week
  await test('7. Capacity Threshold & Surplus: Demand exceeding 3-day week moves to Surplus', async () => {
    const week3Days = {
      id: 'week_short',
      name: 'Short Week',
      startDate: '2026-09-03',
      endDate: '2026-09-05',
      workingDates: ['2026-09-03', '2026-09-04', '2026-09-05'], // 3 days -> VE has 12 units cap
    };

    // Demand: 16 Reels for Video Editor (requires 16 units, but 1 VE only has 12 units for 3 days)
    const reqs = [
      { clientId: 'c_heavy', clientName: 'Heavy Client', weekId: 'week_short', requirements: { posts: 0, reels: 16, stories: 0 } }
    ];

    const result = generateWeeklyAllocation({
      workWeek: week3Days,
      clients: [{ id: 'c_heavy', name: 'Heavy Client' }],
      employees: [employees[2]], // 1 VE
      capacityRules,
      workRequirements: reqs,
    });

    assert.strictEqual(result.validation.passed, true, 'Validation invariant must pass');
    // VE can take at most 12 reels. Remaining 4 reels must be surplus.
    const veAlloc = result.allocations.find(a => a.employeeId === 'emp_ve_1');
    assert.strictEqual(veAlloc?.work?.reels, 12, 'VE should be allocated exactly 12 reels');
    
    const surplusReels = result.surplus.find(s => s.contentType === 'reel' && s.roleRequired === ROLES.VIDEO_EDITOR);
    assert.strictEqual(surplusReels?.quantity, 4, 'Remaining 4 reels must be placed into surplus');
    assert.strictEqual(surplusReels?.reason, SURPLUS_REASONS.INSUFFICIENT_CAPACITY);
  });

  console.log(`\n🎉 Work Week Capacity & Allocation Test Suite Completed: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runWorkWeekCapacityAllocationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
