import assert from 'assert';
import { generateMonthlyAllocation, generateWeeklyAllocation } from '../lib/allocationEngine.js';
import { groupWeeksByMonth, getMonthInfoFromDate, getActiveMonth } from '../lib/monthUtils.js';
import { ROLES, CONTENT_TYPES } from '../lib/constants.js';

console.log('🧪 Starting Month-Wise Work Allocation Test Suite...\n');

// 1. Test Month Extraction & Grouping
{
  const testWeeks = [
    { id: 'w1', name: 'Week 1', startDate: '2026-09-02', endDate: '2026-09-05', calculatedWorkingDays: 3 },
    { id: 'w2', name: 'Week 2', startDate: '2026-09-07', endDate: '2026-09-11', calculatedWorkingDays: 5 },
    { id: 'w3', name: 'Week 3', startDate: '2026-09-14', endDate: '2026-09-19', calculatedWorkingDays: 6 },
    { id: 'w4', name: 'Week 4', startDate: '2026-09-21', endDate: '2026-09-25', calculatedWorkingDays: 5 },
    { id: 'w5', name: 'Week 5', startDate: '2026-09-28', endDate: '2026-09-30', calculatedWorkingDays: 3 },
    { id: 'w6', name: 'Week 1 (Oct)', startDate: '2026-10-01', endDate: '2026-10-03', calculatedWorkingDays: 3 },
  ];

  const grouped = groupWeeksByMonth(testWeeks);
  assert.strictEqual(grouped.length, 2, 'Should group into 2 distinct months (September & October 2026)');

  const sep = grouped.find((m) => m.monthKey === '2026-09');
  assert.ok(sep, 'September 2026 should exist');
  assert.strictEqual(sep.weeks.length, 5, 'September should contain 5 work weeks');
  assert.strictEqual(sep.totalCalculatedWorkingDays, 22, 'September should have 22 working days');

  console.log('  ✅ PASS: Month grouping accurately aggregates weeks and working days');
}

// 2. Test Full Month Allocation Engine
{
  const septemberWeeks = [
    {
      id: 'w1',
      name: 'Week 1',
      startDate: '2026-09-02',
      endDate: '2026-09-05',
      workingDates: ['2026-09-02', '2026-09-03', '2026-09-04'],
      calculatedWorkingDays: 3,
    },
    {
      id: 'w2',
      name: 'Week 2',
      startDate: '2026-09-07',
      endDate: '2026-09-11',
      workingDates: ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'],
      calculatedWorkingDays: 5,
    },
    {
      id: 'w3',
      name: 'Week 3',
      startDate: '2026-09-14',
      endDate: '2026-09-19',
      workingDates: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
      calculatedWorkingDays: 6,
    },
  ];

  const employees = [
    { id: 'emp_gd_1', name: 'Harshita', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
    { id: 'emp_gd_2', name: 'Sahil', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
    { id: 'emp_ve_1', name: 'Gurjeet', role: ROLES.VIDEO_EDITOR, status: 'active' },
  ];

  const capacityRules = [
    { contentType: CONTENT_TYPES.POST, role: ROLES.GRAPHIC_DESIGNER, dailyCapacity: 7, unitWeight: 1 },
    { contentType: CONTENT_TYPES.REEL, role: ROLES.GRAPHIC_DESIGNER, dailyCapacity: 2.33, unitWeight: 3 },
    { contentType: CONTENT_TYPES.STORY, role: ROLES.GRAPHIC_DESIGNER, dailyCapacity: 7, unitWeight: 1 },
    { contentType: CONTENT_TYPES.REEL, role: ROLES.VIDEO_EDITOR, dailyCapacity: 6, unitWeight: 1 },
  ];

  const clients = [
    { id: 'c1', name: 'Action Car Detailing' },
    { id: 'c2', name: 'Chutney House' },
    { id: 'c3', name: 'DND' },
  ];

  // Requirements defined for each week
  const workRequirements = [
    // Week 1 (3 days)
    { id: 'r1', clientId: 'c1', weekId: 'w1', requirements: { posts: 2, reels: 1, stories: 1 } },
    { id: 'r2', clientId: 'c2', weekId: 'w1', requirements: { posts: 2, reels: 1, stories: 1 } },
    // Week 2 (5 days)
    { id: 'r3', clientId: 'c1', weekId: 'w2', requirements: { posts: 3, reels: 2, stories: 1 } },
    { id: 'r4', clientId: 'c2', weekId: 'w2', requirements: { posts: 3, reels: 2, stories: 2 } },
    { id: 'r5', clientId: 'c3', weekId: 'w2', requirements: { posts: 2, reels: 1, stories: 1 } },
    // Week 3 (6 days)
    { id: 'r6', clientId: 'c1', weekId: 'w3', requirements: { posts: 2, reels: 2, stories: 2 } },
    { id: 'r7', clientId: 'c2', weekId: 'w3', requirements: { posts: 2, reels: 2, stories: 2 } },
    { id: 'r8', clientId: 'c3', weekId: 'w3', requirements: { posts: 3, reels: 2, stories: 1 } },
  ];

  const monthResult = generateMonthlyAllocation({
    monthKey: '2026-09',
    workWeeks: septemberWeeks,
    clients,
    employees,
    capacityRules,
    workRequirements,
  });

  assert.strictEqual(monthResult.weeksCount, 3, 'Should execute across all 3 September weeks');
  assert.strictEqual(monthResult.weeklyBreakdowns.length, 3, 'Should include 3 weekly breakdowns');
  assert.ok(monthResult.allocations.length > 0, 'Should have generated monthly allocations');
  assert.ok(monthResult.validation.invariantSatisfied, 'Month invariant must hold (Requested = Allocated + Surplus)');

  // Verify that employee monthly utilization is computed correctly
  const harshita = monthResult.employeeUtilization.find((e) => e.name === 'Harshita');
  assert.ok(harshita, 'Harshita should be present in monthly utilization');
  assert.strictEqual(harshita.monthlyTotalCapacityUnits, 7 * (3 + 5 + 6), 'Total units should equal 7 * 14 = 98 units');
  assert.ok(harshita.monthlyUsedCapacityUnits > 0, 'Used units should be tracked');

  console.log('  ✅ PASS: generateMonthlyAllocation accurately distributes and aggregates across all calendar weeks of the month');
  console.log('  ✅ PASS: Mathematical invariant verified across entire month plan');
}

console.log('\n🎉 Month-Wise Test Suite Completed Successfully!\n');
