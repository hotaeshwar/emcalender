'use client';

import React from 'react';

export default function AgencyMatrixGrid({
  week,
  clients = [],
  employees = [],
  allocations = [],
  dayName = 'MONDAY',
}) {
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

  // Function to safely fetch work cell data
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

  // Pre-calculate totals for full mathematical precision
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

  return (
    <div className="bg-white border-2 border-slate-900 rounded-2xl overflow-hidden shadow-md my-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs text-center border border-slate-900">
          <thead>
            {/* Header Row 1 */}
            <tr className="border-b-2 border-slate-900">
              <th className="py-2.5 px-3 border-r border-slate-900 font-extrabold bg-white text-slate-900 w-12">
                S.NO
              </th>
              <th className="py-2.5 px-4 border-r border-slate-900 font-black bg-yellow-300 text-slate-900 uppercase text-sm tracking-wider w-56">
                {dayName.toUpperCase()}
              </th>
              <th className="py-2.5 px-3 border-r border-slate-900 font-extrabold bg-slate-100 text-slate-900 w-14">
                STAFF
              </th>

              {/* Staff Member Header Columns */}
              {staffList.map((staff, sIdx) => {
                const bgStyle = sIdx % 2 === 0 ? 'bg-[#F8B195] text-slate-900' : 'bg-[#F0A07E] text-slate-900';
                return (
                  <th
                    key={staff.id || sIdx}
                    colSpan={3}
                    className={`py-2.5 px-3 border-r border-slate-900 font-black text-sm uppercase tracking-wider ${bgStyle}`}
                  >
                    {staff.name?.toUpperCase()}
                  </th>
                );
              })}

              <th
                colSpan={3}
                className="py-2.5 px-3 border-r border-slate-900 font-black bg-white text-slate-900 uppercase text-xs tracking-wider"
              >
                TOTAL COUNT
              </th>
              <th className="py-2.5 px-3 font-black bg-white text-slate-900 uppercase text-xs tracking-wider w-28">
                WEEK COUNT
              </th>
            </tr>

            {/* Header Row 2 */}
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-[11px] font-black uppercase text-slate-900">
              <th className="py-2 px-2 border-r border-slate-900"></th>
              <th className="py-2 px-3 border-r border-slate-900 bg-slate-300 font-black text-slate-900 text-left">
                CLIENTS
              </th>
              <th className="py-2 px-2 border-r border-slate-900"></th>

              {/* Content Subheaders for each Staff Member */}
              {staffList.map((staff, sIdx) => (
                <React.Fragment key={`sub-${staff.id || sIdx}`}>
                  <th className="py-2 px-2 border-r border-slate-900 bg-[#FCE4D6]">POST</th>
                  <th className="py-2 px-2 border-r border-slate-900 bg-[#FCE4D6]">REEL</th>
                  <th className="py-2 px-2 border-r border-slate-900 bg-[#FCE4D6]">STORY</th>
                </React.Fragment>
              ))}

              <th className="py-2 px-2 border-r border-slate-900 bg-slate-50 font-black">P</th>
              <th className="py-2 px-2 border-r border-slate-900 bg-slate-50 font-black">R</th>
              <th className="py-2 px-2 border-r border-slate-900 bg-slate-50 font-black">S</th>
              <th className="py-2 px-2 bg-slate-50 font-black">WEEK COUNT</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-300 font-medium text-slate-900">
            {clientList.map((client, cIdx) => {
              const sNo = cIdx + 1;
              const totals = clientTotals[client.id || client.name] || { posts: 0, reels: 0, stories: 0, totalCount: 0 };

              return (
                <tr key={client.id || cIdx} className="hover:bg-amber-50/40 transition-colors">
                  <td className="py-2.5 px-2 border-r border-slate-900 font-bold bg-white text-slate-900">
                    {sNo}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-900 font-extrabold bg-slate-200 text-slate-900 text-left uppercase">
                    {client.name}
                  </td>
                  <td className="py-2.5 px-2 border-r border-slate-900 bg-slate-50"></td>

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
              <td className="py-3 px-2 border-r border-slate-900 bg-slate-100"></td>

              {/* Staff Footer Totals */}
              {staffList.map((staff, sIdx) => {
                const sKey = staff.id || staff.name;
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
