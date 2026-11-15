import { createHash, randomUUID } from 'node:crypto';
import { verify } from 'argon2';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuditActorType, UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { INVALID_CREDENTIALS_MESSAGE } from './auth.constants';
import {
  AuthenticationResponse,
  AuthUserResponse,
  AuthenticatedUser,
  JwtRefreshPayload,
} from './auth.types';

const durationUnits: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

function durationInSeconds(duration: string): number {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(duration);
  if (!match) {
    throw new Error('Invalid JWT expiration duration');
  }

  const seconds = Number(match[1]) * durationUnits[match[2]];
  if (!Number.isSafeInteger(seconds)) {
    throw new Error('JWT expiration duration is too large');
  }
  return seconds;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isJwtVerificationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
      error.name,
    )
  );
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.accessTokenTtlSeconds = durationInSeconds(
      configService.getOrThrow<string>('JWT_EXPIRES_IN'),
    );
    this.refreshTokenTtlSeconds = durationInSeconds(
      configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );
  }

  async login(
    email: string,
    password: string,
    ip?: string,
  ): Promise<AuthenticationResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    });

    if (
      !user ||
      !user.isActive ||
      !(await verify(user.passwordHash, password))
    ) {
      await this.auditService.log({
        actorId: null,
        actorType: AuditActorType.SYSTEM,
        action: 'AUTH_LOGIN_FAILURE',
        entityType: 'User',
        before: { email },
        confirmed: false,
        ip,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const responseUser = this.toAuthUser(user);
    const tokens = await this.createTokenPair(responseUser);
    const now = new Date();

    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
      });
      await transaction.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(tokens.refreshToken),
          expiresAt: new Date(
            now.getTime() + this.refreshTokenTtlSeconds * 1000,
          ),
        },
      });
    });
    await this.auditService.log({
      actorId: user.id,
      actorType: AuditActorType.USER,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      after: { lastLoginAt: now.toISOString() },
      confirmed: true,
      ip,
    });

    return { ...tokens, user: responseUser };
  }

  async refresh(
    refreshToken: string,
    ip?: string,
  ): Promise<AuthenticationResponse> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: this.getRefreshSecret(),
          algorithms: ['HS256'],
        },
      );
    } catch (error) {
      if (isJwtVerificationError(error)) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw error;
    }

    if (
      payload.tokenType !== 'refresh' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            student: { select: { id: true } },
            teacher: { select: { id: true } },
          },
        },
      },
    });
    const now = new Date();

    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= now ||
      !storedToken.user.isActive
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = this.toAuthUser(storedToken.user);
    const tokens = await this.createTokenPair(user);
    const nextRefreshExpiresAt = new Date(
      Date.now() + this.refreshTokenTtlSeconds * 1000,
    );

    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await transaction.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: hashToken(tokens.refreshToken),
          expiresAt: nextRefreshExpiresAt,
        },
      });
    });
    await this.auditService.log({
      actorId: storedToken.userId,
      actorType: AuditActorType.USER,
      action: 'AUTH_REFRESH',
      entityType: 'RefreshToken',
      entityId: storedToken.id,
      before: { revoked: false },
      after: { revoked: true, rotated: true },
      confirmed: true,
      ip,
    });

    return { ...tokens, user };
  }

  async logout(
    refreshToken: string,
    authenticatedUserId: string,
    ip?: string,
  ): Promise<{ success: true }> {
    let revoked = 0;
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.refreshToken.updateMany({
        where: {
          userId: authenticatedUserId,
          tokenHash: hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      revoked = result.count;
    });
    if (revoked > 0) {
      await this.auditService.log({
        actorId: authenticatedUserId,
        actorType: AuditActorType.USER,
        action: 'AUTH_LOGOUT',
        entityType: 'RefreshToken',
        before: { revoked: false },
        after: { revoked: true },
        confirmed: true,
        ip,
      });
    }
    return { success: true };
  }

  async getCurrentUser(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        student: { select: { id: true } },
        teacher: { select: { id: true } },
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException();
    }
    return this.toAuthUser(user);
  }

  private async createTokenPair(
    user: AuthUserResponse,
  ): Promise<Omit<AuthenticationResponse, 'user'>> {
    const refreshJti = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.userId, tokenType: 'access' },
        {
          secret: this.getAccessSecret(),
          expiresIn: this.accessTokenTtlSeconds,
          algorithm: 'HS256',
        },
      ),
      this.jwtService.signAsync(
        { sub: user.userId, jti: refreshJti, tokenType: 'refresh' },
        {
          secret: this.getRefreshSecret(),
          expiresIn: this.refreshTokenTtlSeconds,
          algorithm: 'HS256',
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.accessTokenTtlSeconds,
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    role: UserRole;
    student: { id: string } | null;
    teacher: { id: string } | null;
  }): AuthUserResponse {
    const authenticatedUser: AuthenticatedUser = {
      userId: user.id,
      role: user.role,
      ...(user.student ? { studentId: user.student.id } : {}),
      ...(user.teacher ? { teacherId: user.teacher.id } : {}),
    };
    return { ...authenticatedUser, email: user.email };
  }

  private getAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }

  private getRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
}
