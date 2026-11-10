import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderGit2, 
  Search, 
  Sparkles, 
  Layers, 
  Lock, 
  ArrowUpRight, 
  Calendar,
  Filter
} from 'lucide-react';
import { fetchProjects, launchAssistantWindow } from '../lib/api';
import { ProjectItem } from '../types';
import { PasswordPromptModal } from '../components/PasswordPromptModal';

export const ProjectsList: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [activeLockProject, setActiveLockProject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((data) => setProjects(data.projects || []))
      .catch((err) => console.warn('Fetch projects error:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleLaunchAssistant = (proj: ProjectItem) => {
    if (proj.has_password) {
      setActiveLockProject({ id: proj.id, name: proj.name });
    } else {
      launchAssistantWindow(proj.id);
    }
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-dark tracking-tight">Saved Projects</h1>
          <p className="text-xs text-brand-muted mt-1">
            Browse and manage all reconstructed software knowledge models.
          </p>
        </div>

        <Link
          to="/new-analysis"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover shadow-sm transition self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>New Analysis</span>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-brand-muted absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects by name or description..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary bg-white"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-brand-muted">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-brand-border p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-bg text-brand-muted mx-auto flex items-center justify-center">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-brand-dark">No projects match your search</p>
          <p className="text-xs text-brand-muted max-w-xs mx-auto">
            Try adjusting your search query or start a new project analysis.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((proj) => (
            <div
              key={proj.id}
              className="p-5 rounded-2xl border border-brand-border bg-white hover:border-brand-primary/40 transition shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-brand-dark truncate">{proj.name}</h3>
                  <div className="flex items-center gap-1">
                    {proj.has_password && (
                      <span className="p-1 rounded bg-amber-100 text-amber-800" title="Password Protected">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                      {proj.userRole || 'owner'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-stone-600 line-clamp-2 mb-4 leading-relaxed">
                  {proj.description || 'Codebase reconstructed by Er.NEXA AI.'}
                </p>

                {/* Completion Progress Bar */}
                <div className="space-y-1 mb-4">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-brand-muted font-medium">Completion</span>
                    <span className="font-bold text-brand-primary">{proj.completion_percentage}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-brand-bg overflow-hidden border border-brand-border/60">
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

                {/* Launch Assistant */}
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

