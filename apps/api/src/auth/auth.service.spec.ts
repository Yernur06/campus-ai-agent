import { hash } from 'argon2';
import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { INVALID_CREDENTIALS_MESSAGE } from './auth.constants';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const credentials = {
    id: 'user-1',
    email: 'student@example.edu',
    role: UserRole.STUDENT,
    isActive: true,
    student: { id: 'student-1' },
    teacher: null,
  };
  let prisma: PrismaService;
  let service: AuthService;
  let passwordHash: string;
  let transaction: {
    user: { update: jest.Mock };
    refreshToken: {
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    passwordHash = await hash('correct-password');
    transaction = {
      user: { update: jest.fn().mockResolvedValue({}) },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(
        (operation: (value: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    } as unknown as PrismaService;

    const configService = {
      getOrThrow: (key: string): string => {
        const values: Record<string, string> = {
          JWT_SECRET: 'test-access-secret',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '30d',
        };
        return values[key];
      },
    } as ConfigService;
    service = new AuthService(prisma, new JwtService(), configService);
  });

  it('authenticates a valid user and stores a refresh token hash', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      ...credentials,
      passwordHash,
    } as never);
    const result = await service.login(credentials.email, 'correct-password');

    expect(result.user).toEqual({
      userId: 'user-1',
      email: credentials.email,
      role: UserRole.STUDENT,
      studentId: 'student-1',
    });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    );
    expect(transaction.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: credentials.id,
          tokenHash: expect.not.stringContaining(result.refreshToken),
        }),
      }),
    );
  });

  it('rejects a wrong password with a generic message', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      ...credentials,
      passwordHash,
    } as never);

    await expect(
      service.login(credentials.email, 'wrong-password'),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('rejects an inactive user with a generic message', async () => {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      ...credentials,
      passwordHash,
      isActive: false,
    } as never);

    await expect(
      service.login(credentials.email, 'correct-password'),
    ).rejects.toThrow(INVALID_CREDENTIALS_MESSAGE);
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('revokes a refresh token when rotating it', async () => {
    const initialSession = await createSession();
    transaction.refreshToken.create.mockClear();
    transaction.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(prisma.refreshToken, 'findUnique').mockResolvedValue({
      id: 'refresh-row-1',
      userId: credentials.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: credentials,
    } as never);
    const rotated = await service.refresh(initialSession.refreshToken);

    expect(rotated.refreshToken).not.toBe(initialSession.refreshToken);
    expect(transaction.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'refresh-row-1',
          revokedAt: null,
        }),
      }),
    );
    expect(transaction.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  async function createSession() {
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      ...credentials,
      passwordHash,
    } as never);
    return service.login(credentials.email, 'correct-password');
  }
});
