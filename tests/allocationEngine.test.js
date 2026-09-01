const assert = require('assert');

// Simple ES module / CommonJS test harness
async function runTests() {
  console.log('🧪 Starting Allocation Engine Test Suite...\n');

  // Dynamic import of ES modules
  const { generateWeeklyAllocation, decomposeRequirements } = await import('../lib/allocationEngine.js');
  const { DEFAULT_CAPACITY_RULES, ROLES, CONTENT_TYPES, SURPLUS_REASONS } = await import('../lib/constants.js');
  const { getEffectiveWorkingDays, calculateDailyEmployeeCapacity, calculateWeeklyEmployeeCapacity } = await import('../lib/capacityCalculator.js');

  let passed = 0;
  let failed = 0;

  function it(testName, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${testName}`);
      console.error(err);
      failed++;
    }
  }

  // TEST 1: Working days & holiday calculation
  it('Calculates effective working days correctly with holidays', () => {
    const week = {
      id: 'week_1',
      workingDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'],
    };
    const holidays = [
      { holidayDate: '2026-09-05', name: 'Ganesh Chaturthi' }
    ];

    const res = getEffectiveWorkingDays(week, holidays);
    assert.strictEqual(res.effectiveWorkingDaysCount, 5, 'Effective days should be 6 - 1 = 5');
    assert.deepStrictEqual(res.holidayDates, ['2026-09-05']);
    assert(!res.effectiveWorkingDates.includes('2026-09-05'));
  });

  // TEST 2: Daily Capacity calculation
  it('Calculates daily capacity units correctly based on capacity rules', () => {
    const designer = { id: 'd1', name: 'Designer A', role: ROLES.GRAPHIC_DESIGNER };
    const editor = { id: 'e1', name: 'Editor A', role: ROLES.VIDEO_EDITOR };

    const designerDaily = calculateDailyEmployeeCapacity(designer, DEFAULT_CAPACITY_RULES);
    // Graphic Designer: 3*1 (post) + 1*3 (reel) + 1*1 (story) = 7 units
    assert.strictEqual(designerDaily, 7, 'Graphic designer daily capacity should be 7 units');

    const editorDaily = calculateDailyEmployeeCapacity(editor, DEFAULT_CAPACITY_RULES);
    // Video Editor: 3*1 (reel) + 1*1 (story) = 4 units
    assert.strictEqual(editorDaily, 4, 'Video editor daily capacity should be 4 units');
  });

  // TEST 3: Core Business Scenario from prompt
  // Employees: Designer A, Designer B, Editor A
  // 5 effective working days
  // Requirement: 20 Posts, 8 Reels, 7 Stories
  it('Core Business Scenario: Fair distribution across Designer A, Designer B, and Editor A', () => {
    const clients = [
      { id: 'c1', name: 'XYZ Corp', clientCode: 'XYZ001' }
    ];
    const employees = [
      { id: 'emp_gd_1', employeeCode: 'EMP001', name: 'Designer A', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp_gd_2', employeeCode: 'EMP002', name: 'Designer B', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp_ve_1', employeeCode: 'EMP003', name: 'Editor A', role: ROLES.VIDEO_EDITOR, status: 'active' },
    ];
    const workWeek = {
      id: 'week_1',
      name: 'Week 1',
      workingDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    };
    const workRequirements = [
      {
        clientId: 'c1',
        clientName: 'XYZ Corp',
        weekId: 'week_1',
        requirements: {
          posts: 20,
          reels: 8,
          stories: 7
        }
      }
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: [],
      availabilityList: []
    });

    // Invariant check
    assert.strictEqual(result.validation.passed, true, 'Mathematical invariant must pass');
    assert.strictEqual(result.validation.errors.length, 0);

    // Designer A and B total capacity = 2 * 5 * 7 = 70 units
    // Required graphic design units: 20*1 (posts) + 8*3 (reels) + 7*1 (stories) = 51 units.
    // Both designers should receive balanced workload
    const utilA = result.employeeUtilization['emp_gd_1'];
    const utilB = result.employeeUtilization['emp_gd_2'];
    const utilEditor = result.employeeUtilization['emp_ve_1'];

    assert(utilA.usedCapacityUnits > 0, 'Designer A should have assigned work');
    assert(utilB.usedCapacityUnits > 0, 'Designer B should have assigned work');
    
    // Balanced distribution check: difference between Designer A and Designer B used capacity should be minimal
    const diff = Math.abs(utilA.usedCapacityUnits - utilB.usedCapacityUnits);
    assert(diff <= 4, `Fairness rule: Designers should have balanced workload, diff was ${diff}`);

    // Video Editor check:
    // Editor A has 8 reels video component = 8 units. 8 / 20 = 40% utilization.
    assert.strictEqual(utilEditor.assignedWork.reels, 8, 'Editor A should receive all 8 video reels');
    assert.strictEqual(result.surplus.length, 0, 'There should be 0 surplus for this scenario');
  });

  // TEST 4: Holiday reduces capacity and generates surplus if work exceeds reduced capacity
  it('Holiday reduces working days and triggers surplus when capacity is exceeded', () => {
    const clients = [{ id: 'c1', name: 'XYZ Corp' }];
    const employees = [
      { id: 'emp_gd_1', employeeCode: 'EMP001', name: 'Designer A', role: ROLES.GRAPHIC_DESIGNER, status: 'active' }
    ];
    // 5 dates, but 4 are holidays -> only 1 working day (capacity = 7 units)
    const workWeek = {
      id: 'week_1',
      workingDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    };
    const holidays = [
      { holidayDate: '2026-09-02' },
      { holidayDate: '2026-09-03' },
      { holidayDate: '2026-09-04' },
      { holidayDate: '2026-09-05' }
    ];
    // Requirement: 10 posts = 10 units. Designer has 7 units.
    const workRequirements = [
      { clientId: 'c1', weekId: 'week_1', requirements: { posts: 10, reels: 0, stories: 0 } }
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays,
      availabilityList: []
    });

    assert.strictEqual(result.validation.passed, true);
    const utilA = result.employeeUtilization['emp_gd_1'];
    assert.strictEqual(utilA.effectiveWorkingDays, 1);
    assert.strictEqual(utilA.totalCapacityUnits, 7);
    assert.strictEqual(utilA.assignedWork.posts, 7);

    // Surplus must be 3 posts
    assert.strictEqual(result.surplus.length, 1);
    assert.strictEqual(result.surplus[0].quantity, 3);
    assert.strictEqual(result.surplus[0].reason, SURPLUS_REASONS.INSUFFICIENT_CAPACITY);
  });

  // TEST 5: Employee Leave (0x capacity multiplier)
  it('Employee on leave receives 0 work and work routes to available colleagues or surplus', () => {
    const clients = [{ id: 'c1', name: 'XYZ Corp' }];
    const employees = [
      { id: 'emp_gd_1', employeeCode: 'EMP001', name: 'Designer A (Active)', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp_gd_2', employeeCode: 'EMP002', name: 'Designer B (On Leave)', role: ROLES.GRAPHIC_DESIGNER, status: 'active' }
    ];
    const workWeek = {
      id: 'week_1',
      workingDates: ['2026-09-01', '2026-09-02'],
    };
    // Designer B on leave for all days
    const availabilityList = [
      { employeeId: 'emp_gd_2', date: '2026-09-01', availability: 'leave' },
      { employeeId: 'emp_gd_2', date: '2026-09-02', availability: 'leave' }
    ];
    const workRequirements = [
      { clientId: 'c1', weekId: 'week_1', requirements: { posts: 10, reels: 0, stories: 0 } }
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: [],
      availabilityList
    });

    const utilB = result.employeeUtilization['emp_gd_2'];
    assert.strictEqual(utilB.totalCapacityUnits, 0);
    assert.strictEqual(utilB.usedCapacityUnits, 0);
    assert.strictEqual(utilB.assignedWork.posts, 0);

    const utilA = result.employeeUtilization['emp_gd_1'];
    // Designer A has 2 days * 7 = 14 units capacity, so Designer A accepts all 10 posts
    assert.strictEqual(utilA.assignedWork.posts, 10);
    assert.strictEqual(result.surplus.length, 0);
  });

  // TEST 6: All employees on leave creates surplus with EMPLOYEES_ON_LEAVE reason
  it('All employees on leave records surplus with reason EMPLOYEES_ON_LEAVE', () => {
    const clients = [{ id: 'c1', name: 'XYZ Corp' }];
    const employees = [
      { id: 'emp_gd_1', employeeCode: 'EMP001', name: 'Designer A', role: ROLES.GRAPHIC_DESIGNER, status: 'active' }
    ];
    const workWeek = {
      id: 'week_1',
      workingDates: ['2026-09-01'],
    };
    const availabilityList = [
      { employeeId: 'emp_gd_1', date: '2026-09-01', availability: 'leave' }
    ];
    const workRequirements = [
      { clientId: 'c1', weekId: 'week_1', requirements: { posts: 5, reels: 0, stories: 0 } }
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: [],
      availabilityList
    });

    assert.strictEqual(result.surplus.length, 1);
    assert.strictEqual(result.surplus[0].reason, SURPLUS_REASONS.EMPLOYEES_ON_LEAVE);
    assert.strictEqual(result.surplus[0].quantity, 5);
  });

  // TEST 7: No eligible employee for role
  it('Missing role records surplus with reason NO_ELIGIBLE_EMPLOYEE', () => {
    const clients = [{ id: 'c1', name: 'XYZ Corp' }];
    // Only Graphic Designer, NO Video Editor
    const employees = [
      { id: 'emp_gd_1', employeeCode: 'EMP001', name: 'Designer A', role: ROLES.GRAPHIC_DESIGNER, status: 'active' }
    ];
    const workWeek = {
      id: 'week_1',
      workingDates: ['2026-09-01', '2026-09-02'],
    };
    // 1 Reel requires video editor component
    const workRequirements = [
      { clientId: 'c1', weekId: 'week_1', requirements: { posts: 0, reels: 2, stories: 0 } }
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: [],
      availabilityList: []
    });

    // Graphic component allocated to Designer A (2 reels = 6 units <= 14 units)
    // Video component surplus because NO_ELIGIBLE_EMPLOYEE
    const videoSurplus = result.surplus.find(s => s.roleRequired === ROLES.VIDEO_EDITOR);
    assert(videoSurplus, 'Must create surplus for video editor component');
    assert.strictEqual(videoSurplus.reason, SURPLUS_REASONS.NO_ELIGIBLE_EMPLOYEE);
    assert.strictEqual(videoSurplus.quantity, 2);
  });

  // TEST 8: Mathematical Invariant In All Cases
  it('Maintains mathematical invariant: Requested = Allocated + Surplus across complex multi-client scenario', () => {
    const clients = [
      { id: 'c1', name: 'Client 1' },
      { id: 'c2', name: 'Client 2' },
      { id: 'c3', name: 'Client 3' }
    ];
    const employees = [
      { id: 'emp1', employeeCode: 'E1', name: 'Designer 1', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp2', employeeCode: 'E2', name: 'Designer 2', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp3', employeeCode: 'E3', name: 'Editor 1', role: ROLES.VIDEO_EDITOR, status: 'active' },
    ];
    const workWeek = {
      id: 'week_1',
      workingDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    };
    const workRequirements = [
      { clientId: 'c1', weekId: 'week_1', requirements: { posts: 25, reels: 10, stories: 12 } },
      { clientId: 'c2', weekId: 'week_1', requirements: { posts: 30, reels: 8, stories: 5 } },
      { clientId: 'c3', weekId: 'week_1', requirements: { posts: 15, reels: 6, stories: 4 } },
    ];

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: [],
      availabilityList: []
    });

    assert.strictEqual(result.validation.passed, true, 'Validation invariant must pass for multi-client');
    assert.strictEqual(result.validation.errors.length, 0);
  });

  console.log(`\n🎉 Test Suite Completed: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
