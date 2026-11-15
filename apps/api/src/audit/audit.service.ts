import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { maskIin } from '../shared/mask-iin';
import { AuditLogInput, AuditLogQuery } from './audit.types';

const sensitiveKeyPattern = /(password|token)/i;

type SanitizedJsonValue = Prisma.InputJsonValue | null;

export function sanitizeAuditValue(
  value: unknown,
): SanitizedJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item) ?? null);
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, SanitizedJsonValue> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (sensitiveKeyPattern.test(key)) {
        continue;
      }
      const outputValue =
        key.toLowerCase() === 'iin' &&
        (typeof nestedValue === 'string' || typeof nestedValue === 'number')
          ? maskIin(String(nestedValue))
          : sanitizeAuditValue(nestedValue);
      if (outputValue !== undefined) {
        sanitized[key] = outputValue;
      }
    }
    return sanitized;
  }
  return typeof value === 'symbol' ? value.toString() : '[unsupported value]';
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId,
          actorType: input.actorType,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          before: this.toPrismaJson(input.before),
          after: this.toPrismaJson(input.after),
          confirmed: input.confirmed,
          ip: input.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${input.action} on ${input.entityType}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private toPrismaJson(
    value: unknown,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    const sanitized = sanitizeAuditValue(value);
    return sanitized === null ? Prisma.JsonNull : sanitized;
  }

  async findLogs(query: AuditLogQuery): Promise<{
    items: Prisma.AuditLogGetPayload<object>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: query.page, limit: query.limit };
  }
}
