import {
  EPSILON,
  AVAILABILITY_TYPES,
  AVAILABILITY_MULTIPLIERS,
  DEFAULT_CAPACITY_RULES,
  ROLES,
  normalizeRole
} from './constants.js';

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
  if (!employee) return 0;
  const role = normalizeRole(employee.role, employee.employeeCode);

  const activeRules = Array.isArray(capacityRules) && capacityRules.length > 0
    ? capacityRules
    : DEFAULT_CAPACITY_RULES;

  const roleRules = activeRules.filter(r => normalizeRole(r.role) === role);

  if (roleRules.length > 0) {
    // Check if configured rule contains dailyLimits
    const limitRule = roleRules.find(r => r.dailyLimits && typeof r.dailyLimits === 'object');
    if (limitRule && limitRule.dailyLimits) {
      const postsUnits = (Number(limitRule.dailyLimits.posts) || 0) * (Number(limitRule.weights?.posts) || 1);
      const reelsUnits = (Number(limitRule.dailyLimits.reels) || 0) * (Number(limitRule.weights?.reels) || (role === ROLES.GRAPHIC_DESIGNER ? 3 : 1));
      const storiesUnits = (Number(limitRule.dailyLimits.stories) || 0) * (Number(limitRule.weights?.stories) || 1);
      const sum = postsUnits + reelsUnits + storiesUnits;
      if (sum > 0) return sum;
    }

    const totalDailyUnits = roleRules.reduce((sum, rule) => {
      const qty = Number(rule.dailyQuantity) || 0;
      const weight = Number(rule.capacityWeight) || 1;
      return sum + (qty * weight);
    }, 0);

    if (totalDailyUnits > 0) return totalDailyUnits;
  }

  // Standard default: 7 units/day for Graphic Designer (3P + 1R + 1S), 4 units/day for Video Editor (3R + 1S)
  return role === ROLES.VIDEO_EDITOR ? 4 : 7;
}

/**
 * Get the capacity rule for a specific role and content type.
 */
export function getCapacityRule(role, contentType, capacityRules = []) {
  const normRole = normalizeRole(role);
  const activeRules = Array.isArray(capacityRules) && capacityRules.length > 0
    ? capacityRules
    : DEFAULT_CAPACITY_RULES;

  // Check if user-configured rule exists with weights
  const limitRule = activeRules.find(r => normalizeRole(r.role) === normRole && r.dailyLimits);
  if (limitRule && limitRule.weights) {
    let weight = 1;
    let qty = 1;
    if (contentType === 'post') {
      weight = Number(limitRule.weights.posts) || 1;
      qty = Number(limitRule.dailyLimits.posts) || 0;
    } else if (contentType === 'reel') {
      weight = Number(limitRule.weights.reels) || (normRole === ROLES.GRAPHIC_DESIGNER ? 3 : 1);
      qty = Number(limitRule.dailyLimits.reels) || 0;
    } else if (contentType === 'story') {
      weight = Number(limitRule.weights.stories) || 1;
      qty = Number(limitRule.dailyLimits.stories) || 0;
    }
    return {
      role: normRole,
      contentType,
      dailyQuantity: qty,
      capacityWeight: weight,
      weights: limitRule.weights,
      dailyLimits: limitRule.dailyLimits,
    };
  }

  let rule = activeRules.find(r => normalizeRole(r.role) === normRole && r.contentType === contentType);
  if (!rule) {
    rule = DEFAULT_CAPACITY_RULES.find(r => normalizeRole(r.role) === normRole && r.contentType === contentType);
  }
  return rule || null;
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

  const normRole = normalizeRole(role);
  const rule = getCapacityRule(normRole, contentType, capacityRules);

  if (!rule) {
    if (normRole === ROLES.GRAPHIC_DESIGNER && contentType === 'reel') return qty * 3;
    return qty * 1;
  }

  const weight = Number(rule.capacityWeight) || (normRole === ROLES.GRAPHIC_DESIGNER && contentType === 'reel' ? 3 : 1);
  return qty * weight;
}

/**
 * Convert capacity units back to discrete item quantity for a specific content type & role.
 */
export function convertUnitsToItemQuantity(units, contentType, role, capacityRules = []) {
  const normRole = normalizeRole(role);
  const rule = getCapacityRule(normRole, contentType, capacityRules);
  const weight = (rule && Number(rule.capacityWeight)) || (normRole === ROLES.GRAPHIC_DESIGNER && contentType === 'reel' ? 3 : 1);
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
  if (!employee || effectiveWorkingDates.length === 0) {
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
    const avail = Array.isArray(availabilityList) ? availabilityList.find(a => 
      (a.employeeId === empId || a.employeeId === employee.id) && 
      normalizeDate(a.date) === normalized
    ) : null;

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
