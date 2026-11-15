import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  const studentFindFirst =
    jest.fn<(args: unknown) => Promise<{ id: string } | null>>();
  const courseFindUnique =
    jest.fn<
      (args: unknown) => Promise<{ groupId: string; teacherId: string } | null>
    >();
  const courseFindFirst =
    jest.fn<(args: unknown) => Promise<{ id: string } | null>>();
  const prisma = {
    student: { findFirst: studentFindFirst },
    course: { findUnique: courseFindUnique, findFirst: courseFindFirst },
  } as unknown as PrismaService;
  const policy = new PolicyService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a student to access only their own student record', async () => {
    const user: AuthenticatedUser = {
      userId: 'student-user',
      role: UserRole.STUDENT,
      studentId: 'student-1',
    };

    await expect(policy.canAccessStudent(user, 'student-1')).resolves.toBe(
      true,
    );
    await expect(policy.canAccessStudent(user, 'student-2')).resolves.toBe(
      false,
    );
    expect(studentFindFirst).not.toHaveBeenCalled();
  });

  it('allows a curator to access only assigned students', async () => {
    const user: AuthenticatedUser = {
      userId: 'curator-user',
      role: UserRole.CURATOR,
      teacherId: 'teacher-1',
    };
    studentFindFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce(null);

    await expect(policy.canAccessStudent(user, 'student-1')).resolves.toBe(
      true,
    );
    await expect(policy.canAccessStudent(user, 'student-2')).resolves.toBe(
      false,
    );
    expect(studentFindFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'student-1', curatorId: 'teacher-1' },
      }),
    );
  });

  it('allows a teacher to access students in groups they teach', async () => {
    const user: AuthenticatedUser = {
      userId: 'teacher-user',
      role: UserRole.TEACHER,
      teacherId: 'teacher-1',
    };
    studentFindFirst
      .mockResolvedValueOnce({ id: 'student-1' })
      .mockResolvedValueOnce(null);

    await expect(policy.canAccessStudent(user, 'student-1')).resolves.toBe(
      true,
    );
    await expect(policy.canAccessStudent(user, 'student-2')).resolves.toBe(
      false,
    );
    expect(studentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'student-1',
          group: { courses: { some: { teacherId: 'teacher-1' } } },
        },
      }),
    );
  });

  it('allows administrators to access any student', async () => {
    const user: AuthenticatedUser = {
      userId: 'admin-user',
      role: UserRole.ADMIN,
    };

    await expect(policy.canAccessStudent(user, 'student-1')).resolves.toBe(
      true,
    );
    expect(studentFindFirst).not.toHaveBeenCalled();
  });

  it('restricts group access to students in their own group and allows assigned teachers', async () => {
    const student: AuthenticatedUser = {
      userId: 'student-user',
      role: UserRole.STUDENT,
      studentId: 'student-1',
    };
    studentFindFirst.mockResolvedValueOnce({ id: 'student-1' });
    await expect(policy.canAccessGroup(student, 'group-1')).resolves.toBe(true);

    const teacher: AuthenticatedUser = {
      userId: 'teacher-user',
      role: UserRole.TEACHER,
      teacherId: 'teacher-1',
    };
    courseFindFirst
      .mockResolvedValueOnce({ id: 'course-1' })
      .mockResolvedValueOnce(null);
    await expect(policy.canAccessGroup(teacher, 'group-1')).resolves.toBe(true);
    await expect(policy.canAccessGroup(teacher, 'group-2')).resolves.toBe(
      false,
    );
  });

  it('restricts course access to the assigned teacher or an authorized student', async () => {
    const teacher: AuthenticatedUser = {
      userId: 'teacher-user',
      role: UserRole.TEACHER,
      teacherId: 'teacher-1',
    };
    courseFindUnique.mockResolvedValueOnce({
      groupId: 'group-1',
      teacherId: 'teacher-1',
    });
    await expect(policy.canAccessCourse(teacher, 'course-1')).resolves.toBe(
      true,
    );

    const student: AuthenticatedUser = {
      userId: 'student-user',
      role: UserRole.STUDENT,
      studentId: 'student-1',
    };
    courseFindUnique.mockResolvedValueOnce({
      groupId: 'group-1',
      teacherId: 'teacher-1',
    });
    studentFindFirst.mockResolvedValueOnce(null);
    await expect(policy.canAccessCourse(student, 'course-1')).resolves.toBe(
      false,
    );
  });
});
