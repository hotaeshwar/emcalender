import {
  ROLES,
  CONTENT_TYPES,
  SURPLUS_REASONS,
  SURPLUS_REASON_LABELS,
  EPSILON,
  AVAILABILITY_TYPES,
  normalizeRole
} from './constants.js';
import {
  getEffectiveWorkingDays,
  calculateDailyEmployeeCapacity,
  calculateWeeklyEmployeeCapacity,
  convertTaskToCapacityUnits,
  calculateUtilization,
  calculateRemainingCapacity,
  getCapacityRule,
  normalizeDate
} from './capacityCalculator.js';

/**
 * Pure Deterministic Work Allocation Engine
 * 
 * Generates an in-memory allocation plan for a given work week and client requirements.
 * Ensures fairness, role eligibility, capacity bounds, and invariant verification.
 */

/**
 * Deconstructs client requirements into atomic role-specific task components.
 * Specifically splits 'reel' into graphic_designer and video_editor components.
 */
export function decomposeRequirements(workRequirements = []) {
  const taskComponents = [];

  workRequirements.forEach(req => {
    const clientId = req.clientId;
    const weekId = req.weekId;
    const reqId = req.id || `${clientId}_${weekId}`;
    const requirements = req.requirements || {};

    const posts = Number(requirements.posts) || 0;
    const reels = Number(requirements.reels) || 0;
    const stories = Number(requirements.stories) || 0;

    if (posts > 0) {
      taskComponents.push({
        id: `${reqId}_post_gd`,
        requirementId: reqId,
        clientId,
        weekId,
        contentType: CONTENT_TYPES.POST,
        roleComponent: ROLES.GRAPHIC_DESIGNER,
        quantity: posts,
        originalContentType: CONTENT_TYPES.POST,
        displayName: 'Posts (Graphic Design)'
      });
    }

    if (reels > 0) {
      // 1. Graphic Designer component for Reel (Thumbnails, frames, graphic assets)
      taskComponents.push({
        id: `${reqId}_reel_gd`,
        requirementId: reqId,
        clientId,
        weekId,
        contentType: CONTENT_TYPES.REEL,
        roleComponent: ROLES.GRAPHIC_DESIGNER,
        quantity: reels,
        originalContentType: CONTENT_TYPES.REEL,
        displayName: 'Reels (Graphic Design & Thumbnails)'
      });

      // 2. Video Editor component for Reel (Editing, cuts, audio sync)
      taskComponents.push({
        id: `${reqId}_reel_ve`,
        requirementId: reqId,
        clientId,
        weekId,
        contentType: CONTENT_TYPES.REEL,
        roleComponent: ROLES.VIDEO_EDITOR,
        quantity: reels,
        originalContentType: CONTENT_TYPES.REEL,
        displayName: 'Reels (Video Editing)'
      });
    }

    if (stories > 0) {
      // Stories default to Graphic Designer (story layouts)
      taskComponents.push({
        id: `${reqId}_story_gd`,
        requirementId: reqId,
        clientId,
        weekId,
        contentType: CONTENT_TYPES.STORY,
        roleComponent: ROLES.GRAPHIC_DESIGNER,
        quantity: stories,
        originalContentType: CONTENT_TYPES.STORY,
        displayName: 'Stories (Graphic Layout)'
      });
    }
  });

  return taskComponents;
}

/**
 * Generates full weekly work allocation.
 * 
 * @param {Object} params
 * @param {Object} params.workWeek - Current work week object
 * @param {Array} params.clients - Active client records
 * @param {Array} params.employees - Active employee records
 * @param {Array} params.capacityRules - Capacity rules
 * @param {Array} params.workRequirements - Client work requirements for this week
 * @param {Array} params.holidays - Holiday records
 * @param {Array} params.availabilityList - Employee availability overrides
 * @param {Array} params.existingAllocations - Pre-existing confirmed allocations
 * @returns {Object} { allocations, surplus, employeeUtilization, clientSummary, warnings, validation, dailySchedules, metadata }
 */
export function generateWeeklyAllocation({
  workWeek,
  clients = [],
  employees = [],
  capacityRules = [],
  workRequirements = [],
  holidays = [],
  availabilityList = [],
  existingAllocations = []
}) {
  const warnings = [];
  const metadata = {
    calculationVersion: '1.0',
    generatedAt: new Date().toISOString(),
    weekId: workWeek?.id || 'unknown_week',
  };

  if (!workWeek) {
    throw new Error('A valid Work Week is required for allocation.');
  }

  // 1. Calculate effective working dates
  const { effectiveWorkingDaysCount, effectiveWorkingDates, holidayDates } = getEffectiveWorkingDays(workWeek, holidays);

  if (effectiveWorkingDaysCount === 0) {
    warnings.push({
      type: 'NO_WORKING_DAYS',
      message: 'This work week has 0 effective working days. All work will result in surplus.',
    });
  }

  // 2. Filter active employees & compute individual weekly capacities
  const activeEmployees = employees.filter(e => e.status !== 'inactive');
  const employeeCapacityMap = new Map();

  activeEmployees.forEach(emp => {
    const empId = emp.id || emp.employeeCode;
    const normalizedEmpRole = normalizeRole(emp.role, emp.employeeCode);

    const capacityInfo = calculateWeeklyEmployeeCapacity(
      { ...emp, role: normalizedEmpRole },
      capacityRules,
      effectiveWorkingDates,
      availabilityList
    );

    // Track state in memory
    employeeCapacityMap.set(empId, {
      employee: emp,
      empId,
      name: emp.name,
      role: normalizedEmpRole,
      code: emp.employeeCode,
      dailyCapacityUnits: capacityInfo.dailyCapacityUnits,
      weeklyCapacityUnits: capacityInfo.weeklyCapacityUnits,
      effectiveWorkingDays: capacityInfo.effectiveWorkingDays,
      dateBreakdown: capacityInfo.dateBreakdown,
      usedCapacityUnits: 0,
      assignedTasksCount: 0,
      assignedWork: {
        posts: 0,
        reels: 0,
        stories: 0,
      },
      clientAllocations: new Map(), // clientId -> { posts, reels, stories, capacityUsed }
    });
  });

  // 3. Pre-load existing allocations into in-memory employee capacities if any
  if (Array.isArray(existingAllocations) && existingAllocations.length > 0) {
    existingAllocations.forEach(alloc => {
      const state = employeeCapacityMap.get(alloc.employeeId);
      if (state) {
        const posts = Number(alloc.work?.posts) || 0;
        const reels = Number(alloc.work?.reels) || 0;
        const stories = Number(alloc.work?.stories) || 0;

        const postUnits = convertTaskToCapacityUnits(CONTENT_TYPES.POST, state.role, posts, capacityRules);
        const reelUnits = convertTaskToCapacityUnits(CONTENT_TYPES.REEL, state.role, reels, capacityRules);
        const storyUnits = convertTaskToCapacityUnits(CONTENT_TYPES.STORY, state.role, stories, capacityRules);
        const totalUnits = postUnits + reelUnits + storyUnits;

        state.usedCapacityUnits += totalUnits;
        state.assignedTasksCount += (posts + reels + stories);
        state.assignedWork.posts += posts;
        state.assignedWork.reels += reels;
        state.assignedWork.stories += stories;
      }
    });
  }

  // 4. Decompose client requirements
  const taskComponents = decomposeRequirements(workRequirements);

  const rawAllocations = []; // Temporary assignments
  const surplusList = [];

  // Group task components for invariant validation
  const clientRequirementTotals = new Map();

  // 5. Allocation Algorithm
  taskComponents.forEach(task => {
    const { clientId, contentType, roleComponent, quantity, displayName } = task;
    const normTargetRole = normalizeRole(roleComponent);
    const reqKey = `${clientId}_${contentType}_${normTargetRole}`;

    clientRequirementTotals.set(reqKey, {
      clientId,
      contentType,
      roleComponent: normTargetRole,
      requestedQuantity: quantity,
      allocatedQuantity: 0,
      surplusQuantity: 0,
    });

    let remainingQuantity = quantity;

    // Weight per single unit of this task for this role
    const singleUnitCapacityWeight = convertTaskToCapacityUnits(contentType, normTargetRole, 1, capacityRules);

    if (singleUnitCapacityWeight <= 0) {
      warnings.push({
        type: 'INVALID_WEIGHT',
        message: `Capacity rule weight for ${normTargetRole} - ${contentType} is 0 or missing.`,
      });
    }

    // Step A: Find all eligible employees for this role with normalized role comparison
    const roleEmployees = Array.from(employeeCapacityMap.values()).filter(e => normalizeRole(e.role, e.code) === normTargetRole);

    if (roleEmployees.length === 0) {
      // Reason: NO_ELIGIBLE_EMPLOYEE
      surplusList.push({
        clientId,
        weekId: workWeek.id || 'week_1',
        contentType,
        roleRequired: normTargetRole,
        quantity: remainingQuantity,
        reason: SURPLUS_REASONS.NO_ELIGIBLE_EMPLOYEE,
        reasonLabel: SURPLUS_REASON_LABELS[SURPLUS_REASONS.NO_ELIGIBLE_EMPLOYEE],
        status: 'unassigned',
        taskDisplayName: displayName,
      });
      clientRequirementTotals.get(reqKey).surplusQuantity = remainingQuantity;
      remainingQuantity = 0;
      return;
    }

    if (effectiveWorkingDaysCount === 0) {
      // Reason: NO_WORKING_DAYS
      surplusList.push({
        clientId,
        weekId: workWeek.id || 'week_1',
        contentType,
        roleRequired: normTargetRole,
        quantity: remainingQuantity,
        reason: SURPLUS_REASONS.NO_WORKING_DAYS,
        reasonLabel: SURPLUS_REASON_LABELS[SURPLUS_REASONS.NO_WORKING_DAYS],
        status: 'unassigned',
        taskDisplayName: displayName,
      });
      clientRequirementTotals.get(reqKey).surplusQuantity = remainingQuantity;
      remainingQuantity = 0;
      return;
    }

    // Step B: Progressively allocate in balanced chunks
    let safetyLoopCount = 0;
    const maxSafetyIterations = 5000;

    while (remainingQuantity > 0 && safetyLoopCount < maxSafetyIterations) {
      safetyLoopCount++;

      // Filter employees who have enough remaining capacity for AT LEAST 1 item of this type
      const eligibleCandidates = roleEmployees.filter(emp => {
        // STRICT ROLE INVARIANT CHECK: Video Editors must NEVER be allocated graphic posts
        if (contentType === CONTENT_TYPES.POST && normalizeRole(emp.role, emp.code) === ROLES.VIDEO_EDITOR) {
          return false;
        }
        const remainingCap = calculateRemainingCapacity(emp.weeklyCapacityUnits, emp.usedCapacityUnits);
        return remainingCap >= (singleUnitCapacityWeight - EPSILON) && emp.weeklyCapacityUnits > 0;
      });

      if (eligibleCandidates.length === 0) {
        // No employee has enough capacity left to accept even 1 item
        const allOnLeave = roleEmployees.every(emp => emp.weeklyCapacityUnits <= EPSILON);
        const reason = allOnLeave ? SURPLUS_REASONS.EMPLOYEES_ON_LEAVE : SURPLUS_REASONS.INSUFFICIENT_CAPACITY;

        surplusList.push({
          clientId,
          weekId: workWeek.id || 'week_1',
          contentType,
          roleRequired: normTargetRole,
          quantity: remainingQuantity,
          reason,
          reasonLabel: SURPLUS_REASON_LABELS[reason],
          status: 'unassigned',
          taskDisplayName: displayName,
        });

        clientRequirementTotals.get(reqKey).surplusQuantity += remainingQuantity;
        remainingQuantity = 0;
        break;
      }

      // Step C: Sort eligible candidates for fair balanced distribution:
      // 1. Lowest utilization % (ASC)
      // 2. Highest remaining capacity (DESC)
      // 3. Lowest assigned tasks count (ASC)
      // 4. Stable employee code/ID/Name (ASC)
      eligibleCandidates.sort((a, b) => {
        const utilA = calculateUtilization(a.usedCapacityUnits, a.weeklyCapacityUnits);
        const utilB = calculateUtilization(b.usedCapacityUnits, b.weeklyCapacityUnits);
        if (Math.abs(utilA - utilB) > EPSILON) return utilA - utilB;

        const remA = calculateRemainingCapacity(a.weeklyCapacityUnits, a.usedCapacityUnits);
        const remB = calculateRemainingCapacity(b.weeklyCapacityUnits, b.usedCapacityUnits);
        if (Math.abs(remA - remB) > EPSILON) return remB - remA;

        if (a.assignedTasksCount !== b.assignedTasksCount) {
          return a.assignedTasksCount - b.assignedTasksCount;
        }

        return String(a.code || a.name || a.empId).localeCompare(String(b.code || b.name || b.empId));
      });

      const selectedEmployee = eligibleCandidates[0];

      // Calculate maximum quantity this employee can accept without exceeding capacity
      const empRemainingCap = calculateRemainingCapacity(selectedEmployee.weeklyCapacityUnits, selectedEmployee.usedCapacityUnits);
      const maxUnitsEmpCanTake = Math.floor((empRemainingCap + EPSILON) / singleUnitCapacityWeight);

      if (maxUnitsEmpCanTake <= 0) {
        break;
      }

      // Balanced chunk calculation: share across remaining eligible employees
      const fairChunk = Math.max(1, Math.ceil(remainingQuantity / eligibleCandidates.length));
      const chunkToAssign = Math.min(fairChunk, remainingQuantity, maxUnitsEmpCanTake);

      const capacityUnitsToConsume = chunkToAssign * singleUnitCapacityWeight;

      // Record assignment in employee state
      selectedEmployee.usedCapacityUnits += capacityUnitsToConsume;
      selectedEmployee.assignedTasksCount += chunkToAssign;

      // Update employee's work totals
      if (contentType === CONTENT_TYPES.POST) selectedEmployee.assignedWork.posts += chunkToAssign;
      if (contentType === CONTENT_TYPES.REEL) selectedEmployee.assignedWork.reels += chunkToAssign;
      if (contentType === CONTENT_TYPES.STORY) selectedEmployee.assignedWork.stories += chunkToAssign;

      const clientObj = clients.find(c => c.id === clientId);

      // Record in raw allocations
      rawAllocations.push({
        clientId,
        clientName: clientObj?.name || '',
        employeeId: selectedEmployee.empId,
        employeeName: selectedEmployee.name,
        employeeCode: selectedEmployee.code,
        employeeRole: selectedEmployee.role,
        weekId: workWeek.id || 'week_1',
        contentType,
        roleComponent: normTargetRole,
        quantity: chunkToAssign,
        capacityUsed: capacityUnitsToConsume,
        assignmentType: 'automatic',
        manualOverride: false,
      });

      clientRequirementTotals.get(reqKey).allocatedQuantity += chunkToAssign;
      remainingQuantity -= chunkToAssign;
    }

    if (remainingQuantity > 0) {
      surplusList.push({
        clientId,
        weekId: workWeek.id || 'week_1',
        contentType,
        roleRequired: normTargetRole,
        quantity: remainingQuantity,
        reason: SURPLUS_REASONS.INSUFFICIENT_CAPACITY,
        reasonLabel: SURPLUS_REASON_LABELS[SURPLUS_REASONS.INSUFFICIENT_CAPACITY],
        status: 'unassigned',
        taskDisplayName: displayName,
      });
      clientRequirementTotals.get(reqKey).surplusQuantity += remainingQuantity;
    }
  });

  // 6. Merge & Aggregate Allocations per (Client + Employee + Role)
  const aggregatedAllocationsMap = new Map();

  rawAllocations.forEach(alloc => {
    const key = `${alloc.clientId}_${alloc.employeeId}_${alloc.weekId}`;
    if (!aggregatedAllocationsMap.has(key)) {
      aggregatedAllocationsMap.set(key, {
        clientId: alloc.clientId,
        clientName: alloc.clientName || '',
        employeeId: alloc.employeeId,
        employeeName: alloc.employeeName,
        employeeCode: alloc.employeeCode,
        employeeRole: alloc.employeeRole,
        weekId: alloc.weekId,
        work: {
          posts: 0,
          reels: 0,
          stories: 0,
        },
        capacityUsed: 0,
        assignmentType: 'automatic',
        manualOverride: false,
      });
    }

    const rec = aggregatedAllocationsMap.get(key);
    if (alloc.contentType === CONTENT_TYPES.POST) rec.work.posts += alloc.quantity;
    if (alloc.contentType === CONTENT_TYPES.REEL) rec.work.reels += alloc.quantity;
    if (alloc.contentType === CONTENT_TYPES.STORY) rec.work.stories += alloc.quantity;
    rec.capacityUsed += alloc.capacityUsed;
  });

  const finalAllocations = Array.from(aggregatedAllocationsMap.values());

  // 7. Consolidate Surplus list
  const aggregatedSurplusMap = new Map();
  surplusList.forEach(s => {
    const clientObj = clients.find(c => c.id === s.clientId);
    const key = `${s.clientId}_${s.contentType}_${s.roleRequired}_${s.reason}`;
    if (!aggregatedSurplusMap.has(key)) {
      aggregatedSurplusMap.set(key, { ...s, clientName: clientObj?.name || '' });
    } else {
      aggregatedSurplusMap.get(key).quantity += s.quantity;
    }
  });
  const finalSurplus = Array.from(aggregatedSurplusMap.values()).filter(s => s.quantity > 0);

  // 8. Build Employee Utilization Summary
  const employeeUtilization = {};
  employeeCapacityMap.forEach((state, empId) => {
    const utilPct = calculateUtilization(state.usedCapacityUnits, state.weeklyCapacityUnits);
    const remainingCap = calculateRemainingCapacity(state.weeklyCapacityUnits, state.usedCapacityUnits);

    if (utilPct > 90 && utilPct <= 100) {
      warnings.push({
        type: 'HIGH_UTILIZATION',
        message: `${state.name} (${state.code}) is heavily utilized at ${utilPct}%.`,
      });
    } else if (utilPct > 100) {
      warnings.push({
        type: 'OVERLOADED',
        message: `${state.name} (${state.code}) is OVERLOADED at ${utilPct}%.`,
      });
    }

    employeeUtilization[empId] = {
      empId,
      name: state.name,
      code: state.code,
      role: state.role,
      totalCapacityUnits: state.weeklyCapacityUnits,
      dailyCapacityUnits: state.dailyCapacityUnits,
      usedCapacityUnits: state.usedCapacityUnits,
      remainingCapacityUnits: remainingCap,
      utilizationPercentage: utilPct,
      assignedWork: state.assignedWork,
      effectiveWorkingDays: state.effectiveWorkingDays,
    };
  });

  // 9. Client Summary
  const clientSummary = {};
  clients.forEach(c => {
    const cId = c.id;
    clientSummary[cId] = {
      client: c,
      requested: { posts: 0, reels: 0, stories: 0 },
      allocated: { posts: 0, reels: 0, stories: 0 },
      surplus: { posts: 0, reels: 0, stories: 0 },
      assignedEmployees: [],
    };
  });

  workRequirements.forEach(req => {
    const cId = req.clientId;
    if (!clientSummary[cId]) {
      clientSummary[cId] = {
        client: { id: cId, name: req.clientName || 'Unknown Client' },
        requested: { posts: 0, reels: 0, stories: 0 },
        allocated: { posts: 0, reels: 0, stories: 0 },
        surplus: { posts: 0, reels: 0, stories: 0 },
        assignedEmployees: [],
      };
    }
    clientSummary[cId].requested.posts += Number(req.requirements?.posts) || 0;
    clientSummary[cId].requested.reels += Number(req.requirements?.reels) || 0;
    clientSummary[cId].requested.stories += Number(req.requirements?.stories) || 0;
  });

  finalAllocations.forEach(alloc => {
    const cId = alloc.clientId;
    if (clientSummary[cId]) {
      clientSummary[cId].allocated.posts += alloc.work.posts;
      clientSummary[cId].allocated.reels += alloc.work.reels;
      clientSummary[cId].allocated.stories += alloc.work.stories;
      if (!clientSummary[cId].assignedEmployees.includes(alloc.employeeName)) {
        clientSummary[cId].assignedEmployees.push(alloc.employeeName);
      }
    }
  });

  finalSurplus.forEach(s => {
    const cId = s.clientId;
    if (clientSummary[cId]) {
      if (s.contentType === CONTENT_TYPES.POST) clientSummary[cId].surplus.posts += s.quantity;
      if (s.contentType === CONTENT_TYPES.REEL) clientSummary[cId].surplus.reels += s.quantity;
      if (s.contentType === CONTENT_TYPES.STORY) clientSummary[cId].surplus.stories += s.quantity;
    }
  });

  // 10. CRITICAL INVARIANT VALIDATION RULE:
  // Mathematical Invariant: Requested = Allocated + Surplus for every requirement!
  let validationPassed = true;
  const validationErrors = [];

  clientRequirementTotals.forEach((val, reqKey) => {
    const requested = val.requestedQuantity;
    const allocated = val.allocatedQuantity;
    const surplus = val.surplusQuantity;
    const total = allocated + surplus;

    if (Math.abs(requested - total) > EPSILON) {
      validationPassed = false;
      validationErrors.push({
        key: reqKey,
        clientId: val.clientId,
        contentType: val.contentType,
        roleComponent: val.roleComponent,
        requested,
        allocated,
        surplus,
        discrepancy: requested - total,
      });
    }
  });

  if (!validationPassed) {
    warnings.push({
      type: 'VALIDATION_FAILED',
      message: 'Allocation validation failed. Requested work does not match allocated + surplus totals.',
      details: validationErrors,
    });
  }

  // 11. Generate Daily Timetable Schedule
  const dailySchedules = generateDailySchedule(
    finalAllocations,
    activeEmployees,
    workWeek,
    holidays,
    availabilityList,
    capacityRules
  );

  return {
    allocations: finalAllocations,
    surplus: finalSurplus,
    employeeUtilization,
    clientSummary,
    dailySchedules,
    warnings,
    validation: {
      passed: validationPassed,
      errors: validationErrors,
    },
    metadata,
  };
}

/**
 * Builds an array timetable of daily production tasks for a single allocation.
 */
export function buildDailyTimetable(allocation, workWeek, holidays = [], capacityRules = []) {
  if (!allocation || !workWeek) return [];
  const holidayDatesSet = new Set((workWeek.holidays || holidays || []).map(h => normalizeDate(h.holidayDate || h.date)));

  const workingDates = Array.isArray(workWeek.workingDates) ? workWeek.workingDates.map(normalizeDate) : [];
  if (workingDates.length === 0) return [];

  const availableDates = workingDates.filter(d => !holidayDatesSet.has(d));

  let postsLeft = Number(allocation.work?.posts) || 0;
  let reelsLeft = Number(allocation.work?.reels) || 0;
  let storiesLeft = Number(allocation.work?.stories) || 0;

  const timetable = [];
  const distMap = {};
  availableDates.forEach(d => {
    distMap[d] = { posts: 0, reels: 0, stories: 0 };
  });

  if (availableDates.length > 0) {
    let dayIdx = 0;
    while ((postsLeft > 0 || reelsLeft > 0 || storiesLeft > 0) && dayIdx < availableDates.length * 20) {
      const curDate = availableDates[dayIdx % availableDates.length];
      if (postsLeft > 0) {
        distMap[curDate].posts += 1;
        postsLeft -= 1;
      }
      if (reelsLeft > 0) {
        distMap[curDate].reels += 1;
        reelsLeft -= 1;
      }
      if (storiesLeft > 0) {
        distMap[curDate].stories += 1;
        storiesLeft -= 1;
      }
      dayIdx++;
    }
  }

  workingDates.forEach(d => {
    const isHoliday = holidayDatesSet.has(d);
    timetable.push({
      date: d,
      isHoliday,
      posts: distMap[d]?.posts || 0,
      reels: distMap[d]?.reels || 0,
      stories: distMap[d]?.stories || 0,
    });
  });

  return timetable;
}

const DAY_NAMES_LIST = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDayNameFromDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return DAY_NAMES_LIST[date.getDay()] || '';
  } catch (e) {
    return '';
  }
}

/**
 * Distributes weekly allocated items across specific working dates respecting daily capacity limits.
 */
export function generateDailySchedule(
  allocations = [],
  employees = [],
  workWeek,
  holidays = [],
  availabilityList = [],
  capacityRules = []
) {
  const { effectiveWorkingDates } = getEffectiveWorkingDays(workWeek, holidays);
  const dailySchedules = {}; // empId -> { employeeName, employeeRole, days: { [dateStr]: { date, dayName, status, multiplier, posts, reels, stories, clientTasks } } }

  if (effectiveWorkingDates.length === 0) return dailySchedules;

  const empMap = new Map(employees.map(e => [e.id || e.employeeCode, e]));

  allocations.forEach(alloc => {
    const empId = alloc.employeeId;
    const emp = empMap.get(empId);
    if (!emp) return;

    const dailyCap = calculateDailyEmployeeCapacity(emp, capacityRules);

    if (!dailySchedules[empId]) {
      dailySchedules[empId] = {
        empId,
        employeeName: alloc.employeeName,
        employeeCode: alloc.employeeCode,
        employeeRole: normalizeRole(alloc.employeeRole, alloc.employeeCode),
        dailyCapacityUnits: dailyCap,
        days: {},
      };

      effectiveWorkingDates.forEach(dateStr => {
        const normalized = normalizeDate(dateStr);
        const avail = availabilityList.find(a => (a.employeeId === empId || a.employeeId === emp.id) && normalizeDate(a.date) === normalized);
        const status = avail ? avail.availability : AVAILABILITY_TYPES.AVAILABLE;

        let multiplier = 1.0;
        if (status === AVAILABILITY_TYPES.LEAVE) multiplier = 0;
        else if (status === AVAILABILITY_TYPES.HALF_DAY) multiplier = 0.5;

        dailySchedules[empId].days[normalized] = {
          date: normalized,
          dayName: getDayNameFromDate(normalized),
          status,
          multiplier,
          dailyCapacity: dailyCap * multiplier,
          usedCapacityUnits: 0,
          posts: 0,
          reels: 0,
          stories: 0,
          clientTasks: [],
        };
      });
    }

    // Distribute items evenly across available days
    const availableDates = effectiveWorkingDates.filter(d => {
      const dayRec = dailySchedules[empId].days[normalizeDate(d)];
      return dayRec && dayRec.multiplier > 0;
    });

    if (availableDates.length === 0) return;

    let postsToDistribute = alloc.work.posts;
    let reelsToDistribute = alloc.work.reels;
    let storiesToDistribute = alloc.work.stories;

    let dayIdx = 0;
    while ((postsToDistribute > 0 || reelsToDistribute > 0 || storiesToDistribute > 0) && dayIdx < availableDates.length * 20) {
      const curDate = normalizeDate(availableDates[dayIdx % availableDates.length]);
      const dayRec = dailySchedules[empId].days[curDate];

      let addedP = 0;
      let addedR = 0;
      let addedS = 0;

      if (postsToDistribute > 0) {
        dayRec.posts += 1;
        addedP += 1;
        postsToDistribute -= 1;
      }
      if (reelsToDistribute > 0) {
        dayRec.reels += 1;
        addedR += 1;
        reelsToDistribute -= 1;
      }
      if (storiesToDistribute > 0) {
        dayRec.stories += 1;
        addedS += 1;
        storiesToDistribute -= 1;
      }

      if (addedP > 0 || addedR > 0 || addedS > 0) {
        let ct = dayRec.clientTasks.find(t => t.clientId === alloc.clientId);
        if (!ct) {
          ct = {
            clientId: alloc.clientId,
            clientName: alloc.clientName || 'Client',
            posts: 0,
            reels: 0,
            stories: 0,
          };
          dayRec.clientTasks.push(ct);
        }
        ct.posts += addedP;
        ct.reels += addedR;
        ct.stories += addedS;
      }

      dayIdx++;
    }
  });

  // Calculate usedCapacityUnits for each day
  Object.values(dailySchedules).forEach(empSched => {
    const role = empSched.employeeRole;
    Object.values(empSched.days).forEach(day => {
      const pUnits = convertTaskToCapacityUnits(CONTENT_TYPES.POST, role, day.posts, capacityRules);
      const rUnits = convertTaskToCapacityUnits(CONTENT_TYPES.REEL, role, day.reels, capacityRules);
      const sUnits = convertTaskToCapacityUnits(CONTENT_TYPES.STORY, role, day.stories, capacityRules);
      day.usedCapacityUnits = pUnits + rUnits + sUnits;
    });
  });

  return dailySchedules;
}
