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
      <meta http-equiv="content-type" application/vnd.ms-excel; charset=UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #0f172a; margin: 20px; }
        .title-banner { background-color: #0f172a; color: #ffffff; font-size: 16pt; font-weight: bold; padding: 12px; text-align: center; }
        .subtitle-banner { background-color: #1e293b; color: #cbd5e1; font-size: 11pt; padding: 6px 12px; text-align: center; }
        .section-header { background-color: #4338ca; color: #ffffff; font-size: 12pt; font-weight: bold; padding: 8px; margin-top: 15px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; border: 2px solid #000000; }
        th { border: 1px solid #000000; padding: 6px 8px; font-size: 10pt; font-weight: bold; text-align: center; vertical-align: middle; }
        td { border: 1px solid #000000; padding: 6px 8px; font-size: 10pt; vertical-align: middle; text-align: center; }
        
        /* User Specific Matrix Grid Colors */
        .header-yellow { background-color: #FFFF00; color: #000000; font-weight: bold; text-transform: uppercase; }
        .header-clients { background-color: #D1D5DB; color: #000000; font-weight: bold; text-transform: uppercase; }
        .header-staff { background-color: #E5E7EB; color: #000000; font-weight: bold; }
        .header-staff-a { background-color: #F8B195; color: #000000; font-weight: bold; text-transform: uppercase; }
        .header-staff-b { background-color: #F0A07E; color: #000000; font-weight: bold; text-transform: uppercase; }
        .header-sub { background-color: #FCE4D6; color: #000000; font-weight: bold; text-transform: uppercase; font-size: 9pt; }
        .header-total { background-color: #FFFFFF; color: #000000; font-weight: bold; text-transform: uppercase; }
        
        .client-cell { background-color: #E5E7EB; color: #000000; font-weight: bold; text-align: left; text-transform: uppercase; }
        .sno-cell { background-color: #FFFFFF; color: #000000; font-weight: bold; text-align: center; }
        .cell-staff-a { background-color: #FDF0ED; color: #000000; }
        .cell-staff-b { background-color: #FCE8E2; color: #000000; }
        .cell-total { background-color: #FFFFFF; color: #000000; font-weight: bold; }
        .row-total { background-color: #F3F4F6; font-weight: bold; border-top: 2px solid #000000; }

        .td-center { text-align: center; }
        .td-bold { font-weight: bold; }
        .badge-gd { background-color: #e0e7ff; color: #3730a3; font-weight: bold; padding: 3px 6px; border-radius: 4px; text-align: center; }
        .badge-ve { background-color: #d1fae5; color: #065f46; font-weight: bold; padding: 3px 6px; border-radius: 4px; text-align: center; }
        .badge-auto { background-color: #ecfdf5; color: #047857; font-weight: bold; }
        .badge-manual { background-color: #fffbeb; color: #b45309; font-weight: bold; }
        .metric-post { color: #1d4ed8; font-weight: bold; text-align: center; }
        .metric-reel { color: #7c3aed; font-weight: bold; text-align: center; }
        .metric-story { color: #d97706; font-weight: bold; text-align: center; }
        .metric-units { color: #047857; font-weight: bold; text-align: center; background-color: #ecfdf5; }
        .surplus-row { background-color: #fff1f2; color: #9f1239; }
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
 * Export EXACT Agency Client x Staff Matrix Excel format requested by user.
 */
export function exportAgencyMatrixGridExcel({
  week,
  clients = [],
  employees = [],
  allocations = [],
  dayName = 'MONDAY',
}) {
  const weekTitle = week?.name || 'Weekly Plan';
  const staffList = employees.length > 0 ? employees : [
    { id: 'emp1', name: 'HARSHITA' },
    { id: 'emp2', name: 'NEHA' },
    { id: 'emp3', name: 'GURJEET' },
    { id: 'emp4', name: 'KARAN' },
  ];

  const clientList = clients.length > 0 ? clients : [
    { id: 'c1', name: 'ACTION CAR DETAILING' },
    { id: 'c2', name: 'CHUTNEY HOUSE' },
    { id: 'c3', name: 'DND' },
    { id: 'c4', name: 'DIVINE DWELLING' },
    { id: 'c5', name: 'DEVINE STUDIO' },
    { id: 'c6', name: 'ISHA INTERNATIONAL' },
    { id: 'c7', name: 'BALAJI EV' },
    { id: 'c8', name: 'KC CROSSROAD' },
    { id: 'c9', name: 'THE RADIANT MANALI' },
    { id: 'c10', name: 'OREN KASAULI' },
    { id: 'c11', name: 'CELESTIAL TRADER' },
    { id: 'c12', name: 'TSS' },
  ];

  // Robust Indexing Map: (clientId / clientName) x (employeeId / employeeName / employeeCode)
  const matrixMap = {};

  allocations.forEach((alloc) => {
    const cKeys = [
      alloc.clientId,
      alloc.clientName,
      (alloc.clientName || '').toLowerCase(),
      (alloc.clientId || '').toLowerCase(),
    ].filter(Boolean);

    const eKeys = [
      alloc.employeeId,
      alloc.employeeName,
      alloc.employeeCode,
      (alloc.employeeName || '').toLowerCase(),
      (alloc.employeeCode || '').toLowerCase(),
    ].filter(Boolean);

    const posts = Number(alloc.work?.posts) || 0;
    const reels = Number(alloc.work?.reels) || 0;
    const stories = Number(alloc.work?.stories) || 0;

    cKeys.forEach((cKey) => {
      if (!matrixMap[cKey]) matrixMap[cKey] = {};
      eKeys.forEach((eKey) => {
        if (!matrixMap[cKey][eKey]) {
          matrixMap[cKey][eKey] = { posts: 0, reels: 0, stories: 0 };
        }
        matrixMap[cKey][eKey].posts += posts;
        matrixMap[cKey][eKey].reels += reels;
        matrixMap[cKey][eKey].stories += stories;
      });
    });
  });

  const getWorkCell = (client, staff) => {
    const cKeys = [client.id, client.name, (client.name || '').toLowerCase()].filter(Boolean);
    const sKeys = [staff.id, staff.name, staff.employeeCode, (staff.name || '').toLowerCase()].filter(Boolean);

    for (const ck of cKeys) {
      if (matrixMap[ck]) {
        for (const sk of sKeys) {
          if (matrixMap[ck][sk]) {
            return matrixMap[ck][sk];
          }
        }
      }
    }

    return { posts: 0, reels: 0, stories: 0 };
  };

  // Pre-calculate all totals for mathematical precision
  const staffTotals = {};
  staffList.forEach((s) => {
    staffTotals[s.id || s.name] = { posts: 0, reels: 0, stories: 0 };
  });

  const clientTotals = {};
  let grandPosts = 0;
  let grandReels = 0;
  let grandStories = 0;
  let grandWeekCount = 0;

  clientList.forEach((client) => {
    let cp = 0;
    let cr = 0;
    let cs = 0;

    staffList.forEach((s) => {
      const work = getWorkCell(client, s);
      cp += work.posts;
      cr += work.reels;
      cs += work.stories;

      const sKey = s.id || s.name;
      staffTotals[sKey].posts += work.posts;
      staffTotals[sKey].reels += work.reels;
      staffTotals[sKey].stories += work.stories;
    });

    const totalCount = cp + cr + cs;
    clientTotals[client.id || client.name] = { posts: cp, reels: cr, stories: cs, totalCount };

    grandPosts += cp;
    grandReels += cr;
    grandStories += cs;
    grandWeekCount += totalCount;
  });

  // Build Table Header Row 1 (Staff Names)
  let staffHeadersHtml = '';
  staffList.forEach((s, idx) => {
    const bgClass = idx % 2 === 0 ? 'header-staff-a' : 'header-staff-b';
    staffHeadersHtml += `<th colspan="3" class="${bgClass}">${s.name?.toUpperCase()}</th>`;
  });

  // Build Table Header Row 2 (Subheaders)
  let staffSubHeadersHtml = '';
  staffList.forEach(() => {
    staffSubHeadersHtml += `
      <th class="header-sub">POST</th>
      <th class="header-sub">REEL</th>
      <th class="header-sub">STORY</th>
    `;
  });

  // Build Client Data Rows
  const rowsHtml = clientList.map((client, cIdx) => {
    const sNo = cIdx + 1;
    const totals = clientTotals[client.id || client.name] || { posts: 0, reels: 0, stories: 0, totalCount: 0 };

    let staffCellsHtml = '';
    staffList.forEach((s, sIdx) => {
      const work = getWorkCell(client, s);
      const cellBg = sIdx % 2 === 0 ? 'cell-staff-a' : 'cell-staff-b';

      staffCellsHtml += `
        <td class="${cellBg}">${work.posts > 0 ? work.posts : ''}</td>
        <td class="${cellBg}">${work.reels > 0 ? work.reels : ''}</td>
        <td class="${cellBg}">${work.stories > 0 ? work.stories : ''}</td>
      `;
    });

    return `
      <tr>
        <td class="sno-cell">${sNo}</td>
        <td class="client-cell">${client.name}</td>
        <td style="background-color: #F3F4F6;"></td>
        ${staffCellsHtml}
        <td class="cell-total">${totals.posts > 0 ? totals.posts : ''}</td>
        <td class="cell-total">${totals.reels > 0 ? totals.reels : ''}</td>
        <td class="cell-total">${totals.stories > 0 ? totals.stories : ''}</td>
        <td class="cell-total td-bold">${totals.totalCount > 0 ? totals.totalCount : ''}</td>
      </tr>
    `;
  }).join('');

  // Build Footer Totals Row
  let staffFooterCellsHtml = '';
  staffList.forEach((s, sIdx) => {
    const sKey = s.id || s.name;
    const tot = staffTotals[sKey] || { posts: 0, reels: 0, stories: 0 };
    const cellBg = sIdx % 2 === 0 ? 'cell-staff-a' : 'cell-staff-b';
    staffFooterCellsHtml += `
      <td class="${cellBg} td-bold">${tot.posts > 0 ? tot.posts : ''}</td>
      <td class="${cellBg} td-bold">${tot.reels > 0 ? tot.reels : ''}</td>
      <td class="${cellBg} td-bold">${tot.stories > 0 ? tot.stories : ''}</td>
    `;
  });

  const html = `
    <div class="title-banner" style="margin-bottom: 10px;">Bid Employee Work Distributer</div>
    
    <table>
      <thead>
        <tr>
          <th style="width: 50px;">S.NO</th>
          <th class="header-yellow" style="width: 220px;">${dayName.toUpperCase()}</th>
          <th class="header-staff" style="width: 60px;">STAFF</th>
          ${staffHeadersHtml}
          <th colspan="3" class="header-total">TOTAL COUNT</th>
          <th style="width: 100px;"></th>
        </tr>
        <tr>
          <th></th>
          <th class="header-clients">CLIENTS</th>
          <th></th>
          ${staffSubHeadersHtml}
          <th class="header-sub">P</th>
          <th class="header-sub">R</th>
          <th class="header-sub">STORY</th>
          <th class="header-sub">WEEK COUNT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="row-total">
          <td class="sno-cell"></td>
          <td class="client-cell">TOTAL</td>
          <td></td>
          ${staffFooterCellsHtml}
          <td class="cell-total td-bold">${grandPosts}</td>
          <td class="cell-total td-bold">${grandReels}</td>
          <td class="cell-total td-bold">${grandStories}</td>
          <td class="cell-total td-bold" style="font-size: 11pt; background-color: #FEF08A;">${grandWeekCount}</td>
        </tr>
      </tbody>
    </table>
  `;

  downloadExcelHTML(`Agency_Work_Distribution_Matrix_${dayName}`, html);
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
  exportAgencyMatrixGridExcel({
    week,
    clients,
    employees,
    allocations,
    dayName: 'MONDAY',
  });
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
  clients = [],
}) {
  exportAgencyMatrixGridExcel({
    week,
    clients,
    employees: activeEmployees,
    allocations,
    dayName: 'MONDAY',
  });
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
