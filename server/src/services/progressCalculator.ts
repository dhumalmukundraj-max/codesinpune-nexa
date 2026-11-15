/**
 * Centralized, Authoritative Project Completion Calculator
 * 
 * Used uniformly across the backend and frontend to guarantee 100% mathematical
 * consistency between the Main Project Dashboard and the Project Progress Tab.
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
  /**
   * Computes the authoritative project completion percentage.
   *
   * Formula:
   *  - Verified built functionalities (existingFunctionalities) have status = 'fully_implemented' (weight 1.0)
   *    or 'partially_implemented' (weight 0.5).
   *  - Remaining tasks (unfinishedTasks / project_tasks):
   *      - 'completed' / checked: weight 1.0
   *      - 'in_progress': weight 0.5
   *      - 'pending' / 'suggested': weight 0.0
   *      - 'rejected': excluded from denominator if explicitly rejected
   *
   * Total Weight = Built Items Weight + Remaining Items Weight
   * Denominator = Total Active Tasks Count
   * Percentage = Math.round((CompletedWeight / Denominator) * 100)
   */
  static calculate(
    builtFunctionalities: Array<{ title: string; status?: string }> = [],
    unfinishedTasks: Array<TaskStatusItem> = [],
    fallbackPercentage: number = 0
  ): ProgressCalculationResult {
    // 1. Built functionalities
    let builtCompletedCount = 0;
    let builtPartialCount = 0;

    builtFunctionalities.forEach((fn) => {
      if (fn.status === 'partially_implemented') {
        builtPartialCount++;
      } else {
        builtCompletedCount++;
      }
    });

    // 2. Unfinished tasks
    let remCompletedCount = 0;
    let remInProgressCount = 0;
    let remPendingCount = 0;

    unfinishedTasks.forEach((t) => {
      if (t.status === 'rejected') return; // Exclude rejected suggestions

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

    // Weighted completion: 1.0 for completed, 0.5 for in_progress / partially implemented
    const earnedWeight = (builtCompletedCount * 1.0) + (builtPartialCount * 0.5) + (remCompletedCount * 1.0) + (remInProgressCount * 0.5);
    const maxWeight = totalIdentified;

    const rawPercentage = (earnedWeight / maxWeight) * 100;
    const finalPercentage = Math.min(100, Math.max(0, Math.round(rawPercentage)));

    const isProblemStatementSolved = finalPercentage === 100;

    return {
      completionPercentage: finalPercentage,
      totalTasksIdentified: totalIdentified,
      completedTasksCount: builtCompletedCount + remCompletedCount,
      partialTasksCount: builtPartialCount + remInProgressCount,
      pendingTasksCount: remPendingCount,
      calculationBasis: `Calculated from ${builtFunctionalities.length} built features and ${unfinishedTasks.length} implementation tasks (${remCompletedCount} completed, ${remInProgressCount} in progress).`,
      isProblemStatementSolved,
    };
  }
}
