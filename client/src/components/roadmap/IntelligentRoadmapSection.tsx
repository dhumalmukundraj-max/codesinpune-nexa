import React, { useState, useEffect, useMemo } from 'react';
import {
  ListChecks,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  User,
  FileCode,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  X,
  Filter,
  CheckSquare,
  Square,
  GitCommit,
  ShieldAlert,
  Edit2,
  Trash2
} from 'lucide-react';
import {
  fetchProjectTasks,
  generateProjectTasks,
  updateProjectTask,
  deleteProjectTask,
} from '../../lib/api';
import { ProjectTask, RoadmapPhaseGroup } from '../../types';

interface IntelligentRoadmapSectionProps {
  projectId: string;
  projectName: string;
}

export const IntelligentRoadmapSection: React.FC<IntelligentRoadmapSectionProps> = ({
  projectId,
  projectName,
}) => {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [phases, setPhases] = useState<RoadmapPhaseGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [selectedPhase, setSelectedPhase] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedGapType, setSelectedGapType] = useState<string>('all');

  // Expanded task cards for detail view
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Edit Task Modal State
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);

  // Load Tasks
  const loadTasks = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchProjectTasks(projectId);
      if (res.tasks) {
        setTasks(res.tasks);
        setPhases(res.phases || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load project roadmap tasks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  // Handle Refresh AI Recommendations
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await generateProjectTasks(projectId);
      if (res.tasks) {
        setTasks(res.tasks);
        setPhases(res.phases || []);
        setSuccessMessage('AI Roadmap & Task Recommendations updated with latest code gap analysis.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate recommendations.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Status Change Quick Action
  const handleStatusChange = async (task: ProjectTask, newStatus: ProjectTask['status']) => {
    try {
      const res = await updateProjectTask(projectId, task.id, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      if (res.phases) setPhases(res.phases);
      setSuccessMessage(`Task "${task.title}" marked as ${newStatus.replace('_', ' ')}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task status.');
    }
  };

  // Handle Delete / Dismiss Task
  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to dismiss task "${title}"?`)) return;

    try {
      const res = await deleteProjectTask(projectId, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (res.phases) setPhases(res.phases);
      setSuccessMessage('Task dismissed.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove task.');
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const res = await updateProjectTask(projectId, editingTask.id, editingTask);
      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? editingTask : t)));
      if (res.phases) setPhases(res.phases);
      setEditingTask(null);
      setSuccessMessage('Task updated successfully.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task.');
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedPhase !== 'all' && t.phase !== selectedPhase) return false;
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false;
      if (selectedStatus !== 'all' && t.status !== selectedStatus) return false;
      if (selectedGapType !== 'all' && t.gap_type !== selectedGapType) return false;
      return true;
    });
  }, [tasks, selectedPhase, selectedPriority, selectedStatus, selectedGapType]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const critical = tasks.filter((t) => t.priority === 'critical').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, critical, percentage };
  }, [tasks]);

  const priorityBadge = (priority: ProjectTask['priority']) => {
    switch (priority) {
      case 'critical':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-red-100 text-red-800 border border-red-200">Critical</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-amber-100 text-amber-800 border border-amber-200">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-100 text-blue-800 border border-blue-200">Medium</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-stone-100 text-stone-700 border border-stone-200">Low</span>;
    }
  };

  const gapTypeBadge = (gapType: ProjectTask['gap_type']) => {
    const labels: Record<string, string> = {
      incomplete_functionality: 'Incomplete Feature',
      unfinished_task: 'TODO / Stub',
      missing_validation: 'Validation Gap',
      missing_test: 'Missing Test',
      documentation_gap: 'Docs Gap',
      technical_debt: 'Technical Debt',
    };
    return (
      <span className="text-[10px] font-semibold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
        {labels[gapType] || gapType}
      </span>
    );
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <RefreshCw className="w-8 h-8 text-[#C1121F] animate-spin mb-3" />
        <p className="text-stone-700 font-semibold">Analyzing Codebase Gaps & Constructing Roadmap...</p>
        <p className="text-xs text-stone-500 mt-1">Detecting unfinished features, missing validation, TODOs, and assigning ownership.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Notice</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-500 hover:text-red-700 font-bold ml-2">×</button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Success</p>
            <p className="mt-0.5">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700 font-bold ml-2">×</button>
        </div>
      )}

      {/* Top Header Card & Progress Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-red-50 text-[#C1121F] rounded-xl border border-red-100">
                <ListChecks className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-stone-900">Intelligent Roadmap & Actionable Tasks</h3>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Autonomous gap detection from repository code AST, incomplete functions, and TODOs organized into 4 execution phases.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Re-analyzing Gaps...' : 'Refresh AI Task Suggestions'}
          </button>
        </div>

        {/* Milestone Progress Bar */}
        <div className="pt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-stone-700">Overall Milestone Execution Progress</span>
            <span className="text-stone-900 font-mono font-bold">{stats.percentage}% Completed</span>
          </div>
          <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200 flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
              title={`Completed: ${stats.completed}`}
            />
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
              title={`In Progress: ${stats.inProgress}`}
            />
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Total Tasks</span>
              <p className="text-lg font-bold text-stone-900 mt-0.5">{stats.total}</p>
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Completed</span>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">{stats.completed}</p>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">In Progress</span>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{stats.inProgress}</p>
            </div>
            <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-center">
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Critical Gaps</span>
              <p className="text-lg font-bold text-red-700 mt-0.5">{stats.critical}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Phases Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {phases.map((phase, idx) => {
          const isSelected = selectedPhase === phase.name;
          return (
            <button
              key={idx}
              onClick={() => setSelectedPhase(isSelected ? 'all' : phase.name)}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-amber-400' : 'text-[#C1121F]'}`}>
                  Phase {idx + 1}
                </span>
                <span className={`text-[11px] font-mono font-semibold ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                  {phase.completedCount}/{phase.totalCount}
                </span>
              </div>
              <h4 className="text-xs font-bold mt-1 truncate" title={phase.name}>
                {phase.name.split(':')[1]?.trim() || phase.name}
              </h4>
              <div className="w-full h-1.5 bg-stone-200/60 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${phase.progressPercentage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Filters Bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-stone-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          {/* Phase Filter Reset */}
          {selectedPhase !== 'all' && (
            <button
              onClick={() => setSelectedPhase('all')}
              className="inline-flex items-center gap-1 bg-[#C1121F]/10 text-[#C1121F] px-2.5 py-1 rounded-full font-semibold"
            >
              Phase: {selectedPhase.split(':')[0]} <X className="w-3 h-3" />
            </button>
          )}

          {/* Priority Select */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-stone-700 font-medium focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status Select */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-stone-700 font-medium focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="suggested">AI Suggested</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Gap Type Select */}
          <select
            value={selectedGapType}
            onChange={(e) => setSelectedGapType(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-stone-700 font-medium focus:outline-none"
          >
            <option value="all">All Gap Categories</option>
            <option value="incomplete_functionality">Incomplete Features</option>
            <option value="unfinished_task">TODOs / Stubs</option>
            <option value="missing_validation">Missing Validation</option>
            <option value="missing_test">Missing Tests</option>
            <option value="documentation_gap">Docs Gaps</option>
            <option value="technical_debt">Technical Debt</option>
          </select>
        </div>

        <span className="text-stone-500 font-semibold text-[11px]">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </span>
      </div>

      {/* Task Cards List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-stone-500 text-sm">
          No tasks match the active filters. Adjust your filters or click "Refresh AI Task Suggestions".
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const isDone = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all shadow-sm ${
                  isDone ? 'border-stone-200 bg-stone-50/50 opacity-80' : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left Side: Checkbox & Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleStatusChange(task, isDone ? 'pending' : 'completed')}
                      className="mt-0.5 text-stone-400 hover:text-emerald-600 transition-colors shrink-0"
                      title={isDone ? 'Mark as incomplete' : 'Mark as completed'}
                    >
                      {isDone ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-stone-400" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {priorityBadge(task.priority)}
                        {gapTypeBadge(task.gap_type)}
                        <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                          {task.phase.split(':')[0]}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            task.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : task.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>

                      <h4
                        className={`text-sm font-bold text-stone-900 cursor-pointer hover:text-[#C1121F] transition-colors ${
                          isDone ? 'line-through text-stone-500' : ''
                        }`}
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      >
                        {task.title}
                      </h4>

                      <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>

                      {/* Evidence & Ownership Pill */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500 mt-2.5">
                        <span className="flex items-center gap-1 text-stone-700 font-medium">
                          <User className="w-3.5 h-3.5 text-stone-400" />
                          Owner: <span className="font-semibold">{task.suggested_owner}</span>
                        </span>

                        {task.source_file_references && task.source_file_references.length > 0 && (
                          <span className="flex items-center gap-1 text-stone-600 font-mono text-[10px] bg-stone-100 px-2 py-0.5 rounded truncate max-w-xs">
                            <FileCode className="w-3 h-3 text-stone-400 shrink-0" />
                            {task.source_file_references[0]}
                            {task.source_file_references.length > 1 && ` (+${task.source_file_references.length - 1})`}
                          </span>
                        )}

                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <Sparkles className="w-3 h-3 text-emerald-600" /> Verified Code Gap
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                    <button
                      onClick={() => setEditingTask(task)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Edit task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Dismiss task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                      title="Toggle details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-4 text-xs">
                    {/* Reason & Priority Rationale */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="font-bold text-stone-800 uppercase tracking-wider text-[10px] mb-1">
                          Why this task is needed:
                        </p>
                        <p className="text-stone-600 leading-relaxed">{task.reason}</p>
                      </div>

                      <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="font-bold text-stone-800 uppercase tracking-wider text-[10px] mb-1">
                          Priority Rationale & Complexity:
                        </p>
                        <p className="text-stone-600 leading-relaxed">
                          {task.priority_reason || `Classified as ${task.priority} priority with ${task.complexity} complexity.`}
                        </p>
                      </div>
                    </div>

                    {/* Step-by-Step Implementation Steps */}
                    {task.implementation_steps && task.implementation_steps.length > 0 && (
                      <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-100">
                        <p className="font-bold text-stone-800 uppercase tracking-wider text-[10px] mb-2">
                          Concrete Implementation Steps:
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 text-stone-700">
                          {task.implementation_steps.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Expected Outcome */}
                    {task.expected_outcome && (
                      <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                        <p className="font-bold text-emerald-800 uppercase tracking-wider text-[10px] mb-1">
                          Expected Verifiable Outcome:
                        </p>
                        <p className="text-emerald-900 leading-relaxed">{task.expected_outcome}</p>
                      </div>
                    )}

                    {/* File References & Supporting Evidence */}
                    {task.supporting_evidence && (
                      <div className="p-3 bg-stone-900 text-stone-200 rounded-xl font-mono text-[11px] space-y-1">
                        <p className="text-stone-400 font-sans uppercase font-bold text-[10px]">
                          Supporting Code Evidence:
                        </p>
                        <p className="text-amber-300">{task.supporting_evidence}</p>
                      </div>
                    )}

                    {/* Quick Status Control Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-stone-500 font-semibold">Change status:</span>
                        <button
                          onClick={() => handleStatusChange(task, 'pending')}
                          className={`px-3 py-1 rounded-lg border font-medium ${
                            task.status === 'pending'
                              ? 'bg-stone-800 text-white border-stone-800'
                              : 'bg-white text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => handleStatusChange(task, 'in_progress')}
                          className={`px-3 py-1 rounded-lg border font-medium ${
                            task.status === 'in_progress'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-stone-600 hover:bg-amber-50'
                          }`}
                        >
                          In Progress
                        </button>
                        <button
                          onClick={() => handleStatusChange(task, 'completed')}
                          className={`px-3 py-1 rounded-lg border font-medium ${
                            task.status === 'completed'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-stone-600 hover:bg-emerald-50'
                          }`}
                        >
                          Completed
                        </button>
                      </div>

                      {task.status === 'suggested' && (
                        <button
                          onClick={() => handleStatusChange(task, 'pending')}
                          className="px-4 py-1.5 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-lg font-semibold shadow-sm transition-all"
                        >
                          Accept AI Suggestion
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <h3 className="text-lg font-bold text-stone-900">Edit Task Details</h3>
              <button
                onClick={() => setEditingTask(null)}
                className="text-stone-400 hover:text-stone-700 font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#C1121F]/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Assigned Owner
                  </label>
                  <input
                    type="text"
                    value={editingTask.suggested_owner}
                    onChange={(e) => setEditingTask({ ...editingTask, suggested_owner: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  >
                    <option value="suggested">AI Suggested</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 uppercase tracking-wider mb-1">
                    Phase
                  </label>
                  <select
                    value={editingTask.phase}
                    onChange={(e) => setEditingTask({ ...editingTask, phase: e.target.value as any })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none"
                  >
                    {phases.length > 0 ? (
                      phases.map((p) => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="Phase 1: Critical Stabilizations & Core Stubs">Phase 1: Critical Stabilizations & Core Stubs</option>
                        <option value="Phase 2: Feature Completion & Integration">Phase 2: Feature Completion & Integration</option>
                        <option value="Phase 3: Error Boundaries, Validation & Security">Phase 3: Error Boundaries, Validation & Security</option>
                        <option value="Phase 4: Optimization, Documentation & Handover">Phase 4: Optimization, Documentation & Handover</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C1121F] hover:bg-[#9B0E19] text-white rounded-xl font-semibold shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

