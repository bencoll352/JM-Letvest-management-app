export type WorkspaceRole = 'owner' | 'manager' | 'viewer' | 'resident';

export type WorkspaceAction =
  | 'portfolio.read'
  | 'draft.create'
  | 'draft.approve'
  | 'record.mutate'
  | 'audit.read'
  | 'resident.report_fault'
  | 'resident.read_own_lease';

const ROLE_PERMISSIONS: Record<WorkspaceRole, ReadonlySet<WorkspaceAction>> = {
  owner: new Set([
    'portfolio.read',
    'draft.create',
    'draft.approve',
    'record.mutate',
    'audit.read',
    'resident.report_fault',
    'resident.read_own_lease'
  ]),
  manager: new Set([
    'portfolio.read',
    'draft.create'
  ]),
  viewer: new Set([
    'portfolio.read'
  ]),
  resident: new Set([
    'resident.report_fault',
    'resident.read_own_lease'
  ])
};

export function canPerformWorkspaceAction(role: WorkspaceRole | null | undefined, action: WorkspaceAction): boolean {
  if (!role || !ROLE_PERMISSIONS[role]) return false;
  return ROLE_PERMISSIONS[role].has(action);
}

export function buildAuditEntry(input: {
  workspaceId: string;
  actorId: string;
  actorRole: WorkspaceRole;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  timestampIso?: string;
}) {
  if (!canPerformWorkspaceAction(input.actorRole, 'record.mutate') && input.actorRole !== 'resident') {
    throw new Error(`Role "${input.actorRole}" is not permitted to mutate table "${input.tableName}" directly`);
  }
  return Object.freeze({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    tableName: input.tableName,
    recordId: input.recordId,
    action: input.action,
    beforeData: input.beforeData,
    afterData: input.afterData,
    createdAt: input.timestampIso || new Date().toISOString()
  });
}
