import { jest } from '@jest/globals';
import { AuditActorType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { maskIin, maskIinForUser } from '../shared/mask-iin';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '../generated/prisma/enums';
import { AuditService, sanitizeAuditValue } from './audit.service';

describe('AuditService', () => {
  it('removes credentials and tokens and masks IIN values', async () => {
    const input = {
      password: 'secret',
      passwordHash: 'secret-hash',
      accessToken: 'access-secret',
      nested: {
        refreshToken: 'refresh-secret',
        iin: '123456789012',
      },
    };
    const sanitized = sanitizeAuditValue(input);

    expect(sanitized).toEqual({
      nested: {
        iin: '********9012',
      },
    });
    expect(JSON.stringify(sanitized)).not.toContain('secret');
    expect(JSON.stringify(sanitized)).not.toContain('123456789012');
  });

  it('persists only sanitized before and after values', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new AuditService({
      auditLog: { create },
    } as unknown as PrismaService);

    await service.log({
      actorId: 'user-id',
      actorType: AuditActorType.USER,
      action: 'UPDATE_STUDENT',
      entityType: 'Student',
      before: {
        password: 'secret',
        tokens: ['refresh-secret'],
        IIN: '123456789012',
      },
      confirmed: true,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          before: { IIN: '********9012' },
        }),
      }),
    );
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain('secret');
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(
      '123456789012',
    );
  });

  it('does not throw when audit persistence fails', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn().mockRejectedValue(new Error('database unavailable')),
      },
    } as unknown as PrismaService;
    const service = new AuditService(prisma);

    await expect(
      service.log({
        actorId: null,
        actorType: AuditActorType.SYSTEM,
        action: 'AUTH_LOGIN_FAILURE',
        entityType: 'User',
        before: { email: 'student@example.edu' },
        confirmed: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('masks IIN for non-owners and exposes it only to the owner or ADMIN', () => {
    const student: AuthenticatedUser = {
      userId: 'user-1',
      role: UserRole.STUDENT,
      studentId: 'student-1',
    };
    const otherStudent: AuthenticatedUser = {
      userId: 'user-2',
      role: UserRole.STUDENT,
      studentId: 'student-2',
    };
    const admin: AuthenticatedUser = {
      userId: 'admin-1',
      role: UserRole.ADMIN,
    };

    expect(maskIin('123456789012')).toBe('********9012');
    expect(maskIinForUser('123456789012', 'student-1', student)).toBe(
      '123456789012',
    );
    expect(maskIinForUser('123456789012', 'student-1', otherStudent)).toBe(
      '********9012',
    );
    expect(maskIinForUser('123456789012', 'student-1', admin)).toBe(
      '123456789012',
    );
  });
});
