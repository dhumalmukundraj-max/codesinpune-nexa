import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, Clock, ShieldCheck, ArrowRight, Layers } from 'lucide-react';
import { fetchProjects, launchAssistantWindow } from '../lib/api';
import { ProjectItem } from '../types';
import { PasswordPromptModal } from '../components/PasswordPromptModal';

export const ReviewsList: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeLockProject, setActiveLockProject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((data) => setProjects(data.projects || []))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  const handleLaunchAssistant = (proj: ProjectItem) => {
    if (proj.has_password) {
      setActiveLockProject({ id: proj.id, name: proj.name });
    } else {
      launchAssistantWindow(proj.id);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-brand-dark tracking-tight">Reviews & Handover Reports</h1>
        <p className="text-xs text-brand-muted mt-1">
          Authorized human verification and knowledge handover approvals for engineering teams.
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-6 border-b border-brand-border">
          <ShieldCheck className="w-5 h-5 text-brand-primary" />
          <h2 className="text-base font-bold text-brand-dark">Handover Review Dashboard</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-brand-muted">Loading projects for review...</div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center text-xs text-brand-muted">
            No projects available for review yet.
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-brand-dark">{proj.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-bg text-brand-dark font-medium border border-brand-border">
                      {proj.completion_percentage}% Complete
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                    {proj.description || 'AI-reconstructed codebase knowledge base.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/projects/${proj.id}`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-brand-border text-brand-dark text-xs font-semibold hover:bg-brand-bg transition"
                  >
                    <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                    <span>Review & Sign Handover</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleLaunchAssistant(proj)}
                    className="p-2 rounded-xl bg-stone-900 text-stone-100 hover:bg-black transition"
                    title="Launch Desktop Assistant"
                  >
                    <Layers className="w-4 h-4 text-brand-secondary" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Prompt Modal if Launching Locked Assistant */}
      {activeLockProject && (
        <PasswordPromptModal
          projectId={activeLockProject.id}
          projectName={activeLockProject.name}
          title="Launch AI Assistant — Password Required"
          description={
            <>
              The project <strong className="text-stone-900">"{activeLockProject.name}"</strong> is password protected. Enter the project password to launch its AI Launch Assistant.
            </>
          }
          submitButtonText="Verify & Launch Assistant"
          onUnlocked={(token) => {
            const pid = activeLockProject.id;
            setActiveLockProject(null);
            launchAssistantWindow(pid, token);
          }}
          onCancel={() => setActiveLockProject(null)}
        />
      )}
    </div>
  );
};

