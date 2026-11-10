import React from 'react';
import { 
  ProjectSummary 
} from '../../types';
import { 
  CheckCircle2, 
  HelpCircle, 
  FileCode, 
  Terminal, 
  Server, 
  AlertTriangle, 
  BookOpen, 
  Layers, 
  Cpu, 
  ListChecks, 
  Clock, 
  PackageCheck,
  MessagesSquare,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

interface SummaryTabProps {
  summary: ProjectSummary;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ summary }) => {
  const intro = summary.introduction || {};
  const decisions = summary.decisions || [];
  const techDocs = summary.technicalDocumentation || {};
  const functionalities = summary.existingFunctionalities || [];
  const unfinished = summary.unfinishedTasks || [];
  const dependencies = summary.dependencies || [];
  const discussions = summary.discussionsAndCommunications || {};
  const futurePlans = summary.futurePlansAndActions || [];
  const missingInfo = summary.missingOrContradictoryInformation || [];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Project Introduction & Fact Grounding */}
      <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-brand-border">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-brand-dark">{intro.name || 'Project Knowledge Base'}</h2>
              {intro.architectureStyle && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-secondary/40 font-medium text-brand-dark">
                  {intro.architectureStyle}
                </span>
              )}
            </div>
            {intro.tagline && <p className="text-xs text-brand-muted mt-1">{intro.tagline}</p>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {intro.primaryLanguages?.map((lang, idx) => (
              <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-stone-100 font-mono text-stone-800 border border-stone-200">
                {lang}
              </span>
            ))}
            {intro.frameworks?.map((fw, idx) => (
              <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-brand-primary border border-red-100 font-medium">
                {fw}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm text-stone-700 leading-relaxed mt-4">
          {intro.description || 'No project description reconstructed.'}
        </p>

        {/* Fact Distinctions: Verified Facts, AI Inferences, Unknowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Verified Facts */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Verified Facts ({intro.verifiedFacts?.length || 0})</span>
            </div>
            <ul className="text-xs text-emerald-950 space-y-1.5 list-disc list-inside">
              {intro.verifiedFacts?.length ? (
                intro.verifiedFacts.map((fact, idx) => <li key={idx}>{fact}</li>)
              ) : (
                <li className="text-stone-400 italic">No verified facts recorded</li>
              )}
            </ul>
          </div>

          {/* AI Inferences */}
          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200">
            <div className="flex items-center gap-2 text-sky-800 font-semibold text-xs mb-2">
              <Cpu className="w-4 h-4 text-sky-600" />
              <span>AI Inferences ({intro.aiInferences?.length || 0})</span>
            </div>
            <ul className="text-xs text-sky-950 space-y-1.5 list-disc list-inside">
              {intro.aiInferences?.length ? (
                intro.aiInferences.map((inf, idx) => <li key={idx}>{inf}</li>)
              ) : (
                <li className="text-stone-400 italic">No AI inferences recorded</li>
              )}
            </ul>
          </div>

          {/* Unknown Information */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-2">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>Unknown / Missing ({intro.unknowns?.length || 0})</span>
            </div>
            <ul className="text-xs text-amber-950 space-y-1.5 list-disc list-inside">
              {intro.unknowns?.length ? (
                intro.unknowns.map((un, idx) => <li key={idx}>{un}</li>)
              ) : (
                <li className="text-stone-400 italic">No unknown areas flagged</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Important Project Decisions */}
      <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
          <ShieldCheck className="w-5 h-5 text-brand-primary" />
          <h3 className="text-base font-bold text-brand-dark">Important Project Decisions</h3>
        </div>

        {decisions.length === 0 ? (
          <p className="text-xs text-brand-muted italic">No explicit project decisions inferred from codebase evidence.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {decisions.map((dec, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-brand-border bg-brand-bg/30">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-brand-dark">{dec.topic}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      dec.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : dec.status === 'inferred'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {dec.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed mb-2">{dec.decision}</p>
                {dec.evidenceFile && (
                  <div className="flex items-center gap-1 text-[11px] text-brand-muted font-mono">
                    <FileCode className="w-3 h-3 text-brand-primary" />
                    <span className="truncate">{dec.evidenceFile}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Existing Functionalities vs Unfinished Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Existing Functionalities */}
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-brand-dark">Existing Functionalities</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              {functionalities.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {functionalities.length === 0 ? (
              <p className="text-xs text-brand-muted italic">No working functionalities verified.</p>
            ) : (
              functionalities.map((fn, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-brand-border bg-emerald-50/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-stone-900">{fn.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        fn.status === 'fully_implemented'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {fn.status === 'fully_implemented' ? 'Fully Implemented' : 'Partial'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 mb-2 leading-relaxed">{fn.description}</p>
                  {fn.filesInvolved?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {fn.filesInvolved.map((f, i) => (
                        <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unfinished Tasks */}
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-primary" />
              <h3 className="text-base font-bold text-brand-dark">Unfinished Tasks & Stubs</h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-brand-primary font-semibold">
              {unfinished.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {unfinished.length === 0 ? (
              <p className="text-xs text-brand-muted italic">No unfinished tasks or TODOs detected in code.</p>
            ) : (
              unfinished.map((task, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-brand-border bg-red-50/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-stone-900">{task.title}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-200 text-stone-800 font-semibold">
                        {task.type}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          task.priority === 'high'
                            ? 'bg-red-600 text-white'
                            : task.priority === 'medium'
                            ? 'bg-amber-500 text-white'
                            : 'bg-stone-300 text-stone-800'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-stone-600 mb-2 leading-relaxed">{task.description}</p>
                  {task.location && (
                    <div className="text-[11px] font-mono text-brand-primary truncate">
                      📍 {task.location}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Technical Documentation (Setup, Env, Scripts, API) */}
      <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
          <BookOpen className="w-5 h-5 text-brand-primary" />
          <h3 className="text-base font-bold text-brand-dark">Technical Documentation</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Setup Instructions */}
          <div>
            <h4 className="text-xs font-bold uppercase text-brand-muted tracking-wider mb-2">
              Setup Instructions
            </h4>
            <div className="space-y-1.5">
              {techDocs.setupInstructions?.length ? (
                techDocs.setupInstructions.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-stone-700 bg-brand-bg/40 p-2 rounded-lg">
                    <span className="w-4 h-4 rounded-full bg-brand-secondary/50 text-brand-dark font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-brand-muted italic">No setup steps extracted.</p>
              )}
            </div>
          </div>

          {/* Scripts */}
          <div>
            <h4 className="text-xs font-bold uppercase text-brand-muted tracking-wider mb-2">
              Available Scripts & Commands
            </h4>
            <div className="space-y-1.5">
              {techDocs.scripts?.length ? (
                techDocs.scripts.map((sc, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-stone-900 text-stone-100 flex flex-col xs:flex-row xs:items-center justify-between text-xs font-mono gap-1">
                    <span className="text-amber-300">{sc.command}</span>
                    <span className="text-[11px] text-stone-400 font-sans">{sc.purpose}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-brand-muted italic">No scripts documented.</p>
              )}
            </div>
          </div>
        </div>

        {/* Environment Variables Table */}
        {techDocs.environmentVariables?.length ? (
          <div className="mt-6 pt-4 border-t border-brand-border">
            <h4 className="text-xs font-bold uppercase text-brand-muted tracking-wider mb-2">
              Environment Variables Required
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-brand-border rounded-lg overflow-hidden">
                <thead className="bg-brand-bg text-brand-dark font-semibold">
                  <tr>
                    <th className="p-2.5">Variable</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {techDocs.environmentVariables.map((envVar, idx) => (
                    <tr key={idx} className="hover:bg-brand-bg/30">
                      <td className="p-2.5 font-mono text-brand-primary font-semibold">{envVar.key}</td>
                      <td className="p-2.5 text-stone-600">{envVar.description}</td>
                      <td className="p-2.5">
                        {envVar.required ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-brand-primary font-semibold">
                            YES
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                            Optional
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* 5. Dependencies and Responsibilities */}
      <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
          <PackageCheck className="w-5 h-5 text-brand-primary" />
          <h3 className="text-base font-bold text-brand-dark">Dependencies & Architectural Responsibilities</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {dependencies.length === 0 ? (
            <p className="text-xs text-brand-muted italic">No major dependencies analyzed.</p>
          ) : (
            dependencies.map((dep, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-brand-border bg-white flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-mono font-bold text-stone-900 truncate">{dep.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 font-mono text-stone-600">
                      {dep.version || 'latest'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug">{dep.purpose}</p>
                </div>
                <div className="mt-2 pt-1 border-t border-brand-border flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-brand-muted">Category</span>
                  <span className="text-[10px] font-medium text-brand-dark px-1.5 py-0.5 rounded bg-brand-secondary/30">
                    {dep.category}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 6. Discussions, Communications & Future Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Discussions & Communications */}
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
            <MessagesSquare className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-dark">Available Discussions & Records</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500 font-medium">Historical Records Found:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  discussions.hasHistoricalRecords
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {discussions.hasHistoricalRecords ? 'YES (Docs/Notes present)' : 'NO (Source code only)'}
              </span>
            </div>

            {discussions.foundSources?.length ? (
              <div>
                <p className="text-[11px] font-semibold text-brand-muted uppercase mb-1">Verified Sources</p>
                <div className="flex flex-wrap gap-1">
                  {discussions.foundSources.map((s, idx) => (
                    <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-bg text-brand-dark border border-brand-border">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {discussions.notes?.length ? (
              <ul className="text-xs text-stone-700 space-y-1 list-disc list-inside bg-brand-bg/30 p-3 rounded-xl">
                {discussions.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-brand-muted italic">No historical communications found in repository files.</p>
            )}
          </div>
        </div>

        {/* Future Plans & Pending Actions */}
        <div className="bg-white rounded-2xl border border-brand-border p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
            <ArrowRight className="w-5 h-5 text-brand-primary" />
            <h3 className="text-base font-bold text-brand-dark">Future Plans & Pending Actions</h3>
          </div>

          <div className="space-y-2">
            {futurePlans.length === 0 ? (
              <p className="text-xs text-brand-muted italic">No pending actions documented.</p>
            ) : (
              futurePlans.map((plan, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-700 p-2.5 rounded-xl border border-brand-border bg-brand-bg/20">
                  <span className="w-5 h-5 rounded-full bg-brand-primary text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{plan}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 7. Missing or Contradictory Information */}
      {missingInfo.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-amber-200 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold">Missing or Contradictory Information Detected</h3>
          </div>
          <ul className="text-xs text-amber-950 space-y-1.5 list-disc list-inside">
            {missingInfo.map((info, idx) => (
              <li key={idx}>{info}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

