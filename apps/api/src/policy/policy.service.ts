import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

const ACCESS_DENIED_MESSAGE = 'You are not allowed to access this resource';

@Injectable()
export class PolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async canAccessStudent(
    user: AuthenticatedUser,
    studentId: string,
  ): Promise<boolean> {
    switch (user.role) {
      case UserRole.ADMIN:
      case UserRole.DEAN_OFFICE:
        return true;
      case UserRole.STUDENT:
        return user.studentId === studentId;
      case UserRole.CURATOR:
        return (
          user.teacherId !== undefined &&
          (await this.prisma.student.findFirst({
            where: { id: studentId, curatorId: user.teacherId },
            select: { id: true },
          })) !== null
        );
      case UserRole.TEACHER:
        return (
          user.teacherId !== undefined &&
          (await this.prisma.student.findFirst({
            where: {
              id: studentId,
              group: { courses: { some: { teacherId: user.teacherId } } },
            },
            select: { id: true },
          })) !== null
        );
    }
    return false;
  }

  async canAccessCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<boolean> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.DEAN_OFFICE) {
      return true;
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { groupId: true, teacherId: true },
    });
    if (!course) {
      return false;
    }

    switch (user.role) {
      case UserRole.STUDENT:
        return (
          user.studentId !== undefined &&
          (await this.prisma.student.findFirst({
            where: { id: user.studentId, groupId: course.groupId },
            select: { id: true },
          })) !== null
        );
      case UserRole.CURATOR:
        return (
          user.teacherId !== undefined &&
          (await this.prisma.student.findFirst({
            where: { groupId: course.groupId, curatorId: user.teacherId },
            select: { id: true },
          })) !== null
        );
      case UserRole.TEACHER:
        return user.teacherId === course.teacherId;
    }
    return false;
  }

  async canAccessGroup(
    user: AuthenticatedUser,
    groupId: string,
  ): Promise<boolean> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.DEAN_OFFICE) {
      return true;
    }

    switch (user.role) {
      case UserRole.STUDENT:
        return (
          user.studentId !== undefined &&
          (await this.prisma.student.findFirst({
            where: { id: user.studentId, groupId },
            select: { id: true },
          })) !== null
        );
      case UserRole.CURATOR:
        return (
          user.teacherId !== undefined &&
          (await this.prisma.student.findFirst({
            where: { groupId, curatorId: user.teacherId },
            select: { id: true },
          })) !== null
        );
      case UserRole.TEACHER:
        return (
          user.teacherId !== undefined &&
          (await this.prisma.course.findFirst({
            where: { groupId, teacherId: user.teacherId },
            select: { id: true },
          })) !== null
        );
    }
    return false;
  }

  async assertCanAccessStudent(
    user: AuthenticatedUser,
    studentId: string,
  ): Promise<void> {
    if (!(await this.canAccessStudent(user, studentId))) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }

  async assertCanAccessCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<void> {
    if (!(await this.canAccessCourse(user, courseId))) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }

  async assertCanAccessGroup(
    user: AuthenticatedUser,
    groupId: string,
  ): Promise<void> {
    if (!(await this.canAccessGroup(user, groupId))) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }
}
