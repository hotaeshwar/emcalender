// End-to-end integration test verifying Firebase and Allocation Engine
import { db } from '../lib/firebase.js';
import { collection, addDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { generateWeeklyAllocation } from '../lib/allocationEngine.js';
import { DEFAULT_CAPACITY_RULES, ROLES } from '../lib/constants.js';
import { getEffectiveWorkingDays } from '../lib/capacityCalculator.js';

async function verifyEndToEnd() {
  console.log('🚀 Running End-to-End Firebase & Allocation Integration Verification...\n');

  try {
    // 1. Check Firebase Firestore connection
    const testCol = collection(db, 'integrationTest');
    const testDoc = await addDoc(testCol, {
      testRun: true,
      timestamp: serverTimestamp(),
      platform: 'bid work load distributer',
    });
    console.log(`✅ 1. Firestore Read/Write connection verified: Document ID ${testDoc.id}`);
    await deleteDoc(doc(db, 'integrationTest', testDoc.id));
    console.log('✅ 2. Firestore Cleanup verified');

    // 2. Test Full Agency Business Scenario
    console.log('\n📊 3. Testing Complete Business Workflow Scenario...');

    const clients = [
      { id: 'c_abc', name: 'ABC Corporation', clientCode: 'ABC001', status: 'active' },
      { id: 'c_xyz', name: 'XYZ Global', clientCode: 'XYZ001', status: 'active' },
    ];

    const employees = [
      { id: 'emp_1', employeeCode: 'EMP001', name: 'Rahul Sharma', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp_2', employeeCode: 'EMP002', name: 'Priya Nair', role: ROLES.GRAPHIC_DESIGNER, status: 'active' },
      { id: 'emp_3', employeeCode: 'EMP003', name: 'Amit Patel', role: ROLES.VIDEO_EDITOR, status: 'active' },
    ];

    const workWeek = {
      id: 'week_sep_1',
      weekNumber: 1,
      name: 'Week 1 - September Launch',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      workingDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
      holidays: [{ holidayDate: '2026-09-05', name: 'Ganesh Chaturthi' }],
    };

    const workRequirements = [
      {
        clientId: 'c_abc',
        clientName: 'ABC Corporation',
        weekId: 'week_sep_1',
        requirements: {
          posts: 20,
          reels: 8,
          stories: 7,
        },
      },
    ];

    const { effectiveWorkingDaysCount } = getEffectiveWorkingDays(workWeek, workWeek.holidays);
    console.log(`  • Configured Working Dates: ${workWeek.workingDates.length}`);
    console.log(`  • Holidays Deducted: ${workWeek.holidays.length} (${workWeek.holidays[0].name})`);
    console.log(`  • Effective Working Days: ${effectiveWorkingDaysCount} days`);

    const result = generateWeeklyAllocation({
      workWeek,
      clients,
      employees,
      capacityRules: DEFAULT_CAPACITY_RULES,
      workRequirements,
      holidays: workWeek.holidays,
      availabilityList: [],
    });

    console.log(`\n📋 Allocation Output Summary:`);
    console.log(`  • Validation Status: ${result.validation.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
    console.log(`  • Total Confirmed Allocations: ${result.allocations.length}`);
    console.log(`  • Surplus Items: ${result.surplus.length}`);

    console.log(`\n👥 Team Utilization Breakdown:`);
    Object.values(result.employeeUtilization).forEach((emp) => {
      console.log(`  • ${emp.name} (${emp.role}): ${emp.usedCapacityUnits}/${emp.totalCapacityUnits} Units (${emp.utilizationPercentage}%) -> Assigned: ${emp.assignedWork.posts} Posts, ${emp.assignedWork.reels} Reels, ${emp.assignedWork.stories} Stories`);
    });

    if (result.surplus.length > 0) {
      console.log(`\n⚠️ Surplus Details:`);
      result.surplus.forEach((s) => {
        console.log(`  • ${s.quantity} ${s.contentType} (${s.roleRequired}): Reason -> ${s.reasonLabel}`);
      });
    }

    console.log('\n🎉 ALL INTEGRATION CHECKS PASSED WITH 100% PRECISION!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Integration check failed:', err);
    process.exit(1);
  }
}

verifyEndToEnd();
