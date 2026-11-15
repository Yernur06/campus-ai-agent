import { ExecutionContext } from '@nestjs/common';
import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums';
import { AuthenticatedUser } from '../auth/auth.types';
import { PolicyService } from './policy.service';
import { StudentScopeGuard } from './student-scope';

describe('StudentScopeGuard', () => {
  const assertCanAccessStudent =
    jest.fn<(user: AuthenticatedUser, studentId: string) => Promise<void>>();
  const guard = new StudentScopeGuard({
    assertCanAccessStudent,
  } as unknown as PolicyService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always scopes STUDENT requests to their current student identity', async () => {
    const request: {
      user: AuthenticatedUser;
      params: { studentId: string };
      studentScope?: string;
    } = {
      user: {
        userId: 'user-1',
        role: UserRole.STUDENT,
        studentId: 'owned-student',
      },
      params: { studentId: 'attacker-chosen-student' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.studentScope).toBe('owned-student');
    expect(assertCanAccessStudent).not.toHaveBeenCalled();
  });

  it('authorizes requested student scope for non-students through PolicyService', async () => {
    const request: {
      user: AuthenticatedUser;
      params: { studentId: string };
      studentScope?: string;
    } = {
      user: {
        userId: 'admin-user',
        role: UserRole.ADMIN,
      },
      params: { studentId: 'requested-student' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.studentScope).toBe('requested-student');
    expect(assertCanAccessStudent).toHaveBeenCalledWith(
      request.user,
      'requested-student',
    );
  });
});

function createContext(request: {
  user: AuthenticatedUser;
  params: { studentId: string };
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
