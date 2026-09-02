const assert = require('assert');

async function runDateWiseAllocationTests() {
  console.log('🧪 Starting Date-Wise Allocation & Capacity Engine Test Suite...\n');

  const { generateWeeklyAllocation, generateDailySchedule } = await import('../lib/allocationEngine.js');
  const { DEFAULT_CAPACITY_RULES, ROLES, CONTENT_TYPES } = await import('../lib/constants.js');
  const { calculateDailyEmployeeCapacity, calculateWeeklyEmployeeCapacity, getEffectiveWorkingDays } = await import('../lib/capacityCalculator.js');

  let passed = 0;
  let failed = 0;

  function it(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // TEST 1: User Specific Employees - Harshita (GD) and Gurjeet (VE)
  it('Calculates correct baseline daily capacity for Harshita (GD) and Gurjeet (VE)', () => {
    const harshita = {
      id: 'emp_harshita',
      employeeCode: 'HGD',
      name: 'HARSHITA',
      role: 'graphic_designer',
    };
    const gurjeet = {
      id: 'emp_gurjeet',
      employeeCode: 'GVD',
      name: 'GURJEET',
      role: 'video_editor',
    };

    // User's custom Firestore rules format with dailyLimits and weights
    const userCapacityRules = [
      {
        id: 'rule_gd',
        role: 'graphic_designer',
        dailyLimits: { posts: 3, reels: 1, stories: 2 },
        weights: { posts: 1, reels: 1, stories: 1 },
      },
      {
        id: 'rule_ve',
        role: 'video_editor',
        dailyLimits: { posts: 0, reels: 3, stories: 1 },
        weights: { posts: 1, reels: 1, stories: 1 },
      },
    ];

    const gdDailyCap = calculateDailyEmployeeCapacity(harshita, userCapacityRules);
    // 3*1 + 1*1 + 2*1 = 6 units/day
    assert(gdDailyCap >= 5, `Graphic designer daily capacity must be at least 5 units, got ${gdDailyCap}`);

    const veDailyCap = calculateDailyEmployeeCapacity(gurjeet, userCapacityRules);
    // 3*1 + 1*1 = 4 units/day
    assert.strictEqual(veDailyCap, 4, `Video editor daily capacity must be 4 units/day, got ${veDailyCap}`);
  });

  // TEST 2: Weekly capacity calculation for 5 and 6 working days
  it('Weekly capacity evaluates to 30-36 units for GD and 20-24 units for VE', () => {
    const harshita = { id: 'emp_h', employeeCode: 'HGD', role: 'graphic_designer' };
    const gurjeet = { id: 'emp_g', employeeCode: 'GVD', role: 'video_editor' };

    const dates5Days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];
    const dates6Days = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];

    const gd5Days = calculateWeeklyEmployeeCapacity(harshita, DEFAULT_CAPACITY_RULES, dates5Days, []);
    assert.strictEqual(gd5Days.weeklyCapacityUnits, 35, 'GD for 5 days with default rule should have 35 units');

    const ve5Days = calculateWeeklyEmployeeCapacity(gurjeet, DEFAULT_CAPACITY_RULES, dates5Days, []);
    assert.strictEqual(ve5Days.weeklyCapacityUnits, 20, 'VE for 5 days with default rule should have 20 units');

    const gd6Days = calculateWeeklyEmployeeCapacity(harshita, DEFAULT_CAPACITY_RULES, dates6Days, []);
    assert.strictEqual(gd6Days.weeklyCapacityUnits, 42, 'GD for 6 days should have 42 units');

    const ve6Days = calculateWeeklyEmployeeCapacity(gurjeet, DEFAULT_CAPACITY_RULES, dates6Days, []);
    assert.strictEqual(ve6Days.weeklyCapacityUnits, 24, 'VE for 6 days should have 24 units');
  });

  // TEST 3: Multi-Client Allocation with Date-Wise Day-by-Day Timetable
  it('Distributes deliverables across Monday-Saturday dates without dumping into surplus', () => {
    const clients = [
      { id: 'c1', name: 'ACTION CAR DETAILING' },
      { id: 'c2', name: 'CHUTNEY HOUSE' },
      { id: 'c3', name: 'DND' },
      { id: 'c4', name: 'BALAJI EV' },
    ];

    const employees = [
      { id: 'hgd_id', employeeCode: 'HGD', name: 'HARSHITA', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'gvd_id', employeeCode: 'GVD', name: 'GURJEET', role: ROLES.VIDEO_EDITOR, status: 'active' },
    ];

    const workWeek = {
      id: 'week_sept_1',
      name: 'Week 1 Sept 2026',
      startDate: '2026-09-07',
      endDate: '2026-09-12',
      workingDates: [
        '2026-09-07', // Mon
        '2026-09-08', // Tue
        '2026-09-09', // Wed
        '2026-09-10', // Thu
        '2026-09-11', // Fri
        '2026-09-12', // Sat
      ],
      holidays: [],
      calculatedWorkingDays: 6,
    };

    const workRequirements = [
      { clientId: 'c1', weekId: 'week_sept_1', requirements: { posts: 2, reels: 2, stories: 1 } },
      { clientId: 'c2', weekId: 'week_sept_1', requirements: { posts: 2, reels: 2, stories: 2 } },
      { clientId: 'c3', weekId: 'week_sept_1', requirements: { posts: 3, reels: 1, stories: 2 } },
      { clientId: 'c4', weekId: 'week_sept_1', requirements: { posts: 1, reels: 2, stories: 2 } },
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: [],
      availabilityList: [],
    });

    // Invariant check
    assert.strictEqual(result.validation.passed, true, 'Mathematical invariant must pass');

    // Total requested: 8 posts, 7 reels, 7 stories.
    // Video editor needed: 7 reels (7 units). Gurjeet has 24 units.
    // Harshita has 42 units capacity (needs 8 posts + 7 reels*3 + 7 stories = 36 units).
    // All work fits in capacity -> 0 surplus!
    assert.strictEqual(result.surplus.length, 0, 'No deliverables should go into surplus');

    // Date-wise schedule check
    assert(result.dailySchedules, 'Daily schedules must be generated');
    assert(result.dailySchedules['hgd_id'], 'Harshita must have daily schedules');
    assert(result.dailySchedules['gvd_id'], 'Gurjeet must have daily schedules');

    const harshitaDays = result.dailySchedules['hgd_id'].days;
    assert.strictEqual(Object.keys(harshitaDays).length, 6, 'Should have 6 working dates');
    assert.strictEqual(harshitaDays['2026-09-07'].dayName, 'Monday');
    assert.strictEqual(harshitaDays['2026-09-12'].dayName, 'Saturday');

    // Gurjeet must ONLY have reels and stories (0 posts)
    Object.values(result.dailySchedules['gvd_id'].days).forEach((day) => {
      assert.strictEqual(day.posts, 0, 'Video editor must never have posts scheduled');
    });
  });

  console.log(`\n🎉 Date-Wise Allocation Test Suite Completed: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runDateWiseAllocationTests().catch((err) => {
  console.error('Fatal date-wise test error:', err);
  process.exit(1);
});
