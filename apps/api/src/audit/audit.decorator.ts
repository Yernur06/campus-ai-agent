import { SetMetadata } from '@nestjs/common';
import { AUDITED_METADATA_KEY } from './audit.constants';
import { AuditedMetadata } from './audit.types';

export const Audited = (
  action: string,
  entityType: string,
): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDITED_METADATA_KEY, {
    action,
    entityType,
  } satisfies AuditedMetadata);
