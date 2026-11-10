import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderGit2, 
  Sparkles, 
  ArrowUpRight, 
  Clock, 
  Layers, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { fetchProjects, launchAssistantWindow } from '../lib/api';
import { ProjectItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { PasswordPromptModal } from '../components/PasswordPromptModal';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeLockProject, setActiveLockProject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((data) => {
        setProjects(data.projects || []);
      })
      .catch((err) => {
        console.warn('Dashboard fetch projects error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLaunchAssistant = (proj: ProjectItem) => {
    if (proj.has_password) {
      setActiveLockProject({ id: proj.id, name: proj.name });
    } else {
      launchAssistantWindow(proj.id);
    }
  };

  const totalProjects = projects.length;
  const avgCompletion = totalProjects > 0
    ? Math.round(projects.reduce((acc, p) => acc + (Number(p.completion_percentage) || 0), 0) / totalProjects)
    : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white rounded-3xl border border-brand-border p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-brand-primary tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>AI Codebase Knowledge Reconstruction</span>
          </div>
          <h1 className="text-2xl font-black text-brand-dark tracking-tight">
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}
          </h1>
          <p className="text-xs text-brand-muted mt-1 max-w-xl leading-relaxed">
            Er.NEXA inspects complete or incomplete software projects, extracts architectural decisions, constructs Mermaid diagrams, and computes mathematically verified completion percentages.
          </p>
        </div>

        <Link
          to="/new-analysis"
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover shadow-md transition self-start md:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Project Analysis</span>
        </Link>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-2xl bg-white border border-brand-border shadow-sm">
          <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
            Total Projects
          </span>
          <div className="text-3xl font-black text-brand-dark mt-2">{totalProjects}</div>
          <p className="text-[11px] text-stone-500 mt-1">Reconstructed codebases</p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-brand-border shadow-sm">
          <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
            Avg. Completion
          </span>
          <div className="text-3xl font-black text-brand-primary mt-2">{avgCompletion}%</div>
          <p className="text-[11px] text-stone-500 mt-1">Mathematically verified</p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-brand-border shadow-sm">
          <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
            Knowledge Engine
          </span>
          <div className="text-lg font-bold text-brand-dark mt-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Gemini 2.5 Flash</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Google GenAI Backend</p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-brand-border shadow-sm">
          <span className="text-xs font-semibold text-brand-muted uppercase tracking-wider">
            Launch Assistant
          </span>
          <div className="text-lg font-bold text-brand-dark mt-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-secondary" />
            <span>Er.AXON Style</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Isolated desktop session</p>
        </div>
      </div>

      {/* Saved Projects Section */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-brand-border">
          <div>
            <h2 className="text-base font-bold text-brand-dark">Saved Projects</h2>
            <p className="text-xs text-brand-muted">Stored codebase analyses and diagrams</p>
          </div>
          <Link
            to="/projects"
            className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-brand-muted">Loading saved projects...</div>
        ) : projects.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-bg text-brand-muted mx-auto flex items-center justify-center">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-brand-dark">No saved projects yet</p>
            <p className="text-xs text-brand-muted max-w-sm mx-auto">
              Analyze your first ZIP archive, local folder, or GitHub repository to reconstruct its knowledge model.
            </p>
            <Link
              to="/new-analysis"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Analysis</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="p-5 rounded-2xl border border-brand-border bg-brand-bg/20 hover:border-brand-primary/40 hover:bg-white transition shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-brand-dark truncate">{proj.name}</h3>
                    {proj.has_password && (
                      <span className="p-1 rounded bg-amber-100 text-amber-800" title="Password Protected">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 line-clamp-2 mb-4 leading-relaxed">
                    {proj.description || 'Codebase reconstructed by Er.NEXA AI.'}
                  </p>

                  {/* Completion percentage bar */}
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-brand-muted font-medium">Completion</span>
                      <span className="font-bold text-brand-primary">{proj.completion_percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        style={{ width: `${proj.completion_percentage}%` }}
                        className="h-full bg-brand-primary rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-brand-border flex items-center justify-between gap-2">
                  <Link
                    to={`/projects/${proj.id}`}
                    className="text-xs font-semibold text-brand-dark hover:text-brand-primary transition"
                  >
                    View Details →
                  </Link>

                  {/* Launch Assistant Button */}
                  <button
                    type="button"
                    onClick={() => handleLaunchAssistant(proj)}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-900 text-stone-100 hover:bg-black transition shadow-sm"
                  >
                    <Layers className="w-3 h-3 text-brand-secondary" />
                    <span>Launch Assistant</span>
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

      {/* Recent Activity Log */}
      <div className="bg-white rounded-3xl border border-brand-border p-6 shadow-sm">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-brand-border">
          <Clock className="w-4 h-4 text-brand-primary" />
          <h3 className="text-base font-bold text-brand-dark">Recent Project Activity</h3>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-brand-muted italic">No activity logged yet.</p>
        ) : (
          <div className="space-y-3">
            {projects.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs p-3 rounded-xl bg-brand-bg/30 border border-brand-border"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-brand-dark">{p.name}</span>
                    <span className="text-stone-500 ml-2">analyzed and knowledge model saved</span>
                  </div>
                </div>
                <span className="text-[11px] text-stone-400 font-mono">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

