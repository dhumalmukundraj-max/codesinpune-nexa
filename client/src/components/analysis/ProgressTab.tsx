import React, { useState, useEffect } from 'react';
import { ProgressMetrics, ProjectSummary } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart3, 
  Target, 
  RotateCcw, 
  FileCode, 
  Filter, 
  CheckSquare, 
  Square,
  Sparkles,
  Info
} from 'lucide-react';

interface ProgressTabProps {
  metrics: ProgressMetrics;
  summary?: ProjectSummary;
}

export const ProgressTab: React.FC<ProgressTabProps> = ({ metrics, summary }) => {
  const builtList = summary?.existingFunctionalities || [];
  const remainingList = summary?.unfinishedTasks || [];

  // Initialize interactive checklist state:
  // Built items start checked (true), remaining items start unchecked (false)
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const [filterView, setFilterView] = useState<'all' | 'built' | 'remaining'>('all');

  useEffect(() => {
    const initialMap: Record<string, boolean> = {};
    builtList.forEach((_, idx) => {
      initialMap[`built-${idx}`] = true;
    });
    remainingList.forEach((_, idx) => {
      initialMap[`rem-${idx}`] = false;
    });
    setCheckedMap(initialMap);
  }, [summary]);

  const toggleItem = (key: string) => {
    setCheckedMap((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleResetChecklist = () => {
    const resetMap: Record<string, boolean> = {};
    builtList.forEach((_, idx) => {
      resetMap[`built-${idx}`] = true;
    });
    remainingList.forEach((_, idx) => {
      resetMap[`rem-${idx}`] = false;
    });
    setCheckedMap(resetMap);
  };

  // Calculate live dynamic percentage based on checkboxes
  const totalTasks = builtList.length + remainingList.length;
  const checkedCount = Object.values(checkedMap).filter(Boolean).length;
  
  const percentage = totalTasks > 0
    ? Math.round((checkedCount / totalTasks) * 100)
    : Math.min(Math.max(metrics?.completionPercentage || 0, 0), 100);

  const isCompleted100 = percentage === 100;
  const problemStatement = metrics?.problemStatement || 
    summary?.introduction?.description || 
    summary?.introduction?.tagline || 
    'Core problem statement and desired output of this software project.';

  return (
    <div className="space-y-8">
      {/* 1. Core Problem Statement & Completion Card */}
      <div className="bg-white rounded-3xl border border-brand-border p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-brand-border">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-secondary/30 text-brand-dark text-[11px] font-bold uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-brand-primary" />
              <span>Core Problem Statement Evaluation</span>
            </div>
            <h2 className="text-2xl font-black text-brand-dark tracking-tight">
              Project Completion Metric
            </h2>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-brand-primary tracking-tight">
              {percentage}%
            </span>
            <span className="text-xs font-semibold text-brand-muted uppercase">Complete</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-4 bg-stone-100 rounded-full overflow-hidden p-0.5 border border-brand-border flex">
            <div
              style={{ width: `${percentage}%` }}
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted100 ? 'bg-emerald-600' : 'bg-brand-primary'
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-brand-muted pt-1">
            <span>0% (Initial Setup)</span>
            <span>50% (Core Functionality in Progress)</span>
            <span className="font-semibold text-emerald-700">100% (Problem Statement Solved)</span>
          </div>
        </div>

        {/* Problem Statement Assessment Box */}
        <div className="p-5 rounded-2xl bg-[#FAF7F2] border border-brand-border space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-brand-primary" />
                <strong className="text-xs font-bold text-brand-dark uppercase tracking-wide">
                  Main Problem Statement & Desired Output
                </strong>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                {problemStatement}
              </p>
            </div>

            <div className="flex-shrink-0">
              {isCompleted100 ? (
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Problem Statement 100% Solved</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>In Progress ({percentage}% Solved)</span>
                </span>
              )}
            </div>
          </div>

          {/* Basis Explanation Note */}
          <div className="pt-3 border-t border-brand-border/60 flex items-start gap-2 text-[11px] text-stone-600">
            <Info className="w-4 h-4 text-brand-muted mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">
              <strong>Calculation Basis:</strong> Evaluated strictly on whether the code solves the main problem statement and produces the desired output. Future implementations or optional roadmap items that users might add later are <strong>never</strong> calculated against completion percentage.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Interactive Implementation Checklists (Built vs Remaining) */}
      <div className="bg-white rounded-3xl border border-brand-border p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
          <div>
            <h3 className="text-lg font-black text-brand-dark tracking-tight">
              Implementation Breakdown & Verification Checklist
            </h3>
            <p className="text-xs text-brand-muted mt-0.5">
              Interactive checklist showing what is currently built till now vs what is remaining to reach 100%.
            </p>
          </div>

          {/* Filter & Reset Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-stone-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterView('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  filterView === 'all'
                    ? 'bg-white text-brand-dark shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                All ({totalTasks})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('built')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  filterView === 'built'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Built ({builtList.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterView('remaining')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1 ${
                  filterView === 'remaining'
                    ? 'bg-white text-brand-primary shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <AlertCircle className="w-3 h-3 text-brand-primary" />
                <span>Remaining ({remainingList.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetChecklist}
              title="Reset checklist to original AI analysis"
              className="p-2 rounded-xl border border-brand-border text-stone-500 hover:text-brand-dark hover:bg-stone-50 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section A: Currently Built Implementations */}
        {(filterView === 'all' || filterView === 'built') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h4 className="text-sm font-bold text-brand-dark">
                  Implementations Currently Built Till Now ({builtList.length})
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Verified in Codebase
              </span>
            </div>

            {builtList.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500 bg-stone-50 rounded-2xl border border-brand-border">
                No verified functional implementations discovered in the codebase yet.
              </div>
            ) : (
              <div className="space-y-3">
                {builtList.map((item, idx) => {
                  const key = `built-${idx}`;
                  const isChecked = checkedMap[key] ?? true;

                  return (
                    <div
                      key={key}
                      onClick={() => toggleItem(key)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                        isChecked
                          ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                          : 'bg-white border-stone-200 hover:border-stone-300 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(key)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer mt-1"
                      />

                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className={`text-xs font-bold ${isChecked ? 'text-emerald-950 font-semibold' : 'text-stone-700'}`}>
                            {item.title}
                          </h5>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex-shrink-0">
                            {item.status === 'fully_implemented' ? 'Fully Built' : 'Partially Built'}
                          </span>
                        </div>

                        <p className="text-xs text-stone-600 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Files Involved */}
                        {item.filesInvolved && item.filesInvolved.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] font-medium text-stone-400">Files:</span>
                            {item.filesInvolved.map((file, fIdx) => (
                              <span
                                key={fIdx}
                                className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-stone-200 text-stone-700"
                              >
                                <FileCode className="w-3 h-3 text-stone-400" />
                                <span>{file}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Section B: Remaining Implementations */}
        {(filterView === 'all' || filterView === 'remaining') && (
          <div className="space-y-4 pt-4 border-t border-brand-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h4 className="text-sm font-bold text-brand-dark">
                  Remaining Implementations Needed for 100% ({remainingList.length})
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Pending Work
              </span>
            </div>

            {remainingList.length === 0 ? (
              <div className="p-6 text-center text-xs text-emerald-800 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Zero pending tasks! The core problem statement is completely solved.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {remainingList.map((item, idx) => {
                  const key = `rem-${idx}`;
                  const isChecked = checkedMap[key] ?? false;

                  return (
                    <div
                      key={key}
                      onClick={() => toggleItem(key)}
                      className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3.5 ${
                        isChecked
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(key)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer mt-1"
                      />

                      <div className="flex-1 space-y-1.5 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className={`text-xs font-bold ${isChecked ? 'text-emerald-900 line-through' : 'text-stone-900'}`}>
                            {item.title}
                          </h5>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.priority && (
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  item.priority === 'high'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.priority} Priority
                              </span>
                            )}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                              {item.type}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-stone-600 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Location */}
                        {item.location && (
                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-stone-500 bg-white px-2 py-0.5 rounded border border-stone-200">
                              <FileCode className="w-3 h-3 text-stone-400" />
                              <span>{item.location}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
