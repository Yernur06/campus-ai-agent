import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, from } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { AuditActorType } from '../generated/prisma/enums';
import { AuthenticatedUser } from '../auth/auth.types';
import { AUDITED_METADATA_KEY } from './audit.constants';
import { AuditService } from './audit.service';
import { AuditedMetadata } from './audit.types';

type AuditedRequest = Request & {
  user?: AuthenticatedUser;
  body?: { confirmed?: unknown };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditedMetadata>(
      AUDITED_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    return next.handle().pipe(
      concatMap((result: unknown) =>
        from(
          this.auditService.log({
            actorId: request.user?.userId ?? null,
            actorType: request.user
              ? AuditActorType.USER
              : AuditActorType.SYSTEM,
            action: metadata.action,
            entityType: metadata.entityType,
            entityId: this.getEntityId(result),
            after: result,
            confirmed: request.body?.confirmed === true,
            ip: request.ip,
          }),
        ).pipe(map(() => result)),
      ),
    );
  }

  private getEntityId(result: unknown): string | null {
    if (
      typeof result === 'object' &&
      result !== null &&
      'id' in result &&
      typeof result.id === 'string'
    ) {
      return result.id;
    }
    return null;
  }
}
