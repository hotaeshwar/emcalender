import { EPSILON, AVAILABILITY_TYPES, AVAILABILITY_MULTIPLIERS } from './constants.js';

/**
 * Standardize date string to YYYY-MM-DD
 */
export function normalizeDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0];
  }
  if (dateVal instanceof Date) {
    const y = dateVal.getFullYear();
    const m = String(dateVal.getMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    return normalizeDate(dateVal.toDate());
  }
  return String(dateVal);
}

/**
 * Calculate effective working days by subtracting holidays from working dates.
 * @param {Object} week - Object containing workingDates array
 * @param {Array} holidays - Array of holiday objects with holidayDate
 * @returns {Object} { effectiveWorkingDaysCount, effectiveWorkingDates, holidayDates }
 */
export function getEffectiveWorkingDays(week, holidays = []) {
  if (!week) {
    return { effectiveWorkingDaysCount: 0, effectiveWorkingDates: [], holidayDates: [] };
  }

  const workingDates = Array.isArray(week.workingDates) ? week.workingDates.map(normalizeDate) : [];
  
  // Extract holiday dates from holiday records or week's embedded holidays
  const holidayDatesSet = new Set();
  
  if (Array.isArray(holidays)) {
    holidays.forEach(h => {
      if (h.holidayDate) holidayDatesSet.add(normalizeDate(h.holidayDate));
      if (h.date) holidayDatesSet.add(normalizeDate(h.date));
    });
  }
  
  if (Array.isArray(week.holidays)) {
    week.holidays.forEach(h => {
      if (h.holidayDate) holidayDatesSet.add(normalizeDate(h.holidayDate));
      if (h.date) holidayDatesSet.add(normalizeDate(h.date));
      if (typeof h === 'string') holidayDatesSet.add(normalizeDate(h));
    });
  }

  const effectiveWorkingDates = workingDates.filter(d => !holidayDatesSet.has(d));
  const holidayDates = workingDates.filter(d => holidayDatesSet.has(d));

  return {
    effectiveWorkingDaysCount: effectiveWorkingDates.length,
    effectiveWorkingDates,
    holidayDates: Array.from(holidayDatesSet),
  };
}

/**
 * Helper to calculate count of effective working days
 */
export function calculateWorkingDays(workingDates = [], holidays = []) {
  const { effectiveWorkingDaysCount } = getEffectiveWorkingDays({ workingDates, holidays }, holidays);
  return effectiveWorkingDaysCount;
}

/**
 * Calculate standard daily capacity units for an employee based on their role and capacity rules.
 * @param {Object} employee - Employee record with role
 * @param {Array} capacityRules - Array of capacity rule objects
 * @returns {number} Daily capacity in normalized units
 */
export function calculateDailyEmployeeCapacity(employee, capacityRules = []) {
  if (!employee || !employee.role) return 0;

  const roleRules = capacityRules.filter(r => r.role === employee.role);
  if (roleRules.length === 0) return 0;

  // Total daily units = sum(dailyQuantity * capacityWeight)
  const totalDailyUnits = roleRules.reduce((sum, rule) => {
    const qty = Number(rule.dailyQuantity) || 0;
    const weight = Number(rule.capacityWeight) || 1;
    return sum + (qty * weight);
  }, 0);

  return totalDailyUnits;
}

/**
 * Get the capacity rule for a specific role and content type.
 */
export function getCapacityRule(role, contentType, capacityRules = []) {
  return capacityRules.find(r => r.role === role && r.contentType === contentType) || null;
}

/**
 * Convert requested task quantity to normalized capacity units.
 * @param {string} contentType - 'post', 'reel', 'story'
 * @param {string} role - 'graphic_designer', 'video_editor'
 * @param {number} quantity - count of items
 * @param {Array} capacityRules - capacity rules
 * @returns {number} Normalized capacity units
 */
export function convertTaskToCapacityUnits(contentType, role, quantity, capacityRules = []) {
  const qty = Number(quantity) || 0;
  if (qty <= 0) return 0;

  const rule = getCapacityRule(role, contentType, capacityRules);
  if (!rule) {
    // Default fallback weights if rule not in DB
    if (role === 'graphic_designer' && contentType === 'reel') return qty * 3;
    return qty * 1;
  }

  const weight = Number(rule.capacityWeight) || 1;
  return qty * weight;
}

/**
 * Convert capacity units back to discrete item quantity for a specific content type & role.
 */
export function convertUnitsToItemQuantity(units, contentType, role, capacityRules = []) {
  const rule = getCapacityRule(role, contentType, capacityRules);
  const weight = (rule && Number(rule.capacityWeight)) || (role === 'graphic_designer' && contentType === 'reel' ? 3 : 1);
  if (weight <= 0) return 0;
  return Math.floor(units / weight);
}

/**
 * Calculate weekly capacity units for an employee, adjusting for leaves, half-days, and custom capacity per date.
 * @param {Object} employee - Employee record
 * @param {Array} capacityRules - Capacity rules
 * @param {Array} effectiveWorkingDates - Array of date strings (excluding holidays)
 * @param {Array} availabilityList - Array of availability override objects
 * @returns {Object} Detailed weekly capacity breakdown
 */
export function calculateWeeklyEmployeeCapacity(employee, capacityRules = [], effectiveWorkingDates = [], availabilityList = []) {
  if (!employee || !employee.role || effectiveWorkingDates.length === 0) {
    return {
      weeklyCapacityUnits: 0,
      dailyCapacityUnits: 0,
      effectiveWorkingDays: 0,
      dateBreakdown: {},
    };
  }

  const baseDailyUnits = calculateDailyEmployeeCapacity(employee, capacityRules);
  let totalWeeklyUnits = 0;
  const dateBreakdown = {};

  const empId = employee.id || employee.employeeCode;

  effectiveWorkingDates.forEach(dateStr => {
    const normalized = normalizeDate(dateStr);
    
    // Find availability record for this employee and date
    const avail = availabilityList.find(a => 
      (a.employeeId === empId || a.employeeId === employee.id) && 
      normalizeDate(a.date) === normalized
    );

    let multiplier = 1.0;
    let dailyUnits = baseDailyUnits;
    let status = AVAILABILITY_TYPES.AVAILABLE;

    if (avail) {
      status = avail.availability || AVAILABILITY_TYPES.AVAILABLE;
      if (status === AVAILABILITY_TYPES.LEAVE) {
        multiplier = 0.0;
        dailyUnits = 0;
      } else if (status === AVAILABILITY_TYPES.HALF_DAY) {
        multiplier = 0.5;
        dailyUnits = baseDailyUnits * 0.5;
      } else if (status === AVAILABILITY_TYPES.CUSTOM) {
        multiplier = (Number(avail.customCapacityUnits) / (baseDailyUnits || 1)) || 1.0;
        dailyUnits = Number(avail.customCapacityUnits) || baseDailyUnits;
      } else {
        multiplier = 1.0;
        dailyUnits = baseDailyUnits;
      }
    }

    dateBreakdown[normalized] = {
      date: normalized,
      status,
      multiplier,
      dailyUnits,
    };

    totalWeeklyUnits += dailyUnits;
  });

  return {
    weeklyCapacityUnits: totalWeeklyUnits,
    dailyCapacityUnits: baseDailyUnits,
    effectiveWorkingDays: effectiveWorkingDates.length,
    dateBreakdown,
  };
}

/**
 * Calculate utilization percentage with tolerance safety.
 */
export function calculateUtilization(usedCapacity, totalCapacity) {
  const total = Number(totalCapacity) || 0;
  const used = Number(usedCapacity) || 0;

  if (total <= EPSILON) {
    return used > EPSILON ? 100 : 0;
  }

  const pct = (used / total) * 100;
  return Math.round(pct * 10) / 10;
}

/**
 * Safely compute remaining capacity.
 */
export function calculateRemainingCapacity(totalCapacity, usedCapacity) {
  const total = Number(totalCapacity) || 0;
  const used = Number(usedCapacity) || 0;
  const remaining = total - used;
  return remaining < EPSILON ? 0 : remaining;
}
