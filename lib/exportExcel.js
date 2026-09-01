/**
 * Color-Coded Excel Spreadsheet Export Utility
 * 
 * Generates rich HTML/XML styled Excel spreadsheets (.xls) with custom
 * color schemes, stylized column headers, colored badges, borders, and alternating rows.
 * Microsoft Excel, Google Sheets, Apple Numbers, and LibreOffice Calc render these with full colors.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatWeekday(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return DAY_NAMES[date.getDay()] || '';
  } catch (e) {
    return '';
  }
}

/**
 * Downloads a stylized color Excel file in the browser.
 */
function downloadExcelHTML(filename, htmlContent) {
  const fullHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #0f172a; margin: 20px; }
        .title-banner { background-color: #0f172a; color: #ffffff; font-size: 16pt; font-weight: bold; padding: 12px; text-align: center; }
        .subtitle-banner { background-color: #1e293b; color: #cbd5e1; font-size: 11pt; padding: 6px 12px; text-align: center; }
        .section-header { background-color: #4338ca; color: #ffffff; font-size: 12pt; font-weight: bold; padding: 8px; margin-top: 15px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; font-size: 10pt; text-align: center; vertical-align: middle; border: 1px solid #94a3b8; padding: 8px; }
        th.th-client { background-color: #1e3a8a; }
        th.th-staff { background-color: #312e81; }
        th.th-posts { background-color: #1d4ed8; }
        th.th-reels { background-color: #6d28d9; }
        th.th-stories { background-color: #b45309; }
        th.th-units { background-color: #047857; }
        th.th-type { background-color: #334155; }
        td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10pt; vertical-align: middle; }
        .td-center { text-align: center; }
        .td-right { text-align: right; }
        .td-bold { font-weight: bold; }
        .row-even { background-color: #f8fafc; }
        .row-odd { background-color: #ffffff; }
        .badge-gd { background-color: #e0e7ff; color: #3730a3; font-weight: bold; padding: 3px 6px; border-radius: 4px; text-align: center; }
        .badge-ve { background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 3px 6px; border-radius: 4px; text-align: center; }
        .badge-auto { background-color: #ecfdf5; color: #047857; font-weight: bold; }
        .badge-manual { background-color: #fffbeb; color: #b45309; font-weight: bold; }
        .badge-holiday { background-color: #fef3c7; color: #92400e; font-weight: bold; }
        .badge-leave { background-color: #ffe4e6; color: #be123c; font-weight: bold; }
        .metric-post { color: #1d4ed8; font-weight: bold; text-align: center; }
        .metric-reel { color: #7c3aed; font-weight: bold; text-align: center; }
        .metric-story { color: #d97706; font-weight: bold; text-align: center; }
        .metric-units { color: #047857; font-weight: bold; text-align: center; background-color: #ecfdf5; }
        .surplus-row { background-color: #fff1f2; color: #9f1239; }
        .total-row { background-color: #e2e8f0; font-weight: bold; border-top: 2px solid #64748b; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanName = (filename || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = `${cleanName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export full color-coded weekly allocation report.
 */
export function exportAllocationReport({
  week,
  allocations = [],
  surplus = [],
  clients = [],
  employees = [],
}) {
  const weekName = week?.name || 'Weekly Plan';
  const startDate = week?.startDate || 'N/A';
  const endDate = week?.endDate || 'N/A';
  const workingDaysCount = week?.calculatedWorkingDays || 5;

  let totalPosts = 0;
  let totalReels = 0;
  let totalStories = 0;
  let totalUnits = 0;

  allocations.forEach((a) => {
    totalPosts += Number(a.work?.posts) || 0;
    totalReels += Number(a.work?.reels) || 0;
    totalStories += Number(a.work?.stories) || 0;
    totalUnits += Number(a.capacityUsed) || 0;
  });

  const allocationRowsHtml = allocations.map((alloc, idx) => {
    const client = clients.find((c) => c.id === alloc.clientId);
    const clientDisplay = client ? `${client.name} (${client.clientCode || ''})` : alloc.clientId;
    const isGD = alloc.employeeRole === 'graphic_designer';
    const roleBadge = isGD ? '<span class="badge-gd">Graphic Designer</span>' : '<span class="badge-ve">Video Editor</span>';
    const typeBadge = alloc.assignmentType === 'manual' ? '<span class="badge-manual">Manual</span>' : '<span class="badge-auto">Auto-Balanced</span>';
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';

    return `
      <tr class="${rowClass}">
        <td class="td-bold">${clientDisplay}</td>
        <td>${alloc.employeeName} (${alloc.employeeCode || ''})</td>
        <td class="td-center">${roleBadge}</td>
        <td class="metric-post">${alloc.work?.posts || 0}</td>
        <td class="metric-reel">${alloc.work?.reels || 0}</td>
        <td class="metric-story">${alloc.work?.stories || 0}</td>
        <td class="metric-units">${alloc.capacityUsed} Units</td>
        <td class="td-center">${typeBadge}</td>
      </tr>
    `;
  }).join('');

  let surplusSectionHtml = '';
  if (surplus.length > 0) {
    const surplusRowsHtml = surplus.map((s) => {
      const client = clients.find((c) => c.id === s.clientId);
      const clientDisplay = client ? `${client.name}` : s.clientId;
      return `
        <tr class="surplus-row">
          <td class="td-bold">${clientDisplay}</td>
          <td class="td-center td-bold">${s.contentType?.toUpperCase()}</td>
          <td class="td-center">${s.roleRequired === 'graphic_designer' ? 'Graphic Designer' : 'Video Editor'}</td>
          <td class="td-center td-bold" style="color: #be123c;">${s.quantity}</td>
          <td>${s.reasonLabel || s.reason}</td>
        </tr>
      `;
    }).join('');

    surplusSectionHtml = `
      <div class="section-header" style="background-color: #be123c; margin-top: 25px;">
        ⚠️ Unassigned Surplus Deliverables (Exceeding Capacity Limits)
      </div>
      <table>
        <thead>
          <tr>
            <th style="background-color: #9f1239;">Client</th>
            <th style="background-color: #9f1239;">Content Type</th>
            <th style="background-color: #9f1239;">Required Role</th>
            <th style="background-color: #9f1239;">Surplus Quantity</th>
            <th style="background-color: #9f1239;">Diagnosis / Reason</th>
          </tr>
        </thead>
        <tbody>
          ${surplusRowsHtml}
        </tbody>
      </table>
    `;
  }

  const html = `
    <div class="title-banner">Bid Employee Work Distributer</div>
    <div class="subtitle-banner">
      Allocation Plan: <strong>${weekName}</strong> | Period: <strong>${startDate} to ${endDate}</strong> | Working Days: <strong>${workingDaysCount} Days</strong>
    </div>

    <div class="section-header" style="background-color: #1e3a8a;">
      Confirmed Work Deliverable Allocations
    </div>

    <table>
      <thead>
        <tr>
          <th class="th-client" style="width: 22%;">Client Name</th>
          <th class="th-staff" style="width: 22%;">Assigned Staff</th>
          <th style="width: 16%;">Role</th>
          <th class="th-posts" style="width: 8%;">Posts</th>
          <th class="th-reels" style="width: 8%;">Reels</th>
          <th class="th-stories" style="width: 8%;">Stories</th>
          <th class="th-units" style="width: 10%;">Effort Units</th>
          <th class="th-type" style="width: 10%;">Method</th>
        </tr>
      </thead>
      <tbody>
        ${allocationRowsHtml}
        <tr class="total-row">
          <td colspan="3" style="text-align: right; padding-right: 15px;">WEEKLY TOTALS:</td>
          <td class="metric-post">${totalPosts}</td>
          <td class="metric-reel">${totalReels}</td>
          <td class="metric-story">${totalStories}</td>
          <td class="metric-units">${totalUnits} Units</td>
          <td class="td-center">—</td>
        </tr>
      </tbody>
    </table>

    ${surplusSectionHtml}

    <div style="margin-top: 30px; font-size: 9pt; color: #64748b; text-align: center;">
      Generated automatically by Bid Employee Work Distributer on ${new Date().toLocaleString()}
    </div>
  `;

  downloadExcelHTML(`Allocation_Report_${weekName.replace(/\s+/g, '_')}`, html);
}

/**
 * Export Work Weeks Master list with Week Number and Weekdays.
 */
export function exportWorkWeeksReport(weeks = []) {
  const rowsHtml = weeks.map((w, idx) => {
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';
    const datesList = (w.workingDates || []).map((d) => `${formatWeekday(d)} (${d})`).join(', ');
    const holidaysList = (w.holidays || []).map((h) => `${h.name} (${h.holidayDate || h.date})`).join(', ') || 'None';

    return `
      <tr class="${rowClass}">
        <td class="td-center td-bold" style="color: #4338ca;">Week ${w.weekNumber || (idx + 1)}</td>
        <td class="td-bold">${w.name}</td>
        <td class="td-center font-mono">${w.startDate} to ${w.endDate}</td>
        <td class="td-center td-bold" style="color: #047857;">${w.calculatedWorkingDays || 5} Days</td>
        <td>${datesList}</td>
        <td>${holidaysList}</td>
        <td class="td-center">${w.status === 'active' ? '<span class="badge-auto">Active</span>' : 'Draft'}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="title-banner">Bid Employee Work Distributer</div>
    <div class="subtitle-banner">Work Weeks Master Calendar & Weekday Schedule</div>

    <div class="section-header" style="background-color: #1e3a8a;">
      Configured Work Weeks & Working Weekdays
    </div>

    <table>
      <thead>
        <tr>
          <th style="background-color: #312e81; width: 10%;">Week No</th>
          <th class="th-client" style="width: 18%;">Week Title</th>
          <th style="width: 16%;">Date Range</th>
          <th class="th-units" style="width: 12%;">Effective Days</th>
          <th style="width: 24%;">Active Working Dates & Weekdays</th>
          <th style="width: 14%;">Holidays</th>
          <th style="width: 6%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  downloadExcelHTML('Work_Weeks_Master_Schedule', html);
}

/**
 * Export color-coded Workload Matrix Heatmap.
 */
export function exportMatrixReport({
  week,
  activeEmployees = [],
  allocations = [],
  availabilityList = [],
  holidays = [],
}) {
  const weekName = week?.name || 'Matrix';
  const workingDates = week?.workingDates || [];
  const holidayDateSet = new Set(holidays.map((h) => h.holidayDate || h.date));

  const headersHtml = workingDates.map((dateStr) => {
    const isHoliday = holidayDateSet.has(dateStr);
    const weekday = formatWeekday(dateStr);
    const bg = isHoliday ? '#b45309' : '#1e293b';
    return `
      <th style="background-color: ${bg}; min-width: 100px;">
        ${weekday}<br/>
        <span style="font-size: 9pt; font-weight: normal;">${dateStr}</span>
        ${isHoliday ? '<br/>(Holiday)' : ''}
      </th>
    `;
  }).join('');

  const rowsHtml = activeEmployees.map((emp, idx) => {
    const empAllocations = allocations.filter((a) => a.employeeId === emp.id && a.weekId === week?.id);
    let totalPosts = 0;
    let totalReels = 0;
    let totalStories = 0;
    let totalUnits = 0;

    empAllocations.forEach((a) => {
      totalPosts += Number(a.work?.posts) || 0;
      totalReels += Number(a.work?.reels) || 0;
      totalStories += Number(a.work?.stories) || 0;
      totalUnits += Number(a.capacityUsed) || 0;
    });

    const isGD = emp.role === 'graphic_designer';
    const roleBadge = isGD ? '<span class="badge-gd">Graphic Designer</span>' : '<span class="badge-ve">Video Editor</span>';
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';

    const dateCellsHtml = workingDates.map((dateStr) => {
      const isHoliday = holidayDateSet.has(dateStr);
      const avail = availabilityList.find((a) => a.employeeId === emp.id && a.date === dateStr);

      if (isHoliday) {
        return '<td class="td-center badge-holiday">Holiday</td>';
      }
      if (avail && avail.availability === 'leave') {
        return '<td class="td-center badge-leave">Leave (0x)</td>';
      }
      if (avail && avail.availability === 'half_day') {
        return '<td class="td-center" style="background-color: #fef3c7; color: #b45309; font-weight: bold;">Half Day (0.5x)</td>';
      }

      return `<td class="td-center" style="background-color: #f0fdf4; font-weight: bold; color: #15803d;">Active</td>`;
    }).join('');

    return `
      <tr class="${rowClass}">
        <td class="td-bold">${emp.name} (${emp.employeeCode || ''})</td>
        <td class="td-center">${roleBadge}</td>
        ${dateCellsHtml}
        <td class="td-center metric-post">${totalPosts}P</td>
        <td class="td-center metric-reel">${totalReels}R</td>
        <td class="td-center metric-story">${totalStories}S</td>
        <td class="metric-units">${totalUnits} Units</td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="title-banner">Bid Employee Work Distributer</div>
    <div class="subtitle-banner">
      Workload Matrix Heatmap: <strong>${weekName}</strong> | Period: <strong>${week?.startDate} to ${week?.endDate}</strong>
    </div>

    <div class="section-header" style="background-color: #312e81;">
      Employee Daily Working Distribution & Capacity Matrix
    </div>

    <table>
      <thead>
        <tr>
          <th class="th-staff">Team Member</th>
          <th>Role</th>
          ${headersHtml}
          <th class="th-posts">Posts</th>
          <th class="th-reels">Reels</th>
          <th class="th-stories">Stories</th>
          <th class="th-units">Total Units</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;

  downloadExcelHTML(`Matrix_Heatmap_${weekName.replace(/\s+/g, '_')}`, html);
}

/**
 * Quick CSV Export fallback if requested
 */
export function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(header => {
      let val = row[header] ?? '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
