import { hash } from 'argon2';
import { jest } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  VersioningType,
  ValidationPipe,
} from '@nestjs/common';
import { UserRole } from '../src/generated/prisma/enums';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { PrismaService } from '../src/prisma/prisma.service';
import request from 'supertest';
import { App } from 'supertest/types';

@Controller({ path: 'test/admin-only', version: '1' })
class AdminOnlyTestController {
  @Get()
  @Roles(UserRole.ADMIN)
  getAdminResource(): { allowed: true } {
    return { allowed: true };
  }
}

describe('Authentication and RBAC (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let accessToken: string;
  const credentials = {
    email: 'student@example.edu',
    password: 'e2e-password',
  };
  let databaseUser: {
    id: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    isActive: boolean;
    student: { id: string };
    teacher: null;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
    process.env.JWT_SECRET ??= 'test-access-secret-for-e2e';
    process.env.JWT_EXPIRES_IN ??= '15m';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-for-e2e';
    process.env.JWT_REFRESH_EXPIRES_IN ??= '30d';
    process.env.LLM_PROVIDER ??= 'test';
    process.env.LLM_API_KEY ??= 'test-api-key';
    process.env.LLM_MODEL ??= 'test-model';
    process.env.WEB_URL ??= 'http://localhost:3000';
    const { AppModule } = await import('../src/app.module');

    databaseUser = {
      id: 'student-user-id',
      email: credentials.email,
      passwordHash: await hash(credentials.password),
      role: UserRole.STUDENT,
      isActive: true,
      student: { id: 'student-id' },
      teacher: null,
    };

    const transactionMock = {
      user: {
        update: jest.fn(async () => databaseUser),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prismaMock = {
      user: {
        findUnique: jest.fn(async () => databaseUser),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(
        async (
          operation: (value: typeof transactionMock) => Promise<unknown>,
        ) => operation(transactionMock),
      ),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminOnlyTestController],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  it('keeps the existing root endpoint public', async () => {
    await request(app!.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });

  it('rejects unauthenticated access to /auth/me', async () => {
    await request(app!.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('logs in and returns the safe authenticated profile from /auth/me', async () => {
    const login = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(201);
    accessToken = login.body.accessToken as string;
    expect(typeof accessToken).toBe('string');

    const profile = await request(app!.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profile.body).toEqual({
      userId: 'student-user-id',
      email: credentials.email,
      role: UserRole.STUDENT,
      studentId: 'student-id',
    });
    expect(profile.body).not.toHaveProperty('passwordHash');
  });

  it('forbids a student from an ADMIN-only test endpoint', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/test/admin-only')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  afterAll(async () => {
    await app?.close();
  });
});
