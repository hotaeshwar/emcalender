'use client';

import React, { useState } from 'react';
import Badge from './Badge';
import { Calendar, Users, Briefcase, ChevronRight, Sparkles } from 'lucide-react';
import { ROLES, CONTENT_TYPE_BADGES } from '@/lib/constants';

export default function DailyScheduleTimetable({
  dailySchedules = {},
  workWeek,
  employees = [],
  clients = [],
}) {
  const staffIds = Object.keys(dailySchedules);

  // Extract all distinct dates in chronological order
  const allDatesSet = new Set();
  staffIds.forEach((empId) => {
    const days = dailySchedules[empId]?.days || {};
    Object.keys(days).forEach((d) => allDatesSet.add(d));
  });

  const sortedDates = Array.from(allDatesSet).sort();
  const [selectedDate, setSelectedDate] = useState(sortedDates[0] || '');

  if (staffIds.length === 0 || sortedDates.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
        <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-700">No Day-Wise Production Schedule Available</p>
        <p className="text-xs text-slate-500 mt-1">
          Run the allocation engine to generate the day-by-day deliverable distribution.
        </p>
      </div>
    );
  }

  const currentDate = selectedDate || sortedDates[0];

  return (
    <div className="space-y-4">
      {/* Day Selector Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100 rounded-2xl border border-slate-200">
        <span className="text-xs font-extrabold text-slate-700 uppercase px-3 py-1">
          Select Day:
        </span>
        {sortedDates.map((dateStr) => {
          const sampleDay = dailySchedules[staffIds[0]]?.days?.[dateStr];
          const dayName = sampleDay?.dayName || 'Working Day';
          const isSelected = dateStr === currentDate;

          // Calculate total items across all staff for this day
          let totalDayItems = 0;
          staffIds.forEach((empId) => {
            const day = dailySchedules[empId]?.days?.[dateStr];
            if (day) {
              totalDayItems += (day.posts || 0) + (day.reels || 0) + (day.stories || 0);
            }
          });

          return (
            <button
              type="button"
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>{dayName.toUpperCase()}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {dateStr}
              </span>
              {totalDayItems > 0 && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {totalDayItems} items
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Staff Schedule Cards for the Selected Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {staffIds.map((empId) => {
          const staffSchedule = dailySchedules[empId];
          const dayInfo = staffSchedule?.days?.[currentDate];
          if (!dayInfo) return null;

          const totalWorkCount = (dayInfo.posts || 0) + (dayInfo.reels || 0) + (dayInfo.stories || 0);
          const isOff = dayInfo.status === 'leave';

          return (
            <div
              key={empId}
              className={`p-5 rounded-2xl border transition-all ${
                isOff
                  ? 'bg-rose-50/50 border-rose-200 opacity-75'
                  : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Card Header: Staff Name & Role */}
              <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-xs border border-indigo-200">
                      {staffSchedule.employeeName?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">
                        {staffSchedule.employeeName}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-500 font-semibold">
                        {staffSchedule.employeeCode}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge role={staffSchedule.employeeRole} size="sm" />
                  {isOff ? (
                    <Badge variant="danger" size="sm">On Leave (0x)</Badge>
                  ) : dayInfo.status === 'half_day' ? (
                    <Badge variant="warning" size="sm">Half Day (0.5x)</Badge>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-bold">
                      Daily Quota: {staffSchedule.dailyCapacityUnits || 0} Units
                    </span>
                  )}
                </div>
              </div>

              {/* Day Output Totals Pill */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 mb-3 text-xs">
                <span className="font-bold text-slate-700">Scheduled Output:</span>
                <div className="flex items-center gap-2 font-extrabold">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    {dayInfo.posts || 0} Posts
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                    {dayInfo.reels || 0} Reels
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                    {dayInfo.stories || 0} Stories
                  </span>
                </div>
              </div>

              {/* Client Breakdown for this Date */}
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Client Tasks on {dayInfo.dayName}:
                </span>

                {(!dayInfo.clientTasks || dayInfo.clientTasks.length === 0 || totalWorkCount === 0) ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    {isOff ? 'Staff member is on leave on this date.' : 'No tasks scheduled for this day (Capacity available).'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {dayInfo.clientTasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs hover:bg-slate-100 transition-colors"
                      >
                        <span className="font-bold text-slate-900 truncate max-w-[180px]">
                          {t.clientName}
                        </span>
                        <div className="flex items-center gap-2 font-extrabold">
                          {t.posts > 0 && <span className="text-blue-700 font-bold">{t.posts}P</span>}
                          {t.reels > 0 && <span className="text-purple-700 font-bold">{t.reels}R</span>}
                          {t.stories > 0 && <span className="text-amber-700 font-bold">{t.stories}S</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
