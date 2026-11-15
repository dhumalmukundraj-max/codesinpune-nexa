import { supabase } from './supabase';

const getApiBase = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!envUrl) return '/api';
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const API_BASE = getApiBase();

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

// ==========================================
// ROUND 3 API: GitHub Continuous Sync
// ==========================================

export async function fetchSyncConfig(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/sync/config`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to fetch GitHub sync configuration');
  }
  return res.json();
}

export async function connectGitHubRepo(
  projectId: string,
  payload: { repoUrl: string; githubToken?: string; syncInterval?: string; webhookSecret?: string }
) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/sync/connect`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to connect repository');
  }
  return res.json();
}

export async function disconnectGitHubRepo(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/sync/disconnect`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to disconnect repository');
  }
  return res.json();
}

export async function triggerManualSync(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/sync/manual`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Sync execution failed');
  }
  return res.json();
}

export async function fetchSyncHistory(projectId: string, limit = 20) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/sync/history?limit=${limit}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load sync history');
  }
  return res.json();
}

export async function updateSyncInterval(projectId: string, interval: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/sync/interval`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update sync interval');
  }
  return res.json();
}

// ==========================================
// ROUND 3 API: Interactive Knowledge Graph
// ==========================================

export async function fetchKnowledgeGraph(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/graph`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load project knowledge graph');
  }
  return res.json();
}

export async function generateKnowledgeGraph(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/graph/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate project knowledge graph');
  }
  return res.json();
}

// ==========================================
// ROUND 3 API: Intelligent Roadmap & Tasks
// ==========================================

export async function fetchProjectTasks(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load roadmap tasks');
  }
  return res.json();
}

export async function generateProjectTasks(projectId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/generate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to generate AI task recommendations');
  }
  return res.json();
}

export async function updateProjectTask(projectId: string, taskId: string, updates: any) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to update task');
  }
  return res.json();
}

export async function deleteProjectTask(projectId: string, taskId: string) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to delete task');
  }
  return res.json();
}

// ==========================================
// Centralized Progress & Project Saving APIs
// ==========================================

export async function updateProjectProgress(
  projectId: string,
  payload: { checkedMap?: Record<string, boolean>; taskUpdates?: any[] }
) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/progress`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to update project progress');
  }
  return res.json();
}

export async function saveProjectChanges(projectId: string, payload: any) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/save`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to save project changes');
  }
  return res.json();
}

// ==========================================
// Project Encryption Password Management APIs
// ==========================================

export async function changeProjectPassword(
  projectId: string,
  payload: { currentPassword?: string; newPassword: string; confirmPassword: string }
) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/encryption/change-password`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to change encryption password');
  }
  const data = await res.json();
  if (data.unlockToken) {
    sessionStorage.setItem(`ernexa_unlock_${projectId}`, data.unlockToken);
    sessionStorage.setItem(`ernexa_assistant_unlock_${projectId}`, data.unlockToken);
  }
  return data;
}

export async function removeProjectPassword(
  projectId: string,
  payload: { currentPassword: string; confirmRemove: boolean }
) {
  const headers = await getAuthHeaders(projectId);
  const res = await fetch(`${API_BASE}/projects/${projectId}/encryption/remove-password`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to remove password protection');
  }
  sessionStorage.removeItem(`ernexa_unlock_${projectId}`);
  sessionStorage.removeItem(`ernexa_assistant_unlock_${projectId}`);
  return res.json();
}

// ==========================================
// Instagram-style User Profiles APIs
// ==========================================

export async function fetchMyProfile() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/profiles/me`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load user profile');
  }
  return res.json();
}

export async function updateMyProfile(payload: {
  username?: string;
  display_name?: string;
  bio?: string;
  public_id?: string;
  avatar_url?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/profiles/me`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let errorDetail = 'Failed to update profile';
    try {
      const err = await res.json();
      errorDetail = err.message || err.error || errorDetail;
    } catch {
      const text = await res.text().catch(() => '');
      if (text) {
        errorDetail = `Server returned ${res.status}: ${text.slice(0, 120)}`;
      } else {
        errorDetail = `Failed to update profile (${res.status} ${res.statusText})`;
      }
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export async function searchProfiles(query: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/profiles/search?q=${encodeURIComponent(query)}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'User search failed');
  }
  return res.json();
}

export async function fetchPublicProfile(idOrUsername: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/profiles/${encodeURIComponent(idOrUsername)}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to load public profile');
  }
  return res.json();
}

// ==========================================
// Built-in Real-Time Messenger APIs
// ==========================================

export async function fetchUnreadMessageCounts(): Promise<{ totalUnread: number; byConversation: Record<string, number> }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/messages/unread-count`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return { totalUnread: data.totalUnread || 0, byConversation: data.byConversation || {} };
    }
  } catch (err) {
    console.warn('[Er.NEXA api] fetchUnreadMessageCounts API fallback:', err);
  }

  // Supabase direct fallback
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('conversation_id, last_read_at')
          .eq('user_id', user.id);

        if (participants && participants.length > 0) {
          const convIds = participants.map((p: any) => p.conversation_id);
          const { data: messages } = await supabase
            .from('messages')
            .select('conversation_id, sender_id, created_at')
            .in('conversation_id', convIds);

          const byConversation: Record<string, number> = {};
          let totalUnread = 0;

          const readMap = new Map<string, string>();
          participants.forEach((p: any) => {
            if (p.last_read_at) readMap.set(p.conversation_id, p.last_read_at);
          });

          (messages || []).forEach((m: any) => {
            if (m.sender_id !== user.id) {
              const lastRead = readMap.get(m.conversation_id) || '1970-01-01';
              if (new Date(m.created_at).getTime() > new Date(lastRead).getTime()) {
                byConversation[m.conversation_id] = (byConversation[m.conversation_id] || 0) + 1;
                totalUnread += 1;
              }
            }
          });

          return { totalUnread, byConversation };
        }
      }
    } catch {}
  }

  return { totalUnread: 0, byConversation: {} };
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  const headers = await getAuthHeaders();

  // Call backend API
  fetch(`${API_BASE}/messages/conversations/${conversationId}/read`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  }).catch(() => {});

  // Update Supabase directly for instant persistence across devices
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .match({ conversation_id: conversationId, user_id: user.id });
      }
    } catch (err) {
      console.warn('[Er.NEXA api] markConversationAsRead direct Supabase notice:', err);
    }
  }
}

export async function fetchConversations() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/messages/conversations`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Er.NEXA api] API fetchConversations warning, attempting Supabase direct:', err);
  }

  // Fallback directly to Supabase client if API call fails or server is restarting
  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: participantRows } = await supabase
          .from('conversation_participants')
          .select('conversation_id, role')
          .eq('user_id', user.id);

        if (participantRows && participantRows.length > 0) {
          const convIds = participantRows.map((r: any) => r.conversation_id);
          const { data: convRows } = await supabase
            .from('conversations')
            .select('*')
            .in('id', convIds);

          const { data: messages } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, receiver_id, content, attachments, message_type, metadata, created_at')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false });

          const conversations = (convRows || []).map((conv: any) => {
            const lastMsg = (messages || []).find((m: any) => m.conversation_id === conv.id);
            const isGroup = Boolean(conv.is_group);
            const atts = lastMsg?.attachments || lastMsg?.metadata?.attachments || [];
            return {
              id: conv.id,
              title: conv.title,
              is_group: isGroup,
              avatar_url: conv.avatar_url,
              admin_id: conv.admin_id,
              description: conv.description,
              updated_at: conv.updated_at || conv.created_at,
              unreadCount: 0,
              lastMessage: lastMsg ? {
                content: lastMsg.content || (atts.length > 0 ? `Shared ${atts.length} file(s)` : 'New message'),
                sender_id: lastMsg.sender_id,
                created_at: lastMsg.created_at,
                message_type: lastMsg.message_type || 'text',
                attachments_count: atts.length,
              } : undefined,
            };
          });
          return { success: true, conversations };
        }
      }
    } catch (sbErr) {
      console.warn('[Er.NEXA api] Direct Supabase fetchConversations fallback error:', sbErr);
    }
  }

  throw new Error('Failed to load conversations');
}

export async function startConversation(recipientId?: string, usernameOrId?: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/messages/conversations`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientId, usernameOrId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to initiate conversation');
  }
  return res.json();
}

export async function fetchMessages(conversationId: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/messages`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[Er.NEXA api] API fetchMessages warning, attempting Supabase direct:', err);
  }

  // Direct Supabase client fallback
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, receiver_id, content, attachments, message_type, metadata, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(500);

      if (!error && data) {
        const messages = data.map((m: any) => {
          const rawAttachments = m.attachments || m.metadata?.attachments || [];
          return {
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            receiver_id: m.receiver_id || undefined,
            content: m.content || '',
            message_type: m.message_type || (rawAttachments.length > 0 ? 'mixed' : 'text'),
            attachments: rawAttachments,
            metadata: m.metadata || {},
            created_at: m.created_at,
          };
        });
        return { success: true, messages };
      }
    } catch (sbErr) {
      console.warn('[Er.NEXA api] Direct Supabase fetchMessages fallback error:', sbErr);
    }
  }

  throw new Error('Failed to load messages');
}

export async function sendChatMessage(
  conversationId: string,
  content: string,
  attachments?: File[],
  receiverId?: string
) {
  const headers = await getAuthHeaders();

  if (attachments && attachments.length > 0) {
    const formData = new FormData();
    formData.append('content', content || '');
    if (receiverId) formData.append('receiverId', receiverId);
    attachments.forEach((file) => {
      formData.append('attachments', file);
    });

    const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        ...headers,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to send message attachments');
    }
    return res.json();
  }

  try {
    const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, receiverId }),
    });
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to send message');
  } catch (apiErr: any) {
    // If backend is sleeping/down, direct insert via Supabase client
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const now = new Date().toISOString();
          const { data: inserted, error: sbInsertErr } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: user.id,
              receiver_id: receiverId || null,
              content: content ? content.trim() : '',
              message_type: 'text',
              attachments: [],
              metadata: {},
              created_at: now,
            })
            .select()
            .single();

          if (!sbInsertErr && inserted) {
            return {
              success: true,
              message: {
                id: inserted.id,
                conversation_id: inserted.conversation_id,
                sender_id: inserted.sender_id,
                receiver_id: inserted.receiver_id,
                content: inserted.content,
                message_type: 'text',
                attachments: [],
                metadata: {},
                created_at: inserted.created_at,
              },
            };
          }
        }
      } catch {}
    }
    throw apiErr;
  }
}

export async function createGroupConversation(
  title: string,
  memberIds: string[],
  avatarFile?: File | null,
  description?: string
) {
  const headers = await getAuthHeaders();

  if (avatarFile) {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('memberIds', JSON.stringify(memberIds));
    if (description) formData.append('description', description);
    formData.append('avatar', avatarFile);

    const res = await fetch(`${API_BASE}/messages/conversations/group`, {
      method: 'POST',
      headers: { ...headers },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to create group');
    }
    return res.json();
  }

  const res = await fetch(`${API_BASE}/messages/conversations/group`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, memberIds, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to create group');
  }
  return res.json();
}

export async function fetchConversationDetails(conversationId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to fetch conversation details');
  }
  return res.json();
}

export async function updateGroupDetails(
  conversationId: string,
  updates: { title?: string; avatar_url?: string; description?: string }
) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to update group');
  }
  return res.json();
}

export async function uploadGroupAvatar(conversationId: string, avatarFile: File) {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append('avatar', avatarFile);

  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/avatar`, {
    method: 'POST',
    headers: { ...headers },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to upload group profile picture');
  }
  return res.json();
}

export async function addGroupMembers(conversationId: string, memberIds: string[]) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/members`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to add members');
  }
  return res.json();
}

export async function removeGroupMember(conversationId: string, memberId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/messages/conversations/${conversationId}/members/${memberId}`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || 'Failed to remove member or leave group');
  }
  return res.json();
}



