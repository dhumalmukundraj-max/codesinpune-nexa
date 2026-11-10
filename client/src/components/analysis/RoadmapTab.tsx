import React from 'react';
import { RoadmapModel } from '../../types';
import { Milestone, CheckCircle2, Clock, ArrowRight, GitCommit, ListOrdered } from 'lucide-react';

interface RoadmapTabProps {
  roadmap: RoadmapModel;
}

export const RoadmapTab: React.FC<RoadmapTabProps> = ({ roadmap }) => {
  const phases = roadmap?.phases || [];
  const recommendedSequence = roadmap?.recommendedSequence || [];
  const immediateNextSteps = roadmap?.immediateNextSteps || [];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Immediate Next Steps Banner */}
      {immediateNextSteps.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
            <ArrowRight className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-dark">Priority Next Steps</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {immediateNextSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-brand-primary/20 bg-brand-primary-light/40"
              >
                <div className="w-6 h-6 rounded-lg bg-brand-primary text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-stone-900 leading-relaxed font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Development Roadmap Timeline / Phases */}
      <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-6 border-b border-brand-border">
          <div className="flex items-center gap-2">
            <Milestone className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-dark">Development Phases & Milestones</h3>
          </div>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-secondary/30 text-brand-dark font-medium">
            Architecture-Respecting Plan
          </span>
        </div>

        {phases.length === 0 ? (
          <p className="text-xs text-brand-muted italic">No roadmap phases identified for this project.</p>
        ) : (
          <div className="space-y-6">
            {phases.map((phase, pIdx) => {
              const isCompleted = phase.status === 'completed';
              const isInProgress = phase.status === 'in_progress';

              return (
                <div
                  key={phase.id || pIdx}
                  className={`p-5 rounded-2xl border transition ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isInProgress
                      ? 'border-blue-200 bg-blue-50/20'
                      : 'border-brand-border bg-white'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-stone-200/60">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isInProgress
                            ? 'bg-blue-600 text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {phase.sequenceOrder || pIdx + 1}
                      </div>
                      <h4 className="text-sm font-bold text-brand-dark">{phase.name}</h4>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider self-start sm:self-auto ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : isInProgress
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {phase.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {phase.tasks?.map((task, tIdx) => {
                      const taskDone = task.status === 'completed';
                      const taskProg = task.status === 'in_progress';

                      return (
                        <div
                          key={tIdx}
                          className="p-3 rounded-xl border border-stone-200 bg-white/90 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {taskDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-stone-400 flex-shrink-0" />
                              )}
                              <span className="text-xs font-bold text-stone-900">{task.title}</span>
                            </div>
                            <p className="text-[11px] text-stone-600 leading-relaxed ml-6">
                              {task.description}
                            </p>
                          </div>

                          {task.dependencies && task.dependencies.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-stone-100 flex items-center gap-1.5 ml-6">
                              <span className="text-[10px] text-stone-400 uppercase font-semibold">Depends on:</span>
                              <div className="flex flex-wrap gap-1">
                                {task.dependencies.map((dep, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-600"
                                  >
                                    {dep}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Recommended Development Sequence */}
      {recommendedSequence.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-border p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
            <ListOrdered className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-dark">Recommended Development Sequence</h3>
          </div>

          <div className="space-y-2">
            {recommendedSequence.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-brand-bg/50 border border-brand-border text-xs text-brand-dark">
                <span className="font-mono font-bold text-brand-primary px-2 py-0.5 rounded bg-brand-primary-light">
                  0{idx + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

