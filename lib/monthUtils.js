/**
 * Utilities for Month-Wise grouping, formatting, and capacity calculations
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Extracts month key (YYYY-MM) and formatted label from a date string (YYYY-MM-DD)
 * e.g., "2026-09-02" -> { monthKey: "2026-09", monthLabel: "September 2026", year: 2026, month: 9 }
 */
export function getMonthInfoFromDate(dateStr) {
  if (!dateStr) return { monthKey: '', monthLabel: '', year: 0, month: 0 };
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const monthKey = `${parts[0]}-${parts[1].padStart(2, '0')}`;
  const monthLabel = `${MONTH_NAMES[month - 1] || 'Month'} ${year}`;
  return { monthKey, monthLabel, year, month };
}

/**
 * Groups an array of work weeks by Month (monthKey: "YYYY-MM")
 * Returns array of sorted months with their associated work weeks and aggregated stats
 */
export function groupWeeksByMonth(weeks = []) {
  const monthMap = new Map();

  weeks.forEach((w) => {
    // Determine month based on startDate
    const { monthKey, monthLabel, year, month } = getMonthInfoFromDate(w.startDate);
    if (!monthKey) return;

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        monthKey,
        monthLabel,
        year,
        month,
        weeks: [],
        totalCalculatedWorkingDays: 0,
        holidaysCount: 0,
        startDate: w.startDate,
        endDate: w.endDate,
      });
    }

    const m = monthMap.get(monthKey);
    m.weeks.push(w);
    m.totalCalculatedWorkingDays += (Number(w.calculatedWorkingDays) || (w.workingDates || []).length || 5);
    m.holidaysCount += (Array.isArray(w.holidays) ? w.holidays.length : 0);

    // Expand date range
    if (!m.startDate || w.startDate < m.startDate) m.startDate = w.startDate;
    if (!m.endDate || w.endDate > m.endDate) m.endDate = w.endDate;
  });

  // Sort weeks inside each month by weekNumber / startDate
  for (const m of monthMap.values()) {
    m.weeks.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
  }

  // Convert to array and sort descending by monthKey (e.g. 2026-09, 2026-08)
  return Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * Gets the active or latest month from a list of work weeks
 */
export function getActiveMonth(weeks = []) {
  const months = groupWeeksByMonth(weeks);
  if (months.length === 0) return null;

  // Look for a month containing an 'active' week
  const activeWeek = weeks.find((w) => w.status === 'active');
  if (activeWeek) {
    const { monthKey } = getMonthInfoFromDate(activeWeek.startDate);
    const found = months.find((m) => m.monthKey === monthKey);
    if (found) return found;
  }

  return months[0];
}
