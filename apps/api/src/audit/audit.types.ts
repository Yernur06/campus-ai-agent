import { AuditActorType } from '../generated/prisma/enums';

export interface AuditLogQuery {
  actorId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface AuditLogInput {
  actorId: string | null;
  actorType: AuditActorType;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  confirmed: boolean;
  ip?: string | null;
}

export interface AuditedMetadata {
  action: string;
  entityType: string;
}
