'use client';

import React from 'react';

export default function AgencyMatrixGrid({
  week,
  clients = [],
  employees = [],
  allocations = [],
  dayName = null,
  searchQuery = '',
  clientFilter = 'all',
  employeeFilter = 'all',
  roleFilter = 'all',
}) {
  const displayHeader = dayName
    ? dayName.toUpperCase()
    : week?.name
    ? `${week.name.toUpperCase()} (MON–SAT)`
    : 'WEEKLY SCHEDULE';

  // Build staff list strictly from active employees passed in from Firebase, filtered by role/staff/search
  const staffList = (employees || [])
    .filter((e) => e && e.name && e.status !== 'inactive')
    .filter((e) => {
      if (employeeFilter !== 'all' && e.id !== employeeFilter && e.employeeCode !== employeeFilter) {
        return false;
      }
      if (roleFilter !== 'all' && (e.role || '').toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }
      return true;
    })
    .map((e) => ({
      id: e.id || e.employeeCode,
      name: e.name.toUpperCase(),
      employeeCode: e.employeeCode || e.id,
      role: e.role || 'graphic_designer',
    }));

  // Build client list strictly from clients passed in from Firebase, filtered by client/search
  const clientList = (clients || [])
    .filter((c) => c && c.name && c.status !== 'inactive')
    .filter((c) => {
      if (clientFilter !== 'all' && c.id !== clientFilter && c.clientCode !== clientFilter) {
        return false;
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesClient = (c.name || '').toLowerCase().includes(query) || (c.clientCode || '').toLowerCase().includes(query);
        if (!matchesClient) {
          // Check if any allocation for this client matches search
          const hasMatchingAlloc = (allocations || []).some(
            (a) => (a.clientId === c.id || a.clientName === c.name) &&
                   ((a.employeeName || '').toLowerCase().includes(query) || (a.employeeCode || '').toLowerCase().includes(query))
          );
          if (!hasMatchingAlloc) return false;
        }
      }
      return true;
    })
    .map((c) => ({
      id: c.id || c.clientCode,
      name: c.name.toUpperCase(),
      clientCode: c.clientCode || c.id,
    }));

  if (staffList.length === 0) {
    return (
      <div className="p-8 text-center bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl my-4">
        <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">No Active Employees Found in Database</h3>
        <p className="text-xs text-amber-800 mt-1 font-medium">Please add employees under Employees management page to generate the matrix grid.</p>
      </div>
    );
  }

  if (clientList.length === 0) {
    return (
      <div className="p-8 text-center bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl my-4">
        <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">No Active Clients Found in Database</h3>
        <p className="text-xs text-amber-800 mt-1 font-medium">Please add clients under Clients management page to generate the matrix grid.</p>
      </div>
    );
  }

  // Multi-Key Indexing Map: (clientId / clientName) x (employeeId / employeeName / employeeCode)
  const activeAllocations = Array.isArray(allocations) ? allocations : [];
  const matrixMap = {};

  activeAllocations.forEach((alloc) => {
    const cKeys = [
      alloc.clientId,
      alloc.clientName,
      (alloc.clientName || '').toUpperCase(),
      (alloc.clientName || '').toLowerCase(),
      (alloc.clientId || '').toLowerCase(),
    ].filter(Boolean);

    const eKeys = [
      alloc.employeeId,
      alloc.employeeName,
      alloc.employeeCode,
      (alloc.employeeName || '').toUpperCase(),
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
    const cKeys = [client.id, client.name, (client.name || '').toUpperCase(), (client.name || '').toLowerCase()].filter(Boolean);
    const sKeys = [staff.id, staff.name, staff.employeeCode, (staff.name || '').toUpperCase(), (staff.name || '').toLowerCase()].filter(Boolean);

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

  // Pre-calculate totals for full mathematical accuracy
  const staffTotals = {};
  staffList.forEach((s) => {
    const sKey = (s.name || s.id).toUpperCase();
    staffTotals[sKey] = { posts: 0, reels: 0, stories: 0 };
  });

  const clientTotals = {};
  let grandPosts = 0;
  let grandReels = 0;
  let grandStories = 0;
  let grandWeekCount = 0;

  clientList.forEach((client) => {
    let cp = 0;
    let crGd = 0;
    let crVe = 0;
    let cs = 0;

    staffList.forEach((s) => {
      const work = getWorkCell(client, s);
      const isVE = (s.role || '').toLowerCase() === 'video_editor';

      cp += work.posts;
      cs += work.stories;
      if (isVE) {
        crVe += work.reels;
      } else {
        crGd += work.reels;
      }

      const sKey = (s.name || s.id).toUpperCase();
      if (!staffTotals[sKey]) staffTotals[sKey] = { posts: 0, reels: 0, stories: 0 };
      staffTotals[sKey].posts += work.posts;
      staffTotals[sKey].reels += work.reels;
      staffTotals[sKey].stories += work.stories;
    });

    const cr = Math.max(crGd, crVe);
    const totalCount = cp + cr + cs;
    clientTotals[(client.name || client.id).toUpperCase()] = { posts: cp, reels: cr, stories: cs, totalCount };

    grandPosts += cp;
    grandReels += cr;
    grandStories += cs;
    grandWeekCount += totalCount;
  });

  return (
    <div className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-md my-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs text-center border border-slate-900">
          <thead>
            {/* Header Row 1 */}
            <tr className="border-b-2 border-slate-900">
              <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-900 font-extrabold bg-white text-slate-900 w-12 whitespace-nowrap">
                S.NO
              </th>
              <th className="py-2.5 px-4 border-r border-slate-900 font-black bg-yellow-300 text-slate-900 uppercase text-sm tracking-wider w-56 whitespace-nowrap">
                {displayHeader}
              </th>

              {/* Staff Member Header Columns */}
              {staffList.map((staff, sIdx) => {
                const bgStyle = sIdx % 2 === 0 ? 'bg-[#F8B195] text-slate-900' : 'bg-[#F0A07E] text-slate-900';
                return (
                  <th
                    key={staff.id || sIdx}
                    colSpan={3}
                    className={`py-2.5 px-3 border-r border-slate-900 font-black text-sm uppercase tracking-wider whitespace-nowrap text-center ${bgStyle}`}
                  >
                    {staff.name?.toUpperCase()}
                  </th>
                );
              })}

              <th
                colSpan={3}
                className="py-2.5 px-3 border-r border-slate-900 font-black bg-white text-slate-900 uppercase text-xs tracking-wider whitespace-nowrap"
              >
                TOTAL COUNT
              </th>
              <th rowSpan={2} className="py-2.5 px-3 font-black bg-white text-slate-900 uppercase text-xs tracking-wider w-28 whitespace-nowrap">
                WEEK COUNT
              </th>
            </tr>

            {/* Header Row 2 */}
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] font-black uppercase text-slate-900">
              <th className="py-2 px-3 border-r border-slate-900 bg-slate-300 font-black text-slate-900 text-left whitespace-nowrap">
                CLIENTS
              </th>

              {/* Content Subheaders for each Staff Member */}
              {staffList.map((staff, sIdx) => (
                <React.Fragment key={`sub-${staff.id || sIdx}`}>
                  <th className="py-2 px-2 border-r border-slate-900 bg-[#FCE4D6] whitespace-nowrap">POST</th>
                  <th className="py-2 px-2 border-r border-slate-900 bg-[#FCE4D6] whitespace-nowrap">REEL</th>
                  <th className="py-2 px-2 border-r border-slate-900 bg-[#FCE4D6] whitespace-nowrap">STORY</th>
                </React.Fragment>
              ))}

              <th className="py-2 px-2 border-r border-slate-900 bg-slate-50 font-black whitespace-nowrap">P</th>
              <th className="py-2 px-2 border-r border-slate-900 bg-slate-50 font-black whitespace-nowrap">R</th>
              <th className="py-2 px-2 border-r border-slate-900 bg-slate-50 font-black whitespace-nowrap">S</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300 font-medium text-slate-900">
            {clientList.map((client, cIdx) => {
              const sNo = cIdx + 1;
              const totals = clientTotals[(client.name || client.id).toUpperCase()] || { posts: 0, reels: 0, stories: 0, totalCount: 0 };

              return (
                <tr key={client.id || cIdx} className="hover:bg-amber-50/40 transition-colors">
                  <td className="py-2.5 px-2 border-r border-slate-900 font-bold bg-white text-slate-900">
                    {sNo}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-900 font-extrabold bg-slate-200 text-slate-900 text-left uppercase">
                    {client.name}
                  </td>

                  {/* Staff Cells */}
                  {staffList.map((staff, sIdx) => {
                    const work = getWorkCell(client, staff);
                    const cellBg = sIdx % 2 === 0 ? 'bg-[#FDF0ED]' : 'bg-[#FCE8E2]';

                    return (
                      <React.Fragment key={`cell-${client.id || cIdx}-${staff.id || sIdx}`}>
                        <td className={`py-2.5 px-2 border-r border-slate-900 ${cellBg} font-bold text-blue-900`}>
                          {work.posts > 0 ? work.posts : ''}
                        </td>
                        <td className={`py-2.5 px-2 border-r border-slate-900 ${cellBg} font-bold text-purple-900`}>
                          {work.reels > 0 ? work.reels : ''}
                        </td>
                        <td className={`py-2.5 px-2 border-r border-slate-900 ${cellBg} font-bold text-amber-900`}>
                          {work.stories > 0 ? work.stories : ''}
                        </td>
                      </React.Fragment>
                    );
                  })}

                  {/* Client Totals */}
                  <td className="py-2.5 px-2 border-r border-slate-900 font-extrabold bg-white text-slate-900">
                    {totals.posts > 0 ? totals.posts : ''}
                  </td>
                  <td className="py-2.5 px-2 border-r border-slate-900 font-extrabold bg-white text-slate-900">
                    {totals.reels > 0 ? totals.reels : ''}
                  </td>
                  <td className="py-2.5 px-2 border-r border-slate-900 font-extrabold bg-white text-slate-900">
                    {totals.stories > 0 ? totals.stories : ''}
                  </td>
                  <td className="py-2.5 px-2 font-black bg-white text-slate-900 text-sm">
                    {totals.totalCount > 0 ? totals.totalCount : ''}
                  </td>
                </tr>
              );
            })}

            {/* Total Footer Row */}
            <tr className="border-t-2 border-slate-900 bg-slate-200 font-black text-slate-900">
              <td className="py-3 px-2 border-r border-slate-900 bg-white"></td>
              <td className="py-3 px-3 border-r border-slate-900 bg-slate-300 text-left font-black uppercase text-sm">
                TOTAL
              </td>

              {/* Staff Footer Totals */}
              {staffList.map((staff, sIdx) => {
                const sKey = (staff.name || staff.id).toUpperCase();
                const tot = staffTotals[sKey] || { posts: 0, reels: 0, stories: 0 };
                const cellBg = sIdx % 2 === 0 ? 'bg-[#FDF0ED]' : 'bg-[#FCE8E2]';

                return (
                  <React.Fragment key={`tot-${staff.id || sIdx}`}>
                    <td className={`py-3 px-2 border-r border-slate-900 ${cellBg} font-black text-blue-950`}>
                      {tot.posts > 0 ? tot.posts : ''}
                    </td>
                    <td className={`py-3 px-2 border-r border-slate-900 ${cellBg} font-black text-purple-950`}>
                      {tot.reels > 0 ? tot.reels : ''}
                    </td>
                    <td className={`py-3 px-2 border-r border-slate-900 ${cellBg} font-black text-amber-950`}>
                      {tot.stories > 0 ? tot.stories : ''}
                    </td>
                  </React.Fragment>
                );
              })}

              {/* Grand Totals */}
              <td className="py-3 px-2 border-r border-slate-900 font-black text-sm bg-white">
                {grandPosts}
              </td>
              <td className="py-3 px-2 border-r border-slate-900 font-black text-sm bg-white">
                {grandReels}
              </td>
              <td className="py-3 px-2 border-r border-slate-900 font-black text-sm bg-white">
                {grandStories}
              </td>
              <td className="py-3 px-2 font-black text-base bg-yellow-200 text-slate-950">
                {grandWeekCount}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
