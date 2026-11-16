import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { supabaseAdmin } from '../../config/index.js';
import { profileStorage, UserProfileRecord } from './profileStorage.js';

function getDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/round3'),
    path.resolve(process.cwd(), 'server/data/round3'),
    path.join(os.tmpdir(), 'ernexa_round3'),
  ];

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const testFile = path.join(candidate, '.write_test_handover');
      fs.writeFileSync(testFile, 'ok', 'utf-8');
      fs.unlinkSync(testFile);
      return candidate;
    } catch {}
  }
  return '';
}

function getLocalFilePath(filename: string): string {
  const dir = getDataDir();
  return dir ? path.join(dir, filename) : '';
}

export interface ProjectHandoverRecord {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  creator_id: string;
  outgoing_member_id?: string;
  incoming_member_id?: string;
  reviewer_id?: string;
  status:
    | 'DRAFT'
    | 'GENERATING'
    | 'UNDER_REVIEW'
    | 'REVISION_REQUIRED'
    | 'APPROVED'
    | 'SHARED'
    | 'ACKNOWLEDGED'
    | 'ARCHIVED';
  content: any;
  original_ai_content?: any;
  current_version: number;
  approved_at?: string;
  approved_by?: string;
  shared_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  metadata?: {
    targetDate?: string;
    focusAreas?: string;
    notes?: string;
    checklist?: any[];
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
  projectName?: string;
  creatorProfile?: UserProfileRecord;
  outgoingProfile?: UserProfileRecord;
  incomingProfile?: UserProfileRecord;
  reviewerProfile?: UserProfileRecord;
}

export interface HandoverClaimRecord {
  id: string;
  handover_id: string;
  section_key: string;
  claim_text: string;
  category: string;
  verification_status: 'VERIFIED FACT' | 'AI INFERENCE' | 'UNKNOWN' | 'CONFLICTING INFORMATION';
  confidence_score: number;
  source_type: string;
  source_identifier?: string;
  file_path?: string;
  line_reference?: string;
  supporting_excerpt?: string;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
  verifierProfile?: UserProfileRecord;
}

export interface HandoverVersionRecord {
  id: string;
  handover_id: string;
  version_number: number;
  snapshot: any;
  editor_id?: string;
  change_summary?: string;
  status_at_version: string;
  created_at: string;
  editorProfile?: UserProfileRecord;
}

export interface HandoverCommentRecord {
  id: string;
  handover_id: string;
  author_id: string;
  section_key?: string;
  claim_id?: string;
  comment_type: 'general' | 'review_note' | 'clarification_request' | 'correction';
  content: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  authorProfile?: UserProfileRecord;
}

export interface HandoverAcknowledgementRecord {
  id: string;
  handover_id: string;
  member_id: string;
  version_number: number;
  checklist_state: any;
  comments?: string;
  missing_information_reported?: string;
  status: 'CONFIRMED' | 'NEEDS_CLARIFICATION';
  created_at: string;
  memberProfile?: UserProfileRecord;
}

export interface HandoverNotificationRecord {
  id: string;
  handover_id: string;
  recipient_id: string;
  sender_id?: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
  senderProfile?: UserProfileRecord;
}

// Local fallback in-memory state
const localHandovers = new Map<string, ProjectHandoverRecord>();
const localClaims = new Map<string, HandoverClaimRecord[]>();
const localVersions = new Map<string, HandoverVersionRecord[]>();
const localComments = new Map<string, HandoverCommentRecord[]>();
const localAcknowledgements = new Map<string, HandoverAcknowledgementRecord[]>();
const localNotifications = new Map<string, HandoverNotificationRecord[]>();

function readLocalJson<T>(filename: string, defaultValue: T): T {
  const filePath = getLocalFilePath(filename);
  if (!filePath || !fs.existsSync(filePath)) return defaultValue;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function writeLocalJson(filename: string, data: any): void {
  const filePath = getLocalFilePath(filename);
  if (!filePath) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export const handoverStorage = {
  /**
   * List handovers where the user is creator, outgoing, incoming, reviewer,
   * or has access to the project.
   */
  async listHandovers(userId: string): Promise<ProjectHandoverRecord[]> {
    let records: ProjectHandoverRecord[] = [];

    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('project_handovers')
          .select('*, projects(name)')
          .or(`creator_id.eq.${userId},outgoing_member_id.eq.${userId},incoming_member_id.eq.${userId},reviewer_id.eq.${userId}`)
          .order('updated_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          records = data.map((d: any) => ({
            ...d,
            projectName: d.projects?.name || 'Project',
          }));
        }
      } catch (err) {
        console.warn('[HandoverStorage] Supabase query failed, using local storage fallback.', err);
      }
    }

    if (records.length === 0) {
      const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
      records = Object.values(saved).filter(
        (h) =>
          !userId ||
          h.creator_id === userId ||
          h.outgoing_member_id === userId ||
          h.incoming_member_id === userId ||
          h.reviewer_id === userId
      );
    }

    // Hydrate profiles for each record
    const hydrated = await Promise.all(
      records.map(async (h) => {
        const [creator, outgoing, incoming, reviewer] = await Promise.all([
          h.creator_id ? profileStorage.getProfile(h.creator_id) : Promise.resolve(undefined),
          h.outgoing_member_id ? profileStorage.getProfile(h.outgoing_member_id) : Promise.resolve(undefined),
          h.incoming_member_id ? profileStorage.getProfile(h.incoming_member_id) : Promise.resolve(undefined),
          h.reviewer_id ? profileStorage.getProfile(h.reviewer_id) : Promise.resolve(undefined),
        ]);
        return {
          ...h,
          creatorProfile: creator,
          outgoingProfile: outgoing,
          incomingProfile: incoming,
          reviewerProfile: reviewer,
        };
      })
    );

    return hydrated;
  },

  /**
   * Get single handover with all related claims, latest version, comments, and project details.
   */
  async getHandoverById(id: string): Promise<{
    handover: ProjectHandoverRecord | null;
    claims: HandoverClaimRecord[];
    versions: HandoverVersionRecord[];
    comments: HandoverCommentRecord[];
    acknowledgement?: HandoverAcknowledgementRecord | null;
  }> {
    let handover: ProjectHandoverRecord | null = null;
    let claims: HandoverClaimRecord[] = [];
    let versions: HandoverVersionRecord[] = [];
    let comments: HandoverCommentRecord[] = [];
    let acknowledgement: HandoverAcknowledgementRecord | null = null;

    if (supabaseAdmin) {
      try {
        const [hRes, cRes, vRes, cmRes, ackRes] = await Promise.all([
          supabaseAdmin.from('project_handovers').select('*, projects(name)').eq('id', id).maybeSingle(),
          supabaseAdmin.from('handover_claims').select('*').eq('handover_id', id).order('created_at', { ascending: true }),
          supabaseAdmin.from('handover_versions').select('*').eq('handover_id', id).order('version_number', { ascending: false }),
          supabaseAdmin.from('handover_comments').select('*').eq('handover_id', id).order('created_at', { ascending: true }),
          supabaseAdmin.from('handover_acknowledgements').select('*').eq('handover_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        if (hRes.data) {
          handover = {
            ...hRes.data,
            projectName: (hRes.data as any).projects?.name || 'Project',
          };
        }
        if (cRes.data) claims = cRes.data;
        if (vRes.data) versions = vRes.data;
        if (cmRes.data) comments = cmRes.data;
        if (ackRes.data) acknowledgement = ackRes.data;
      } catch (err) {
        console.warn('[HandoverStorage] Supabase get error, checking local store:', err);
      }
    }

    if (!handover) {
      const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
      handover = saved[id] || null;
      const allClaims = readLocalJson<Record<string, HandoverClaimRecord[]>>('handover_claims.json', {});
      claims = allClaims[id] || [];
      const allVersions = readLocalJson<Record<string, HandoverVersionRecord[]>>('handover_versions.json', {});
      versions = allVersions[id] || [];
      const allComments = readLocalJson<Record<string, HandoverCommentRecord[]>>('handover_comments.json', {});
      comments = allComments[id] || [];
      const allAcks = readLocalJson<Record<string, HandoverAcknowledgementRecord[]>>('handover_acknowledgements.json', {});
      acknowledgement = (allAcks[id] && allAcks[id][0]) || null;
    }

    if (!handover) {
      return { handover: null, claims: [], versions: [], comments: [] };
    }

    // Hydrate participant profiles
    const [creator, outgoing, incoming, reviewer] = await Promise.all([
      handover.creator_id ? profileStorage.getProfile(handover.creator_id) : Promise.resolve(undefined),
      handover.outgoing_member_id ? profileStorage.getProfile(handover.outgoing_member_id) : Promise.resolve(undefined),
      handover.incoming_member_id ? profileStorage.getProfile(handover.incoming_member_id) : Promise.resolve(undefined),
      handover.reviewer_id ? profileStorage.getProfile(handover.reviewer_id) : Promise.resolve(undefined),
    ]);

    handover.creatorProfile = creator;
    handover.outgoingProfile = outgoing;
    handover.incomingProfile = incoming;
    handover.reviewerProfile = reviewer;

    // Hydrate claim verifiers and comment authors
    const hydratedClaims = await Promise.all(
      claims.map(async (c) => {
        if (c.verified_by) {
          const profile = await profileStorage.getProfile(c.verified_by);
          return { ...c, verifierProfile: profile };
        }
        return c;
      })
    );

    const hydratedComments = await Promise.all(
      comments.map(async (cm) => {
        if (cm.author_id) {
          const profile = await profileStorage.getProfile(cm.author_id);
          return { ...cm, authorProfile: profile };
        }
        return cm;
      })
    );

    return {
      handover,
      claims: hydratedClaims,
      versions,
      comments: hydratedComments,
      acknowledgement,
    };
  },

  /**
   * Create a new handover record, initial version, and claims.
   */
  async createHandover(payload: {
    project_id: string;
    title: string;
    description?: string;
    creator_id: string;
    outgoing_member_id?: string;
    incoming_member_id?: string;
    reviewer_id?: string;
    content: any;
    claims: any[];
    metadata?: any;
  }): Promise<ProjectHandoverRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: ProjectHandoverRecord = {
      id,
      project_id: payload.project_id,
      title: payload.title,
      description: payload.description || '',
      creator_id: payload.creator_id,
      outgoing_member_id: payload.outgoing_member_id,
      incoming_member_id: payload.incoming_member_id,
      reviewer_id: payload.reviewer_id,
      status: 'DRAFT',
      content: payload.content,
      original_ai_content: payload.content,
      current_version: 1,
      metadata: payload.metadata || {},
      created_at: now,
      updated_at: now,
    };

    let projectName = 'Project';
    if (supabaseAdmin) {
      try {
        const { data: pData } = await supabaseAdmin.from('projects').select('name').eq('id', payload.project_id).maybeSingle();
        if (pData?.name) projectName = pData.name;

        // Insert handover
        await supabaseAdmin.from('project_handovers').insert({
          id: record.id,
          project_id: record.project_id,
          title: record.title,
          description: record.description,
          creator_id: record.creator_id,
          outgoing_member_id: record.outgoing_member_id,
          incoming_member_id: record.incoming_member_id,
          reviewer_id: record.reviewer_id,
          status: record.status,
          content: record.content,
          original_ai_content: record.original_ai_content,
          current_version: 1,
          metadata: record.metadata,
          created_at: now,
          updated_at: now,
        });

        // Insert initial version 1
        await supabaseAdmin.from('handover_versions').insert({
          id: crypto.randomUUID(),
          handover_id: id,
          version_number: 1,
          snapshot: payload.content,
          editor_id: payload.creator_id,
          change_summary: 'Initial AI-Grounded Handover Generation',
          status_at_version: 'DRAFT',
          created_at: now,
        });

        // Insert claims
        if (payload.claims && payload.claims.length > 0) {
          const claimsToInsert = payload.claims.map((c) => ({
            id: crypto.randomUUID(),
            handover_id: id,
            section_key: c.section_key || 'sectionA',
            claim_text: c.claim_text,
            category: c.category || 'general',
            verification_status: c.verification_status || 'AI INFERENCE',
            confidence_score: c.confidence_score || 0.85,
            source_type: c.source_type || 'code_file',
            file_path: c.file_path || null,
            line_reference: c.line_reference || null,
            supporting_excerpt: c.supporting_excerpt || null,
            created_at: now,
            updated_at: now,
          }));

          await supabaseAdmin.from('handover_claims').insert(claimsToInsert);
        }
      } catch (err) {
        console.warn('[HandoverStorage] Supabase insert failed, writing to local fallback:', err);
      }
    }

    record.projectName = projectName;

    // Save to local cache as well for maximum reliability
    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[id] = record;
    writeLocalJson('handovers.json', saved);

    // Save claims locally
    const allClaims = readLocalJson<Record<string, HandoverClaimRecord[]>>('handover_claims.json', {});
    allClaims[id] = (payload.claims || []).map((c) => ({
      id: crypto.randomUUID(),
      handover_id: id,
      section_key: c.section_key || 'sectionA',
      claim_text: c.claim_text,
      category: c.category || 'general',
      verification_status: c.verification_status || 'AI INFERENCE',
      confidence_score: c.confidence_score || 0.85,
      source_type: c.source_type || 'code_file',
      file_path: c.file_path,
      line_reference: c.line_reference,
      supporting_excerpt: c.supporting_excerpt,
      is_verified: false,
      created_at: now,
      updated_at: now,
    }));
    writeLocalJson('handover_claims.json', allClaims);

    // Save version 1 locally
    const allVersions = readLocalJson<Record<string, HandoverVersionRecord[]>>('handover_versions.json', {});
    allVersions[id] = [
      {
        id: crypto.randomUUID(),
        handover_id: id,
        version_number: 1,
        snapshot: payload.content,
        editor_id: payload.creator_id,
        change_summary: 'Initial AI-Grounded Handover Generation',
        status_at_version: 'DRAFT',
        created_at: now,
      },
    ];
    writeLocalJson('handover_versions.json', allVersions);

    // Send notifications to assigned parties
    if (payload.outgoing_member_id && payload.outgoing_member_id !== payload.creator_id) {
      await this.createNotification({
        handover_id: id,
        recipient_id: payload.outgoing_member_id,
        sender_id: payload.creator_id,
        type: 'assigned',
        title: 'Assigned as Outgoing Member',
        message: `You were assigned as the outgoing knowledge provider for "${record.title}".`,
      });
    }

    if (payload.incoming_member_id && payload.incoming_member_id !== payload.creator_id) {
      await this.createNotification({
        handover_id: id,
        recipient_id: payload.incoming_member_id,
        sender_id: payload.creator_id,
        type: 'assigned',
        title: 'New Project Handover Prepared',
        message: `A new knowledge handover "${record.title}" is being prepared for you.`,
      });
    }

    return record;
  },

  /**
   * Update handover content, automatically incrementing version number and saving snapshot.
   */
  async updateContent(
    handoverId: string,
    content: any,
    editorId: string,
    changeSummary: string
  ): Promise<{ handover: ProjectHandoverRecord; newVersionNumber: number }> {
    const { handover } = await this.getHandoverById(handoverId);
    if (!handover) throw new Error('Handover not found');

    const nextVersion = (handover.current_version || 1) + 1;
    const now = new Date().toISOString();

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('project_handovers')
          .update({
            content,
            current_version: nextVersion,
            updated_at: now,
          })
          .eq('id', handoverId);

        await supabaseAdmin.from('handover_versions').insert({
          id: crypto.randomUUID(),
          handover_id: handoverId,
          version_number: nextVersion,
          snapshot: content,
          editor_id: editorId,
          change_summary: changeSummary || `Updated section content (v${nextVersion})`,
          status_at_version: handover.status,
          created_at: now,
        });
      } catch (err) {
        console.warn('[HandoverStorage] Supabase version update failed:', err);
      }
    }

    handover.content = content;
    handover.current_version = nextVersion;
    handover.updated_at = now;

    // Local fallback update
    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[handoverId] = handover;
    writeLocalJson('handovers.json', saved);

    const allVersions = readLocalJson<Record<string, HandoverVersionRecord[]>>('handover_versions.json', {});
    const list = allVersions[handoverId] || [];
    list.unshift({
      id: crypto.randomUUID(),
      handover_id: handoverId,
      version_number: nextVersion,
      snapshot: content,
      editor_id: editorId,
      change_summary: changeSummary || `Updated section content (v${nextVersion})`,
      status_at_version: handover.status,
      created_at: now,
    });
    allVersions[handoverId] = list;
    writeLocalJson('handover_versions.json', allVersions);

    return { handover, newVersionNumber: nextVersion };
  },

  /**
   * Verify or challenge a specific claim.
   */
  async verifyClaim(
    claimId: string,
    handoverId: string,
    status: 'VERIFIED FACT' | 'AI INFERENCE' | 'UNKNOWN' | 'CONFLICTING INFORMATION',
    userId: string,
    reviewerNotes?: string
  ): Promise<HandoverClaimRecord> {
    const now = new Date().toISOString();

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('handover_claims')
          .update({
            verification_status: status,
            is_verified: true,
            verified_by: userId,
            verified_at: now,
            reviewer_notes: reviewerNotes || null,
            updated_at: now,
          })
          .eq('id', claimId);
      } catch (err) {
        console.warn('[HandoverStorage] Supabase claim update error:', err);
      }
    }

    // Local fallback
    const allClaims = readLocalJson<Record<string, HandoverClaimRecord[]>>('handover_claims.json', {});
    const claims = allClaims[handoverId] || [];
    let updatedClaim: HandoverClaimRecord | null = null;

    for (const c of claims) {
      if (c.id === claimId) {
        c.verification_status = status;
        c.is_verified = true;
        c.verified_by = userId;
        c.verified_at = now;
        c.reviewer_notes = reviewerNotes;
        c.updated_at = now;
        updatedClaim = c;
        break;
      }
    }
    allClaims[handoverId] = claims;
    writeLocalJson('handover_claims.json', allClaims);

    return updatedClaim || {
      id: claimId,
      handover_id: handoverId,
      section_key: 'sectionA',
      claim_text: 'Claim',
      category: 'general',
      verification_status: status,
      confidence_score: 1.0,
      source_type: 'human_verification',
      is_verified: true,
      verified_by: userId,
      verified_at: now,
      reviewer_notes: reviewerNotes,
      created_at: now,
      updated_at: now,
    };
  },

  /**
   * Submit handover for human review (Status -> UNDER_REVIEW).
   */
  async submitForReview(handoverId: string, submitterId: string): Promise<ProjectHandoverRecord> {
    const { handover } = await this.getHandoverById(handoverId);
    if (!handover) throw new Error('Handover not found');

    const now = new Date().toISOString();

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('project_handovers')
          .update({ status: 'UNDER_REVIEW', updated_at: now })
          .eq('id', handoverId);
      } catch (err) {
        console.warn('[HandoverStorage] submit review Supabase error:', err);
      }
    }

    handover.status = 'UNDER_REVIEW';
    handover.updated_at = now;

    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[handoverId] = handover;
    writeLocalJson('handovers.json', saved);

    // Notify reviewer or creator
    const targetRecipient = handover.reviewer_id || handover.incoming_member_id;
    if (targetRecipient && targetRecipient !== submitterId) {
      await this.createNotification({
        handover_id: handoverId,
        recipient_id: targetRecipient,
        sender_id: submitterId,
        type: 'submitted_for_review',
        title: 'Handover Submitted for Review',
        message: `Handover "${handover.title}" is ready for your verification and approval.`,
      });
    }

    return handover;
  },

  /**
   * Human review decision: Approve or Request Revision.
   * STRICT: AI NEVER approves. Only human reviewers or owners.
   */
  async reviewHandover(
    handoverId: string,
    reviewerId: string,
    decision: 'APPROVED' | 'REVISION_REQUIRED',
    notes: string
  ): Promise<ProjectHandoverRecord> {
    const { handover } = await this.getHandoverById(handoverId);
    if (!handover) throw new Error('Handover not found');

    const now = new Date().toISOString();
    const updatePayload: any = {
      status: decision,
      updated_at: now,
    };

    if (decision === 'APPROVED') {
      updatePayload.approved_at = now;
      updatePayload.approved_by = reviewerId;
      handover.approved_at = now;
      handover.approved_by = reviewerId;
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('project_handovers').update(updatePayload).eq('id', handoverId);

        // Record comment with review notes
        if (notes && notes.trim()) {
          await this.addComment({
            handover_id: handoverId,
            author_id: reviewerId,
            comment_type: 'review_note',
            content: `[Decision: ${decision}] ${notes.trim()}`,
          });
        }
      } catch (err) {
        console.warn('[HandoverStorage] Review decision update error:', err);
      }
    }

    handover.status = decision;
    handover.updated_at = now;

    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[handoverId] = handover;
    writeLocalJson('handovers.json', saved);

    // Send notifications to creator and incoming/outgoing members
    const recipients = new Set(
      [handover.creator_id, handover.outgoing_member_id, handover.incoming_member_id].filter(
        (id): id is string => Boolean(id && id !== reviewerId)
      )
    );

    for (const recipientId of recipients) {
      await this.createNotification({
        handover_id: handoverId,
        recipient_id: recipientId,
        sender_id: reviewerId,
        type: decision === 'APPROVED' ? 'approved' : 'revision_requested',
        title: decision === 'APPROVED' ? 'Handover Approved!' : 'Revisions Requested on Handover',
        message:
          decision === 'APPROVED'
            ? `Handover "${handover.title}" has been reviewed and approved.`
            : `Reviewer requested revisions on "${handover.title}": ${notes.slice(0, 100)}...`,
      });
    }

    return handover;
  },

  /**
   * Share approved handover with incoming member or team (Status -> SHARED).
   */
  async shareHandover(handoverId: string, sharedByUserId: string): Promise<ProjectHandoverRecord> {
    const { handover } = await this.getHandoverById(handoverId);
    if (!handover) throw new Error('Handover not found');

    const now = new Date().toISOString();

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('project_handovers')
          .update({
            status: 'SHARED',
            shared_at: now,
            updated_at: now,
          })
          .eq('id', handoverId);
      } catch (err) {}
    }

    handover.status = 'SHARED';
    handover.shared_at = now;
    handover.updated_at = now;

    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[handoverId] = handover;
    writeLocalJson('handovers.json', saved);

    if (handover.incoming_member_id && handover.incoming_member_id !== sharedByUserId) {
      await this.createNotification({
        handover_id: handoverId,
        recipient_id: handover.incoming_member_id,
        sender_id: sharedByUserId,
        type: 'shared',
        title: 'Handover Shared With You',
        message: `Project handover "${handover.title}" is now shared with you. Please review and acknowledge receipt.`,
      });
    }

    return handover;
  },

  /**
   * Update incoming member onboarding checklist state.
   */
  async updateChecklistState(
    handoverId: string,
    checklist: any[]
  ): Promise<ProjectHandoverRecord> {
    const { handover } = await this.getHandoverById(handoverId);
    if (!handover) throw new Error('Handover not found');

    const metadata = { ...(handover.metadata || {}), checklist };
    const now = new Date().toISOString();

    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('project_handovers')
          .update({ metadata, updated_at: now })
          .eq('id', handoverId);
      } catch (err) {}
    }

    handover.metadata = metadata;
    handover.updated_at = now;

    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[handoverId] = handover;
    writeLocalJson('handovers.json', saved);

    return handover;
  },

  /**
   * Formally acknowledge handover receipt (Status -> ACKNOWLEDGED).
   */
  async acknowledgeHandover(payload: {
    handover_id: string;
    member_id: string;
    version_number: number;
    checklist_state: any;
    comments?: string;
    missing_information_reported?: string;
    status: 'CONFIRMED' | 'NEEDS_CLARIFICATION';
  }): Promise<{ handover: ProjectHandoverRecord; acknowledgement: HandoverAcknowledgementRecord }> {
    const { handover } = await this.getHandoverById(payload.handover_id);
    if (!handover) throw new Error('Handover not found');

    const now = new Date().toISOString();
    const ackId = crypto.randomUUID();

    const ackRecord: HandoverAcknowledgementRecord = {
      id: ackId,
      handover_id: payload.handover_id,
      member_id: payload.member_id,
      version_number: payload.version_number,
      checklist_state: payload.checklist_state,
      comments: payload.comments,
      missing_information_reported: payload.missing_information_reported,
      status: payload.status,
      created_at: now,
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('handover_acknowledgements').insert(ackRecord);

        await supabaseAdmin
          .from('project_handovers')
          .update({
            status: 'ACKNOWLEDGED',
            acknowledged_at: now,
            acknowledged_by: payload.member_id,
            updated_at: now,
          })
          .eq('id', payload.handover_id);
      } catch (err) {
        console.warn('[HandoverStorage] Supabase acknowledgement error:', err);
      }
    }

    handover.status = 'ACKNOWLEDGED';
    handover.acknowledged_at = now;
    handover.acknowledged_by = payload.member_id;
    handover.updated_at = now;

    // Local fallback update
    const saved = readLocalJson<Record<string, ProjectHandoverRecord>>('handovers.json', {});
    saved[payload.handover_id] = handover;
    writeLocalJson('handovers.json', saved);

    const allAcks = readLocalJson<Record<string, HandoverAcknowledgementRecord[]>>('handover_acknowledgements.json', {});
    const acks = allAcks[payload.handover_id] || [];
    acks.unshift(ackRecord);
    allAcks[payload.handover_id] = acks;
    writeLocalJson('handover_acknowledgements.json', allAcks);

    // Notify creator, outgoing member, and reviewer
    const targets = new Set(
      [handover.creator_id, handover.outgoing_member_id, handover.reviewer_id].filter(
        (id): id is string => Boolean(id && id !== payload.member_id)
      )
    );

    for (const recipientId of targets) {
      await this.createNotification({
        handover_id: payload.handover_id,
        recipient_id: recipientId,
        sender_id: payload.member_id,
        type: 'acknowledged',
        title: 'Handover Formally Acknowledged!',
        message: `Incoming team member has acknowledged handover "${handover.title}".`,
      });
    }

    return { handover, acknowledgement: ackRecord };
  },

  /**
   * Add a comment or clarification question.
   */
  async addComment(payload: {
    handover_id: string;
    author_id: string;
    section_key?: string;
    claim_id?: string;
    comment_type?: 'general' | 'review_note' | 'clarification_request' | 'correction';
    content: string;
  }): Promise<HandoverCommentRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: HandoverCommentRecord = {
      id,
      handover_id: payload.handover_id,
      author_id: payload.author_id,
      section_key: payload.section_key,
      claim_id: payload.claim_id,
      comment_type: payload.comment_type || 'general',
      content: payload.content,
      is_resolved: false,
      created_at: now,
      updated_at: now,
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('handover_comments').insert(record);
      } catch (err) {}
    }

    const allComments = readLocalJson<Record<string, HandoverCommentRecord[]>>('handover_comments.json', {});
    const list = allComments[payload.handover_id] || [];
    list.push(record);
    allComments[payload.handover_id] = list;
    writeLocalJson('handover_comments.json', allComments);

    record.authorProfile = await profileStorage.getProfile(payload.author_id);
    return record;
  },

  /**
   * Create a real-time notification record.
   */
  async createNotification(payload: {
    handover_id: string;
    recipient_id: string;
    sender_id?: string;
    type: string;
    title: string;
    message: string;
    metadata?: any;
  }): Promise<HandoverNotificationRecord> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const record: HandoverNotificationRecord = {
      id,
      handover_id: payload.handover_id,
      recipient_id: payload.recipient_id,
      sender_id: payload.sender_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      is_read: false,
      metadata: payload.metadata || {},
      created_at: now,
    };

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('handover_notifications').insert(record);
      } catch (err) {}
    }

    const allNotifs = readLocalJson<Record<string, HandoverNotificationRecord[]>>('handover_notifications.json', {});
    const list = allNotifs[payload.recipient_id] || [];
    list.unshift(record);
    allNotifs[payload.recipient_id] = list.slice(0, 50);
    writeLocalJson('handover_notifications.json', allNotifs);

    return record;
  },

  /**
   * Get notifications for a user.
   */
  async getNotifications(userId: string): Promise<HandoverNotificationRecord[]> {
    let list: HandoverNotificationRecord[] = [];

    if (supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin
          .from('handover_notifications')
          .select('*')
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);

        if (Array.isArray(data)) list = data;
      } catch (err) {}
    }

    if (list.length === 0) {
      const allNotifs = readLocalJson<Record<string, HandoverNotificationRecord[]>>('handover_notifications.json', {});
      list = allNotifs[userId] || [];
    }

    return list;
  },

  /**
   * Mark a notification as read.
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<void> {
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('handover_notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('recipient_id', userId);
      } catch (err) {}
    }

    const allNotifs = readLocalJson<Record<string, HandoverNotificationRecord[]>>('handover_notifications.json', {});
    const userList = allNotifs[userId] || [];
    for (const n of userList) {
      if (n.id === notificationId) {
        n.is_read = true;
      }
    }
    allNotifs[userId] = userList;
    writeLocalJson('handover_notifications.json', allNotifs);
  },
};
