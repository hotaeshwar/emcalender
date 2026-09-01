import { getClients } from './clientService';
import { getEmployees } from './employeeService';
import { getWorkWeeks } from './weekService';
import { getCapacityRules } from './capacityService';
import { getWorkRequirements } from './requirementService';
import { ROLES, CONTENT_TYPES } from '@/lib/constants';
import {
  calculateDailyEmployeeCapacity,
  calculateWeeklyEmployeeCapacity,
  getEffectiveWorkingDays,
  calculateUtilization,
  convertTaskToCapacityUnits
} from '@/lib/capacityCalculator';
import { getEmployeeAvailability } from './availabilityService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

export async function getDashboardData() {
  try {
    const [
      clients,
      employees,
      weeks,
      capacityRules,
      availabilityList,
      allocationsSnap,
      surplusSnap
    ] = await Promise.all([
      getClients().catch(() => []),
      getEmployees().catch(() => []),
      getWorkWeeks().catch(() => []),
      getCapacityRules().catch(() => []),
      getEmployeeAvailability().catch(() => []),
      getDocs(collection(db, 'allocations')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'surplusWork')).catch(() => ({ docs: [] })),
    ]);

    const activeClients = (clients || []).filter(c => c.status !== 'inactive');
    const activeEmployees = (employees || []).filter(e => e.status !== 'inactive');
    const graphicDesigners = activeEmployees.filter(e => e.role === ROLES.GRAPHIC_DESIGNER);
    const videoEditors = activeEmployees.filter(e => e.role === ROLES.VIDEO_EDITOR);

    const allocations = (allocationsSnap?.docs || []).map(d => ({ id: d.id, ...d.data() }));
    const surplusList = (surplusSnap?.docs || []).map(d => ({ id: d.id, ...d.data() }));

    // Find current active week or first week
    const activeWeek = (weeks || []).find(w => w.status === 'active') || (weeks || [])[0] || null;

    let graphicTeamTotalCap = 0;
    let graphicTeamUsedCap = 0;
    let videoTeamTotalCap = 0;
    let videoTeamUsedCap = 0;

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
      const weekAllocations = allocations.filter(a => a.weekId === activeWeek.id);
      weekAllocations.forEach(a => {
        if (a.employeeRole === ROLES.GRAPHIC_DESIGNER) {
          graphicTeamUsedCap += (Number(a.capacityUsed) || 0);
        } else if (a.employeeRole === ROLES.VIDEO_EDITOR) {
          videoTeamUsedCap += (Number(a.capacityUsed) || 0);
        }
      });
    }

    const graphicTeamUtilization = calculateUtilization(graphicTeamUsedCap, graphicTeamTotalCap);
    const videoTeamUtilization = calculateUtilization(videoTeamUsedCap, videoTeamTotalCap);

    // Sum allocated items
    let totalAllocatedPosts = 0;
    let totalAllocatedReels = 0;
    let totalAllocatedStories = 0;
    allocations.forEach(a => {
      totalAllocatedPosts += (Number(a.work?.posts) || 0);
      totalAllocatedReels += (Number(a.work?.reels) || 0);
      totalAllocatedStories += (Number(a.work?.stories) || 0);
    });

    // Sum surplus items
    const unassignedSurplus = surplusList.filter(s => s.status !== 'assigned');
    const totalSurplusCount = unassignedSurplus.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

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
      employees: activeEmployees,
    };
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    return DEFAULT_DASHBOARD_DATA;
  }
}
