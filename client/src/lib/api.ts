import { supabase } from './supabase';

const API_BASE = '/api';

export async function getAuthHeaders(projectId?: string, customProjectToken?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  }

  // If a specific token is passed directly (e.g. for assistant)
  if (customProjectToken) {
    headers['x-project-token'] = customProjectToken;
  } else if (projectId) {
    // If there's an active project unlock token in session storage
    const unlockToken = sessionStorage.getItem(`ernexa_unlock_${projectId}`);
    if (unlockToken) {
      headers['x-project-token'] = unlockToken;
    }
  }

  return headers;
}

export async function checkServerHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function previewProject(formData: FormData) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/analyze/preview`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to preview project files');
  }
  return res.json();
}

export async function runProjectAnalysis(formData: FormData) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/analyze/run`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'AI analysis execution failed');
  }
  return res.json();
}

export async function fetchProjects() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/projects`, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load projects');
  }
  return res.json();
}

export async function fetchProjectDetails(id: string) {
  const headers = await getAuthHeaders(id);
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load project details');
  }
  return res.json();
}

export async function unlockProject(id: string, password: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/projects/${id}/unlock`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Incorrect project password');
  }
  const data = await res.json();
  if (data.unlockToken) {
    sessionStorage.setItem(`ernexa_unlock_${id}`, data.unlockToken);
  }
  return data;
}

export async function saveProject(projectPayload: any) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(projectPayload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to save project');
  }
  return res.json();
}

export async function deleteProject(id: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete project');
  }
  return res.json();
}

export async function submitProjectReview(projectId: string, reviewData: any) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/review`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(reviewData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to submit review');
  }
  return res.json();
}

export async function shareProject(projectId: string, email: string, role: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/share`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to share project');
  }
  return res.json();
}

export async function fetchProjectPermissions(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/permissions`, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch project permissions');
  }
  return res.json();
}

export async function askLaunchAssistant(projectId: string, message: string, history: any[], activeFileContext?: any, assistantToken?: string) {
  const token = assistantToken || sessionStorage.getItem(`ernexa_assistant_unlock_${projectId}`);
  const headers = await getAuthHeaders(undefined, token || undefined);
  const res = await fetch(`${API_BASE}/assistant/${projectId}/chat`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history, activeFileContext, unlockToken: token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Launch Assistant failed to respond');
  }
  return res.json();
}

export function launchAssistantWindow(projectId: string, token?: string) {
  const unlockToken = token || sessionStorage.getItem(`ernexa_assistant_unlock_${projectId}`);
  const tokenQuery = unlockToken ? `&token=${encodeURIComponent(unlockToken)}` : '';

  // If running inside Electron main process already
  if ((window as any).electronAPI) {
    window.open(`/assistant?projectId=${encodeURIComponent(projectId)}${tokenQuery}&electron=true`, '_self');
    return;
  }

  // Attempt custom protocol deep-link to launch the Electron desktop app
  const deepLink = `ernexa://assistant?projectId=${encodeURIComponent(projectId)}${tokenQuery}`;
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = deepLink;
  document.body.appendChild(iframe);
  setTimeout(() => {
    iframe.remove();
  }, 1000);

  // Open compact floating popup window (440x720) matching Er.AXON dimensions
  const popup = window.open(
    `/assistant?projectId=${encodeURIComponent(projectId)}${tokenQuery}`,
    `ErNEXA_Assistant_${projectId}`,
    'width=440,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes'
  );
  if (popup) {
    popup.focus();
  }
}

export async function fetchAssistantContext(projectId: string, assistantToken?: string) {
  const token = assistantToken || sessionStorage.getItem(`ernexa_assistant_unlock_${projectId}`);
  const headers = await getAuthHeaders(undefined, token || undefined);
  const queryStr = token ? `?token=${encodeURIComponent(token)}` : '';
  const res = await fetch(`${API_BASE}/assistant/${projectId}/context${queryStr}`, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Failed to load assistant context');
  }
  return res.json();
}

