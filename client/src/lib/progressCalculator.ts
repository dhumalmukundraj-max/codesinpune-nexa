/**
 * Centralized, Authoritative Project Completion Calculator (Client)
 * 
 * Guarantees 100% mathematical consistency with server/src/services/progressCalculator.ts.
 */

export interface TaskStatusItem {
  id?: string;
  title: string;
  status: 'completed' | 'in_progress' | 'pending' | 'suggested' | 'rejected' | string;
  isCompleted?: boolean;
}

export interface ProgressCalculationResult {
  completionPercentage: number;
  totalTasksIdentified: number;
  completedTasksCount: number;
  partialTasksCount: number;
  pendingTasksCount: number;
  calculationBasis: string;
  isProblemStatementSolved: boolean;
}

export class ProgressCalculator {
  static calculate(
    builtFunctionalities: Array<{ title: string; status?: string }> = [],
    unfinishedTasks: Array<TaskStatusItem> = [],
    fallbackPercentage: number = 0
  ): ProgressCalculationResult {
    let builtCompletedCount = 0;
    let builtPartialCount = 0;

    builtFunctionalities.forEach((fn) => {
      if (fn.status === 'partially_implemented') {
        builtPartialCount++;
      } else {
        builtCompletedCount++;
      }
    });

    let remCompletedCount = 0;
    let remInProgressCount = 0;
    let remPendingCount = 0;

    unfinishedTasks.forEach((t) => {
      if (t.status === 'rejected') return;

      if (t.status === 'completed' || t.isCompleted === true) {
        remCompletedCount++;
      } else if (t.status === 'in_progress') {
        remInProgressCount++;
      } else {
        remPendingCount++;
      }
    });

    const totalIdentified = builtFunctionalities.length + (unfinishedTasks.filter((t) => t.status !== 'rejected').length);

    if (totalIdentified === 0) {
      const clampedFallback = Math.min(100, Math.max(0, Math.round(Number(fallbackPercentage) || 0)));
      return {
        completionPercentage: clampedFallback,
        totalTasksIdentified: 0,
        completedTasksCount: 0,
        partialTasksCount: 0,
        pendingTasksCount: 0,
        calculationBasis: 'No tasks identified; fallback analysis baseline applied.',
        isProblemStatementSolved: clampedFallback === 100,
      };
    }

    const earnedWeight = (builtCompletedCount * 1.0) + (builtPartialCount * 0.5) + (remCompletedCount * 1.0) + (remInProgressCount * 0.5);
    const maxWeight = totalIdentified;

    const rawPercentage = (earnedWeight / maxWeight) * 100;
    const finalPercentage = Math.min(100, Math.max(0, Math.round(rawPercentage)));

    return {
      completionPercentage: finalPercentage,
      totalTasksIdentified: totalIdentified,
      completedTasksCount: builtCompletedCount + remCompletedCount,
      partialTasksCount: builtPartialCount + remInProgressCount,
      pendingTasksCount: remPendingCount,
      calculationBasis: `Calculated from ${builtFunctionalities.length} built features and ${unfinishedTasks.length} implementation tasks (${remCompletedCount} completed, ${remInProgressCount} in progress).`,
      isProblemStatementSolved: finalPercentage === 100,
    };
  }
}
