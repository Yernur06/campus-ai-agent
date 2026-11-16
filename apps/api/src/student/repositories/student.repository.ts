import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const PROFILE_INCLUDE = {
  group: true,
  program: {
    include: {
      department: {
        include: { institute: true },
      },
    },
  },
} satisfies Prisma.StudentInclude;

export type StudentProfileRecord = Prisma.StudentGetPayload<{
  include: typeof PROFILE_INCLUDE;
}>;

@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfile(studentId: string): Promise<StudentProfileRecord | null> {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      include: PROFILE_INCLUDE,
    });
  }

  updatePhoto(studentId: string, photoUrl: string | null): Promise<void> {
    return this.prisma.student
      .update({
        where: { id: studentId },
        data: { photoUrl },
        select: { id: true },
      })
      .then(() => undefined);
  }

  findImportantUnreadNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
        priority: { in: ['HIGH', 'URGENT'] },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 10,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        priority: true,
        createdAt: true,
      },
    });
  }

  findCurrentSemester() {
    return this.prisma.semester.findFirst({
      where: { isCurrent: true },
      orderBy: { number: 'desc' },
      select: { id: true, number: true, startDate: true, endDate: true },
    });
  }
}
