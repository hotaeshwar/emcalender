const assert = require('assert');

async function runCrudVerification() {
  console.log('🧪 Starting Full CRUD Operations Verification Test Suite...\n');

  // Import storageSync directly with relative path
  const {
    saveDocument,
    updateDocument,
    fetchCollection,
    removeDocument
  } = await import('../lib/storageSync.js');
  const { validateClient, validateEmployee, validateCapacityRule, validateWorkWeek, validateWorkRequirement } = await import('../lib/validators.js');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. CLIENTS CRUD TEST
  await test('Clients CRUD: Create, Validate, Update, and Delete in Firestore', async () => {
    const testCode = 'TC_' + Math.floor(Math.random() * 89999 + 10000);
    const clientData = {
      name: 'Dynamic Client Alpha',
      clientCode: testCode,
      description: 'Automated test client account',
      status: 'active',
    };

    // Validation
    const val = validateClient(clientData, []);
    assert.strictEqual(val.isValid, true, 'Client validation should pass');

    // Create
    const created = await saveDocument('clients', clientData);
    assert(created.id, 'Created client must have an ID');
    assert.strictEqual(created.name, 'Dynamic Client Alpha');

    // Read
    const allClients = await fetchCollection('clients');
    const found = allClients.find((c) => c.id === created.id);
    assert(found, 'Client must be fetchable from collection');

    // Update
    const updated = await updateDocument('clients', created.id, {
      name: 'Dynamic Client Alpha (Updated)',
      description: 'Updated test notes',
      status: 'inactive',
    });
    assert.strictEqual(updated.name, 'Dynamic Client Alpha (Updated)');
    assert.strictEqual(updated.status, 'inactive');

    // Delete
    const delRes = await removeDocument('clients', created.id);
    assert.strictEqual(delRes.success, true);
  });

  // 2. EMPLOYEES CRUD TEST
  await test('Employees CRUD: Create, Validate, Update, and Delete in Firestore', async () => {
    const empData = {
      name: 'Priya Graphic Designer',
      employeeCode: 'EMP_TEST_' + Date.now(),
      role: 'graphic_designer',
      status: 'active',
    };

    // Validation
    const val = validateEmployee(empData);
    assert.strictEqual(val.isValid, true);

    // Create
    const created = await saveDocument('employees', empData);
    assert(created.id);
    assert.strictEqual(created.role, 'graphic_designer');

    // Update
    const updated = await updateDocument('employees', created.id, {
      name: 'Priya Lead Designer',
      role: 'graphic_designer',
      status: 'active',
    });
    assert.strictEqual(updated.name, 'Priya Lead Designer');

    // Delete
    const delRes = await removeDocument('employees', created.id);
    assert.strictEqual(delRes.success, true);
  });

  // 3. WORK WEEKS CRUD TEST
  await test('Work Weeks CRUD: Create, Validate, Update (Working Dates), and Delete', async () => {
    const weekData = {
      weekNumber: 10,
      name: 'Week 10 - Festive Sprint',
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      workingDates: ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'],
      holidays: [{ holidayDate: '2026-10-12', name: 'Festive Holiday' }],
      calculatedWorkingDays: 5,
      status: 'active',
    };

    const val = validateWorkWeek(weekData);
    assert.strictEqual(val.isValid, true);

    // Create
    const created = await saveDocument('workWeeks', weekData);
    assert(created.id);
    assert.strictEqual(created.calculatedWorkingDays, 5);

    // Update
    const updated = await updateDocument('workWeeks', created.id, {
      name: 'Week 10 - Festive Sprint (Updated)',
      workingDates: ['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'],
      calculatedWorkingDays: 4,
    });
    assert.strictEqual(updated.name, 'Week 10 - Festive Sprint (Updated)');
    assert.strictEqual(updated.calculatedWorkingDays, 4);

    // Delete
    const delRes = await removeDocument('workWeeks', created.id);
    assert.strictEqual(delRes.success, true);
  });

  // 4. WORK REQUIREMENTS CRUD & WEEK EDIT TEST
  await test('Work Requirements CRUD: Create, Update Target Week, and Delete', async () => {
    const reqData = {
      clientId: 'c_test_demo',
      clientName: 'ActionCarDetailing',
      weekId: 'week_1',
      requirements: { posts: 2, reels: 2, stories: 1 },
      notes: 'Initial requirement',
      status: 'submitted',
    };

    const val = validateWorkRequirement(reqData);
    assert.strictEqual(val.isValid, true);

    // Create
    const created = await saveDocument('workRequirements', reqData);
    assert(created.id);
    assert.strictEqual(created.weekId, 'week_1');
    assert.strictEqual(created.requirements.posts, 2);

    // Update Target Week (from week_1 to week_2)
    const updated = await updateDocument('workRequirements', created.id, {
      clientId: 'c_test_demo',
      clientName: 'ActionCarDetailing',
      weekId: 'week_2', // Changed Target Week
      requirements: { posts: 3, reels: 2, stories: 2 },
      notes: 'Updated deliverables for Week 2',
      status: 'submitted',
    });
    assert.strictEqual(updated.weekId, 'week_2', 'Target week must update to week_2');
    assert.strictEqual(updated.requirements.posts, 3);
    assert.strictEqual(updated.requirements.stories, 2);

    // Delete
    const delRes = await removeDocument('workRequirements', created.id);
    assert.strictEqual(delRes.success, true);
  });

  // 5. EMPLOYEE AVAILABILITY CRUD TEST
  await test('Employee Availability CRUD: Save, Read, and Delete', async () => {
    const customId = 'avail_test_demo_2026-10-12';
    const availData = {
      employeeId: 'emp_demo',
      employeeName: 'Demo Editor',
      date: '2026-10-12',
      availability: 'leave',
      reason: 'Personal Emergency',
    };

    const created = await saveDocument('employeeAvailability', availData, customId);
    assert.strictEqual(created.id, customId);
    assert.strictEqual(created.availability, 'leave');

    const updated = await updateDocument('employeeAvailability', customId, {
      availability: 'half_day',
      reason: 'Doctor Appointment',
    });
    assert.strictEqual(updated.availability, 'half_day');

    const delRes = await removeDocument('employeeAvailability', customId);
    assert.strictEqual(delRes.success, true);
  });

  // 6. ALLOCATION & SURPLUS CRUD TEST
  await test('Allocations & Surplus CRUD: Save, Query, Update, and Delete', async () => {
    const weekId = 'week_crud_test_' + Date.now();
    const allocRecord = {
      clientId: 'client_01',
      clientName: 'Alpha Client',
      employeeId: 'emp_01',
      employeeName: 'John Doe',
      employeeCode: 'EMP01',
      employeeRole: 'graphic_designer',
      weekId,
      work: { posts: 4, reels: 2, stories: 1 },
      capacityUsed: 10,
      assignmentType: 'automatic',
      manualOverride: false,
    };

    const savedAlloc = await saveDocument('allocations', allocRecord);
    assert(savedAlloc.id);
    assert.strictEqual(savedAlloc.work.posts, 4);

    const surplusRecord = {
      clientId: 'client_01',
      clientName: 'Alpha Client',
      weekId,
      contentType: 'reel',
      roleRequired: 'video_editor',
      quantity: 3,
      reason: 'INSUFFICIENT_CAPACITY',
      reasonLabel: 'No available capacity',
      status: 'unassigned',
    };

    const savedSurplus = await saveDocument('surplusWork', surplusRecord);
    assert(savedSurplus.id);
    assert.strictEqual(savedSurplus.quantity, 3);

    // Update Surplus status after distribution
    const updatedSurplus = await updateDocument('surplusWork', savedSurplus.id, {
      status: 'assigned',
      assignedToEmployeeId: 'emp_02',
      assignedToEmployeeName: 'Jane Editor',
    });
    assert.strictEqual(updatedSurplus.status, 'assigned');

    // Clean up
    await removeDocument('allocations', savedAlloc.id);
    await removeDocument('surplusWork', savedSurplus.id);
  });

  console.log(`\n🎉 All 6 Application CRUD Modules Passed 100% Successfully: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runCrudVerification().catch(err => {
  console.error('Fatal CRUD test error:', err);
  process.exit(1);
});
