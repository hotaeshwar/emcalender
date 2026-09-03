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

const DEFAULT_DASHBOARD_DATA = {
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
};

export async function getDashboardData(targetWeekId = null) {
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

    // Find requested target week, active week, or first available week
    let activeWeek = null;
    if (targetWeekId && targetWeekId !== 'all') {
      activeWeek = (weeks || []).find(w => w.id === targetWeekId) || null;
    }
    if (!activeWeek) {
      activeWeek = (weeks || []).find(w => w.status === 'active') || (weeks || [])[0] || null;
    }

    let graphicTeamTotalCap = 0;
    let graphicTeamUsedCap = 0;
    let videoTeamTotalCap = 0;
    let videoTeamUsedCap = 0;

    // Filter allocations for the active week
    const weekAllocations = activeWeek
      ? (allocations || []).filter(a => a.weekId === activeWeek.id || a.weekName === activeWeek.name)
      : (allocations || []);

    if (activeWeek) {
      const { effectiveWorkingDates } = getEffectiveWorkingDays(activeWeek, activeWeek.holidays || []);

      // Calculate total capacity for Graphic Team
      graphicDesigners.forEach(gd => {
        const cap = calculateWeeklyEmployeeCapacity(gd, capacityRules || [], effectiveWorkingDates, availabilityList || []);
        graphicTeamTotalCap += cap.weeklyCapacityUnits;
      });

      // Calculate total capacity for Video Team
      videoEditors.forEach(ve => {
        const cap = calculateWeeklyEmployeeCapacity(ve, capacityRules || [], effectiveWorkingDates, availabilityList || []);
        videoTeamTotalCap += cap.weeklyCapacityUnits;
      });

      // Calculate used capacity for this week's allocations
      weekAllocations.forEach(a => {
        const used = Number(a.capacityUsed) || 0;
        const role = a.employeeRole || (employees.find(e => e.id === a.employeeId)?.role);

        if (role === ROLES.GRAPHIC_DESIGNER) {
          graphicTeamUsedCap += used;
        } else if (role === ROLES.VIDEO_EDITOR) {
          videoTeamUsedCap += used;
        }
      });
    }

    const graphicTeamUtilization = calculateUtilization(graphicTeamUsedCap, graphicTeamTotalCap);
    const videoTeamUtilization = calculateUtilization(videoTeamUsedCap, videoTeamTotalCap);

    // Sum allocated items for the active week
    let totalAllocatedPosts = 0;
    let totalAllocatedReels = 0;
    let totalAllocatedStories = 0;
    weekAllocations.forEach(a => {
      totalAllocatedPosts += (Number(a.work?.posts) || 0);
      totalAllocatedReels += (Number(a.work?.reels) || 0);
      totalAllocatedStories += (Number(a.work?.stories) || 0);
    });

    // Sum surplus items for the active week
    const weekSurplusList = activeWeek
      ? (surplusList || []).filter(s => s.weekId === activeWeek.id)
      : (surplusList || []);
    const unassignedSurplus = weekSurplusList.filter(s => s.status !== 'assigned');
    const totalSurplusCount = unassignedSurplus.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

    // Calculate per-employee live capacity stats for this week
    const employeeWorkloads = activeEmployees.map(emp => {
      const empAlloc = weekAllocations.filter(a => a.employeeId === emp.id);
      const usedUnits = empAlloc.reduce((sum, a) => sum + (Number(a.capacityUsed) || 0), 0);
      const postsCount = empAlloc.reduce((sum, a) => sum + (Number(a.work?.posts) || 0), 0);
      const reelsCount = empAlloc.reduce((sum, a) => sum + (Number(a.work?.reels) || 0), 0);
      const storiesCount = empAlloc.reduce((sum, a) => sum + (Number(a.work?.stories) || 0), 0);

      const effectiveDates = activeWeek
        ? getEffectiveWorkingDays(activeWeek, activeWeek.holidays || []).effectiveWorkingDates
        : [];
      const cap = calculateWeeklyEmployeeCapacity(emp, capacityRules || [], effectiveDates, availabilityList || []);
      const totalUnits = cap.weeklyCapacityUnits;
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
      activeWeek,
      stats: {
        totalClients: (clients || []).length,
        activeClients: activeClients.length,
        totalEmployees: (employees || []).length,
        activeEmployees: activeEmployees.length,
        graphicDesignersCount: graphicDesigners.length,
        videoEditorsCount: videoEditors.length,
        activeWeeksCount: (weeks || []).length,
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
