import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Plus, Edit3, X, Undo2, Info, AlertCircle } from 'lucide-react';

// Types
interface LeaveRules {
  date_window: { start: string; end: string };
  eligibility_filters?: { days_of_week?: number[] };
  quotas: {
    weekly?: { max_days: number };
    weeks_per_month?: { max_weeks: number };
    total?: { max_days: number };
  };
}

interface LeaveType {
  id: string;
  name: string;
  color: string;
  rules: LeaveRules;
  notes?: string;
}

interface Assignment {
  id: string;
  date: string;
  leaveTypeId: string;
  createdAt: string;
  updatedAt: string;
}

interface DayInfo {
  date: string;
  isCurrentMonth: boolean;
  assignment?: Assignment;
  eligibleLeaves: string[];
}

// Utility functions
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const parseDate = (dateStr: string): Date => {
  return new Date(dateStr + 'T00:00:00');
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as week start
  return new Date(d.setDate(diff));
};

const getWeekEnd = (date: Date): Date => {
  const start = getWeekStart(date);
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
};

const getMonthStart = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const getMonthEnd = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const isDateInRange = (date: string, start: string, end: string): boolean => {
  return date >= start && date <= end;
};

// Default leave types for seeding
const createSeedLeaveTypes = (): LeaveType[] => [
  {
    id: 'leave-1',
    name: 'Mother Leave',
    color: '#3B82F6',
    rules: {
      date_window: { start: '2025-07-03', end: '2025-08-02' },
      quotas: {
        weekly: { max_days: 1 },
        weeks_per_month: { max_weeks: 4 }
      }
    }
  },
  {
    id: 'leave-2',
    name: 'Therapy Sessions',
    color: '#10B981',
    rules: {
      date_window: { start: '2025-01-01', end: '2025-12-20' },
      quotas: {
        weekly: { max_days: 3 },
        weeks_per_month: { max_weeks: 2 }
      }
    }
  }
];

const createSeedAssignments = (leaveTypes: LeaveType[]): Assignment[] => {
  const assignments: Assignment[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Add a few random valid assignments for demo
  const sampleDates = [
    new Date(currentYear, currentMonth, 5),
    new Date(currentYear, currentMonth, 12),
    new Date(currentYear, currentMonth, 19),
  ];
  
  sampleDates.forEach((date, index) => {
    const dateStr = formatDate(date);
    const leaveType = leaveTypes[index % leaveTypes.length];
    
    // Only add if date is within leave's window
    if (isDateInRange(dateStr, leaveType.rules.date_window.start, leaveType.rules.date_window.end)) {
      assignments.push({
        id: `assignment-${index}`,
        date: dateStr,
        leaveTypeId: leaveType.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  });
  
  return assignments;
};

// Main App Component
export default function LeaveDaySelector() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showManageLeaves, setShowManageLeaves] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeaveType | null>(null);
  const [history, setHistory] = useState<Assignment[][]>([]);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Initialize data
  useEffect(() => {
    const savedLeaveTypes = localStorage.getItem('leaveTypes');
    const savedAssignments = localStorage.getItem('assignments');
    
    if (savedLeaveTypes && savedAssignments) {
      setLeaveTypes(JSON.parse(savedLeaveTypes));
      setAssignments(JSON.parse(savedAssignments));
    } else {
      // Seed with test data
      const seedLeaves = createSeedLeaveTypes();
      const seedAssignments = createSeedAssignments(seedLeaves);
      setLeaveTypes(seedLeaves);
      setAssignments(seedAssignments);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (leaveTypes.length > 0) {
      localStorage.setItem('leaveTypes', JSON.stringify(leaveTypes));
    }
  }, [leaveTypes]);

  useEffect(() => {
    localStorage.setItem('assignments', JSON.stringify(assignments));
  }, [assignments]);

  // Quota calculations
  const calculateQuotas = useCallback((leaveTypeId: string, targetDate?: string) => {
    const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
    if (!leaveType) return { used: {}, remaining: {} };

    const leaveAssignments = assignments.filter(a => a.leaveTypeId === leaveTypeId);
    const targetDateObj = targetDate ? parseDate(targetDate) : new Date();

    // Calculate weekly quotas
    const weekStart = getWeekStart(targetDateObj);
    const weekEnd = getWeekEnd(targetDateObj);
    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);
    
    const usedThisWeek = leaveAssignments.filter(a => 
      isDateInRange(a.date, weekStartStr, weekEndStr)
    ).length;

    // Calculate weeks per month (distinct weeks used in current month)
    const monthStart = getMonthStart(targetDateObj);
    const monthEnd = getMonthEnd(targetDateObj);
    const monthStartStr = formatDate(monthStart);
    const monthEndStr = formatDate(monthEnd);
    
    const monthlyAssignments = leaveAssignments.filter(a =>
      isDateInRange(a.date, monthStartStr, monthEndStr)
    );
    
    // Calculate distinct weeks used in this month
    const weeksUsedInMonth = new Set();
    monthlyAssignments.forEach(a => {
      const assignmentDate = parseDate(a.date);
      const weekStartOfAssignment = getWeekStart(assignmentDate);
      weeksUsedInMonth.add(formatDate(weekStartOfAssignment));
    });
    const weeksUsedThisMonth = weeksUsedInMonth.size;

    // Total usage
    const totalUsed = leaveAssignments.length;

    return {
      used: {
        weekly: usedThisWeek,
        weeksThisMonth: weeksUsedThisMonth,
        total: totalUsed
      },
      remaining: {
        weekly: (leaveType.rules.quotas.weekly?.max_days ?? Infinity) - usedThisWeek,
        weeksThisMonth: (leaveType.rules.quotas.weeks_per_month?.max_weeks ?? Infinity) - weeksUsedThisMonth,
        total: (leaveType.rules.quotas.total?.max_days ?? Infinity) - totalUsed
      }
    };
  }, [leaveTypes, assignments]);

  // Eligibility check
  const isLeaveEligibleForDate = useCallback((leaveTypeId: string, date: string): { eligible: boolean; reason?: string } => {
    const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
    if (!leaveType) return { eligible: false, reason: 'Leave type not found' };

    // Check if date is within window
    if (!isDateInRange(date, leaveType.rules.date_window.start, leaveType.rules.date_window.end)) {
      return { eligible: false, reason: 'Date outside leave window' };
    }

    // Check day of week filter
    if (leaveType.rules.eligibility_filters?.days_of_week) {
      const dateObj = parseDate(date);
      const dayOfWeek = dateObj.getDay();
      if (!leaveType.rules.eligibility_filters.days_of_week.includes(dayOfWeek)) {
        return { eligible: false, reason: 'Day of week not allowed' };
      }
    }

    // Check if date already has this leave assigned
    const existingAssignment = assignments.find(a => a.date === date && a.leaveTypeId === leaveTypeId);
    if (existingAssignment) {
      return { eligible: false, reason: 'Already assigned' };
    }

    // Check if date has any other leave (MVP: no overlaps)
    const dateHasAssignment = assignments.some(a => a.date === date);
    if (dateHasAssignment) {
      return { eligible: false, reason: 'Date already has another leave assigned' };
    }

    // Check quotas
    const quotas = calculateQuotas(leaveTypeId, date);

    if (leaveType.rules.quotas.weekly && quotas.remaining.weekly <= 0) {
      return { eligible: false, reason: 'Weekly quota exceeded' };
    }

    if (leaveType.rules.quotas.total && quotas.remaining.total <= 0) {
      return { eligible: false, reason: 'Total quota exceeded' };
    }

    // Check weeks per month limit
    if (leaveType.rules.quotas.weeks_per_month) {
      const targetDateObj = parseDate(date);
      const weekStartOfTarget = getWeekStart(targetDateObj);
      
      // Check if this would be a new week
      const monthStart = getMonthStart(targetDateObj);
      const monthEnd = getMonthEnd(targetDateObj);
      const monthStartStr = formatDate(monthStart);
      const monthEndStr = formatDate(monthEnd);
      
      const monthlyAssignments = assignments.filter(a =>
        a.leaveTypeId === leaveTypeId &&
        isDateInRange(a.date, monthStartStr, monthEndStr)
      );
      
      const weeksUsed = new Set();
      monthlyAssignments.forEach(a => {
        const assignmentDate = parseDate(a.date);
        const weekStart = getWeekStart(assignmentDate);
        weeksUsed.add(formatDate(weekStart));
      });
      
      const targetWeekStart = formatDate(weekStartOfTarget);
      const wouldBeNewWeek = !weeksUsed.has(targetWeekStart);
      
      if (wouldBeNewWeek && weeksUsed.size >= leaveType.rules.quotas.weeks_per_month.max_weeks) {
        return { eligible: false, reason: 'Monthly week limit exceeded' };
      }
    }

    return { eligible: true };
  }, [leaveTypes, assignments, calculateQuotas]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay() + 1); // Start from Monday

    const days: DayInfo[] = [];
    const currentDateForLoop = new Date(startDate);

    for (let i = 0; i < 42; i++) { // 6 weeks
      const dateStr = formatDate(currentDateForLoop);
      const isCurrentMonth = currentDateForLoop.getMonth() === month;
      const assignment = assignments.find(a => a.date === dateStr);
      const eligibleLeaves = leaveTypes
        .filter(lt => isLeaveEligibleForDate(lt.id, dateStr).eligible)
        .map(lt => lt.id);

      days.push({
        date: dateStr,
        isCurrentMonth,
        assignment,
        eligibleLeaves
      });

      currentDateForLoop.setDate(currentDateForLoop.getDate() + 1);
    }

    return days;
  }, [currentDate, assignments, leaveTypes, isLeaveEligibleForDate]);

  // Event handlers
  const addLeaveType = () => {
    const newLeave: LeaveType = {
      id: `leave-${Date.now()}`,
      name: `Leave ${leaveTypes.length + 1}`,
      color: '#6366F1',
      rules: {
        date_window: {
          start: formatDate(new Date()),
          end: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
        },
        quotas: {
          weekly: { max_days: 1 },
          weeks_per_month: { max_weeks: 2 }
        }
      }
    };
    setLeaveTypes([...leaveTypes, newLeave]);
    setEditingLeave(newLeave);
  };

  const updateLeaveType = (updatedLeave: LeaveType) => {
    setLeaveTypes(leaveTypes.map(lt => lt.id === updatedLeave.id ? updatedLeave : lt));
    setEditingLeave(null);
  };

  const deleteLeaveType = (leaveId: string) => {
    setLeaveTypes(leaveTypes.filter(lt => lt.id !== leaveId));
    setAssignments(assignments.filter(a => a.leaveTypeId !== leaveId));
  };

  const assignLeave = (date: string, leaveTypeId: string) => {
    const newAssignment: Assignment = {
      id: `assignment-${Date.now()}`,
      date,
      leaveTypeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setHistory([...history, assignments]);
    setAssignments([...assignments, newAssignment]);
    setSelectedDate(null);
  };

  const removeAssignment = (assignmentId: string) => {
    setHistory([...history, assignments]);
    setAssignments(assignments.filter(a => a.id !== assignmentId));
  };

  const undo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setAssignments(previousState);
      setHistory(history.slice(0, -1));
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-8 w-8" />
              <h1 className="text-2xl font-bold">Leave Day Selector</h1>
            </div>
            <div className="flex items-center space-x-4">
              {history.length > 0 && (
                <button
                  onClick={undo}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg transition-colors"
                >
                  <Undo2 className="h-4 w-4" />
                  <span>Undo</span>
                </button>
              )}
              <button
                onClick={() => setShowManageLeaves(!showManageLeaves)}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Manage Leaves</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex">
          {/* Leave Types Sidebar */}
          <div className="w-80 border-r bg-gray-50 p-6">
            <h2 className="text-lg font-semibold mb-4">Leave Types</h2>
            <div className="space-y-4">
              {leaveTypes.map(leaveType => {
                const quotas = calculateQuotas(leaveType.id);
                return (
                  <div key={leaveType.id} className="bg-white rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: leaveType.color }}
                        />
                        <span className="font-medium">{leaveType.name}</span>
                      </div>
                      <button
                        onClick={() => setEditingLeave(leaveType)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-sm space-y-1 text-gray-600">
                      {leaveType.rules.quotas.weekly && (
                        <div>Weekly: {quotas.used.weekly}/{leaveType.rules.quotas.weekly.max_days}</div>
                      )}
                      {leaveType.rules.quotas.weeks_per_month && (
                        <div>Weeks/Month: {quotas.used.weeksThisMonth}/{leaveType.rules.quotas.weeks_per_month.max_weeks}</div>
                      )}
                      {leaveType.rules.quotas.total && (
                        <div>Total: {quotas.used.total}/{leaveType.rules.quotas.total.max_days}</div>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={addLeaveType}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-600 hover:text-blue-600"
              >
                <Plus className="h-5 w-5 mx-auto mb-1" />
                Add Leave Type
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 p-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ←
                </button>
                <h2 className="text-xl font-semibold">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  →
                </button>
              </div>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                Today
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const leaveType = day.assignment ? leaveTypes.find(lt => lt.id === day.assignment?.leaveTypeId) : null;
                const isToday = day.date === formatDate(new Date());
                const isHovered = hoveredDate === day.date;
                
                return (
                  <div
                    key={index}
                    className={`
                      relative h-24 border rounded-lg cursor-pointer transition-all
                      ${day.isCurrentMonth ? 'bg-white hover:bg-blue-50' : 'bg-gray-100'}
                      ${isToday ? 'ring-2 ring-blue-500' : ''}
                      ${selectedDate === day.date ? 'ring-2 ring-blue-400' : ''}
                      ${isHovered && !day.assignment && day.eligibleLeaves.length > 0 ? 'ring-1 ring-green-300 bg-green-50' : ''}
                      ${isHovered && !day.assignment && day.eligibleLeaves.length === 0 ? 'ring-1 ring-red-300 bg-red-50' : ''}
                    `}
                    onClick={() => setSelectedDate(day.date)}
                    onMouseEnter={() => setHoveredDate(day.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                  >
                    <div className="p-2 h-full">
                      <div className={`text-sm ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                        {parseDate(day.date).getDate()}
                      </div>
                      
                      {day.assignment && leaveType && (
                        <div
                          className="mt-1 px-2 py-1 text-xs rounded-full text-white truncate"
                          style={{ backgroundColor: leaveType.color }}
                        >
                          {leaveType.name}
                        </div>
                      )}
                      
                      {/* Tooltip for hover - show available leaves */}
                      {isHovered && !day.assignment && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-20 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg border border-gray-700 min-w-max">
                          {day.eligibleLeaves.length > 0 ? (
                            <div>
                              <div className="font-medium mb-2 text-center text-green-400">Available Leaves:</div>
                              <div className="space-y-1">
                                {day.eligibleLeaves.map(id => {
                                  const leave = leaveTypes.find(lt => lt.id === id);
                                  return (
                                    <div key={id} className="flex items-center space-x-2">
                                      <div 
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: leave?.color }}
                                      />
                                      <span className="text-white">{leave?.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="text-xs text-gray-400 mt-2 text-center">Click to assign</div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <div className="font-medium mb-1 text-red-400">No Available Leaves</div>
                              <div className="text-xs text-gray-400">All quotas reached or date restricted</div>
                            </div>
                          )}
                          {/* Tooltip arrow */}
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Date Selection Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {parseDate(selectedDate).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const existingAssignment = assignments.find(a => a.date === selectedDate);
              const eligibleLeaves = leaveTypes.filter(lt => 
                isLeaveEligibleForDate(lt.id, selectedDate).eligible
              );

              if (existingAssignment) {
                const leaveType = leaveTypes.find(lt => lt.id === existingAssignment.leaveTypeId);
                return (
                  <div>
                    <div className="mb-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: leaveType?.color }}
                        />
                        <span className="font-medium">{leaveType?.name}</span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => removeAssignment(existingAssignment.id)}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Remove Leave
                      </button>
                    </div>
                  </div>
                );
              }

              if (eligibleLeaves.length === 0) {
                const reasons = leaveTypes.map(lt => ({
                  name: lt.name,
                  reason: isLeaveEligibleForDate(lt.id, selectedDate).reason
                })).filter(r => r.reason);

                return (
                  <div>
                    <div className="flex items-center space-x-2 text-orange-600 mb-3">
                      <AlertCircle className="h-5 w-5" />
                      <span>No eligible leaves for this date</span>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      {reasons.map((r, i) => (
                        <div key={i}>
                          <strong>{r.name}:</strong> {r.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              return (
                <div>
                  <p className="text-sm text-gray-600 mb-4">Select a leave type to assign:</p>
                  <div className="space-y-2">
                    {eligibleLeaves.map(leaveType => (
                      <button
                        key={leaveType.id}
                        onClick={() => assignLeave(selectedDate, leaveType.id)}
                        className="w-full flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: leaveType.color }}
                        />
                        <span>{leaveType.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Manage Leaves Modal */}
      {(showManageLeaves || editingLeave) && (
        <LeaveManagementModal
          leaveTypes={leaveTypes}
          editingLeave={editingLeave}
          onClose={() => {
            setShowManageLeaves(false);
            setEditingLeave(null);
          }}
          onSave={updateLeaveType}
          onDelete={deleteLeaveType}
          onAdd={addLeaveType}
        />
      )}
    </div>
  );
}

// Leave Management Modal Component
function LeaveManagementModal({ 
  leaveTypes, 
  editingLeave, 
  onClose, 
  onSave, 
  onDelete, 
  onAdd 
}: {
  leaveTypes: LeaveType[];
  editingLeave: LeaveType | null;
  onClose: () => void;
  onSave: (leave: LeaveType) => void;
  onDelete: (leaveId: string) => void;
  onAdd: () => void;
}) {
  const [formData, setFormData] = useState<LeaveType>(
    editingLeave || {
      id: '',
      name: '',
      color: '#3B82F6',
      rules: {
        date_window: { start: '', end: '' },
        quotas: {}
      }
    }
  );

  const handleSave = () => {
    if (formData.name && formData.rules.date_window.start && formData.rules.date_window.end) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {editingLeave ? 'Edit Leave Type' : 'Manage Leave Types'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {editingLeave ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 border rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.rules.date_window.start}
                  onChange={(e) => setFormData({
                    ...formData,
                    rules: {
                      ...formData.rules,
                      date_window: {
                        ...formData.rules.date_window,
                        start: e.target.value
                      }
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.rules.date_window.end}
                  onChange={(e) => setFormData({
                    ...formData,
                    rules: {
                      ...formData.rules,
                      date_window: {
                        ...formData.rules.date_window,
                        end: e.target.value
                      }
                    }
                  })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-3">Quotas</h3>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!!formData.rules.quotas.weekly}
                      onChange={(e) => {
                        const newQuotas = { ...formData.rules.quotas };
                        if (e.target.checked) {
                          newQuotas.weekly = { max_days: 1 };
                        } else {
                          delete newQuotas.weekly;
                        }
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, quotas: newQuotas }
                        });
                      }}
                    />
                    <span>Weekly Quota</span>
                  </label>
                  {formData.rules.quotas.weekly && (
                    <input
                      type="number"
                      min="1"
                      value={formData.rules.quotas.weekly.max_days}
                      onChange={(e) => setFormData({
                        ...formData,
                        rules: {
                          ...formData.rules,
                          quotas: {
                            ...formData.rules.quotas,
                            weekly: { max_days: parseInt(e.target.value) || 1 }
                          }
                        }
                      })}
                      className="w-20 px-2 py-1 border rounded"
                      placeholder="Days"
                    />
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!!formData.rules.quotas.weeks_per_month}
                      onChange={(e) => {
                        const newQuotas = { ...formData.rules.quotas };
                        if (e.target.checked) {
                          newQuotas.weeks_per_month = { max_weeks: 2 };
                        } else {
                          delete newQuotas.weeks_per_month;
                        }
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, quotas: newQuotas }
                        });
                      }}
                    />
                    <span>Max Weeks Per Month</span>
                  </label>
                  {formData.rules.quotas.weeks_per_month && (
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={formData.rules.quotas.weeks_per_month.max_weeks}
                      onChange={(e) => setFormData({
                        ...formData,
                        rules: {
                          ...formData.rules,
                          quotas: {
                            ...formData.rules.quotas,
                            weeks_per_month: { max_weeks: parseInt(e.target.value) || 1 }
                          }
                        }
                      })}
                      className="w-20 px-2 py-1 border rounded"
                      placeholder="Weeks"
                    />
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={!!formData.rules.quotas.total}
                      onChange={(e) => {
                        const newQuotas = { ...formData.rules.quotas };
                        if (e.target.checked) {
                          newQuotas.total = { max_days: 10 };
                        } else {
                          delete newQuotas.total;
                        }
                        setFormData({
                          ...formData,
                          rules: { ...formData.rules, quotas: newQuotas }
                        });
                      }}
                    />
                    <span>Total Quota</span>
                  </label>
                  {formData.rules.quotas.total && (
                    <input
                      type="number"
                      min="1"
                      value={formData.rules.quotas.total.max_days}
                      onChange={(e) => setFormData({
                        ...formData,
                        rules: {
                          ...formData.rules,
                          quotas: {
                            ...formData.rules.quotas,
                            total: { max_days: parseInt(e.target.value) || 1 }
                          }
                        }
                      })}
                      className="w-20 px-2 py-1 border rounded"
                      placeholder="Days"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={() => {
                  onDelete(formData.id);
                  onClose();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
              <div className="space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="space-y-4 mb-6">
              {leaveTypes.map(leaveType => (
                <div key={leaveType.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: leaveType.color }}
                    />
                    <span className="font-medium">{leaveType.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      setFormData(leaveType);
                    }}
                    className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
            
            <button
              onClick={onAdd}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-gray-600 hover:text-blue-600"
            >
              <Plus className="h-5 w-5 mx-auto mb-1" />
              Add New Leave Type
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
