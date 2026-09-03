import { getClients } from './clientService';
import { getEmployees } from './employeeService';
import { getWorkWeeks } from './weekService';
import { getCapacityRules } from './capacityService';
import { getEmployeeAvailability } from './availabilityService';
import { fetchCollection } from '@/lib/storageSync';
import { ROLES, CONTENT_TYPES } from '@/lib/constants';
import {
  calculateDailyEmployeeCapacity,
  calculateWeeklyEmployeeCapacity,
  getEffectiveWorkingDays,
  calculateUtilization,
  convertTaskToCapacityUnits
} from '@/lib/capacityCalculator';
import { groupWeeksByMonth, getMonthInfoFromDate, getActiveMonth } from '@/lib/monthUtils';

const DEFAULT_DASHBOARD_DATA = {
  activeMonth: null,
  activeWeek: null,
  stats: {
    totalClients: 0,
    activeClients: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    graphicDesignersCount: 0,
    videoEditorsCount: 0,
    activeWeeksCount: 0,
    totalAllocatedPosts: 0,
    totalAllocatedReels: 0,
    totalAllocatedStories: 0,
    totalSurplusCount: 0,
    unassignedSurplusCount: 0,
  },
  teamCapacity: {
    graphic: {
      totalUnits: 0,
      usedUnits: 0,
      utilization: 0,
    },
    video: {
      totalUnits: 0,
      usedUnits: 0,
      utilization: 0,
    },
  },
  recentSurplus: [],
  upcomingHolidays: [],
  employees: [],
  monthsList: [],
};

export async function getDashboardData(targetMonthKey = null) {
  try {
    const [
      clients,
      employees,
      weeks,
      capacityRules,
      availabilityList,
      allocations,
      surplusList
    ] = await Promise.all([
      getClients().catch(() => []),
      getEmployees().catch(() => []),
      getWorkWeeks().catch(() => []),
      getCapacityRules().catch(() => []),
      getEmployeeAvailability().catch(() => []),
      fetchCollection('allocations').catch(() => []),
      fetchCollection('surplusWork').catch(() => []),
    ]);

    const activeClients = (clients || []).filter(c => c.status !== 'inactive');
    const activeEmployees = (employees || []).filter(e => e.status !== 'inactive');
    const graphicDesigners = activeEmployees.filter(e => e.role === ROLES.GRAPHIC_DESIGNER);
    const videoEditors = activeEmployees.filter(e => e.role === ROLES.VIDEO_EDITOR);

    const monthsList = groupWeeksByMonth(weeks || []);
    let activeMonth = null;

    if (targetMonthKey && targetMonthKey !== 'all') {
      activeMonth = monthsList.find((m) => m.monthKey === targetMonthKey) || null;
    }
    if (!activeMonth) {
      activeMonth = getActiveMonth(weeks || []) || monthsList[0] || null;
    }

    const currentMonthKey = activeMonth?.monthKey || (weeks[0] ? getMonthInfoFromDate(weeks[0].startDate).monthKey : null);
    const targetWeeks = activeMonth ? activeMonth.weeks : (weeks || []);

    let graphicTeamTotalCap = 0;
    let graphicTeamUsedCap = 0;
    let videoTeamTotalCap = 0;
    let videoTeamUsedCap = 0;

    // Filter allocations for the active month or its weeks
    const monthAllocations = (allocations || []).filter(a => {
      if (currentMonthKey && (a.monthKey === currentMonthKey || (a.date && a.date.startsWith(currentMonthKey)))) {
        return true;
      }
      return targetWeeks.some(w => w.id === a.weekId || w.name === a.weekName);
    });

    // Compute month capacity across all weeks of the month
    targetWeeks.forEach((week) => {
      const { effectiveWorkingDates } = getEffectiveWorkingDays(week, week.holidays || []);

      graphicDesigners.forEach(gd => {
        const cap = calculateWeeklyEmployeeCapacity(gd, capacityRules || [], effectiveWorkingDates, availabilityList || []);
        graphicTeamTotalCap += cap.weeklyCapacityUnits;
      });

      videoEditors.forEach(ve => {
        const cap = calculateWeeklyEmployeeCapacity(ve, capacityRules || [], effectiveWorkingDates, availabilityList || []);
        videoTeamTotalCap += cap.weeklyCapacityUnits;
      });
    });

    // Sum used capacity for month allocations
    monthAllocations.forEach(a => {
      const used = Number(a.capacityUsed) || 0;
      const role = a.employeeRole || (employees.find(e => e.id === a.employeeId)?.role);

      if (role === ROLES.GRAPHIC_DESIGNER) {
        graphicTeamUsedCap += used;
      } else if (role === ROLES.VIDEO_EDITOR) {
        videoTeamUsedCap += used;
      }
    });

    const graphicTeamUtilization = calculateUtilization(graphicTeamUsedCap, graphicTeamTotalCap);
    const videoTeamUtilization = calculateUtilization(videoTeamUsedCap, videoTeamTotalCap);

    // Sum allocated deliverables for the active month
    let totalAllocatedPosts = 0;
    let totalAllocatedReels = 0;
    let totalAllocatedStories = 0;
    monthAllocations.forEach(a => {
      totalAllocatedPosts += (Number(a.work?.posts) || 0);
      totalAllocatedReels += (Number(a.work?.reels) || 0);
      totalAllocatedStories += (Number(a.work?.stories) || 0);
    });

    // Sum surplus items for the active month
    const monthSurplusList = (surplusList || []).filter(s => {
      if (currentMonthKey && (s.monthKey === currentMonthKey || (s.date && s.date.startsWith(currentMonthKey)))) {
        return true;
      }
      return targetWeeks.some(w => w.id === s.weekId);
    });
    const unassignedSurplus = monthSurplusList.filter(s => s.status !== 'assigned');
    const totalSurplusCount = unassignedSurplus.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    // Calculate per-employee live monthly capacity stats
    const employeeWorkloads = activeEmployees.map(emp => {
      const empAlloc = monthAllocations.filter(a => a.employeeId === emp.id);
      const usedUnits = empAlloc.reduce((sum, a) => sum + (Number(a.capacityUsed) || 0), 0);
      const postsCount = empAlloc.reduce((sum, a) => sum + (Number(a.work?.posts) || 0), 0);
      const reelsCount = empAlloc.reduce((sum, a) => sum + (Number(a.work?.reels) || 0), 0);
      const storiesCount = empAlloc.reduce((sum, a) => sum + (Number(a.work?.stories) || 0), 0);

      let totalUnits = 0;
      targetWeeks.forEach((week) => {
        const { effectiveWorkingDates } = getEffectiveWorkingDays(week, week.holidays || []);
        const cap = calculateWeeklyEmployeeCapacity(emp, capacityRules || [], effectiveWorkingDates, availabilityList || []);
        totalUnits += cap.weeklyCapacityUnits;
      });

      const utilization = calculateUtilization(usedUnits, totalUnits);

      return {
        ...emp,
        usedUnits,
        totalUnits,
        utilization,
        postsCount,
        reelsCount,
        storiesCount,
        allocationCount: empAlloc.length,
      };
    });

    // Upcoming holidays from all weeks
    const allHolidays = [];
    (weeks || []).forEach(w => {
      if (Array.isArray(w.holidays)) {
        w.holidays.forEach(h => {
          allHolidays.push({
            ...h,
            weekName: w.name,
          });
        });
      }
    });

    return {
      activeMonth,
      activeWeek: targetWeeks[0] || null,
      monthsList,
      stats: {
        totalClients: (clients || []).length,
        activeClients: activeClients.length,
        totalEmployees: (employees || []).length,
        activeEmployees: activeEmployees.length,
        graphicDesignersCount: graphicDesigners.length,
        videoEditorsCount: videoEditors.length,
        activeWeeksCount: targetWeeks.length,
        totalAllocatedPosts,
        totalAllocatedReels,
        totalAllocatedStories,
        totalSurplusCount,
        unassignedSurplusCount: unassignedSurplus.length,
      },
      teamCapacity: {
        graphic: {
          totalUnits: graphicTeamTotalCap,
          usedUnits: graphicTeamUsedCap,
          utilization: graphicTeamUtilization,
        },
        video: {
          totalUnits: videoTeamTotalCap,
          usedUnits: videoTeamUsedCap,
          utilization: videoTeamUtilization,
        },
      },
      recentSurplus: unassignedSurplus.slice(0, 5),
      upcomingHolidays: allHolidays.slice(0, 5),
      employees: employeeWorkloads,
    };
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    return DEFAULT_DASHBOARD_DATA;
  }
}
