import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ACADEMIC_INCLUDE = {
  enrollments: {
    include: {
      semester: true,
      course: { include: { subject: true } },
      grades: true,
    },
  },
} satisfies Prisma.StudentInclude;

const CURRICULUM_INCLUDE = {
  items: {
    include: {
      subject: true,
      prerequisites: {
        include: { prerequisiteItem: { include: { subject: true } } },
      },
    },
    orderBy: [{ semesterNumber: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.CurriculumInclude;

export type StudentAcademicRecord = Prisma.StudentGetPayload<{
  include: typeof ACADEMIC_INCLUDE;
}>;

export type CurriculumRecord = Prisma.CurriculumGetPayload<{
  include: typeof CURRICULUM_INCLUDE;
}>;

@Injectable()
export class AcademicRepository {
  constructor(private readonly prisma: PrismaService) {}

  findStudentAcademicRecord(
    studentId: string,
  ): Promise<StudentAcademicRecord | null> {
    return this.prisma.student.findUnique({
      where: { id: studentId },
      include: ACADEMIC_INCLUDE,
    });
  }

  findCohortAcademicRecords(
    programId: string,
    course: number,
  ): Promise<StudentAcademicRecord[]> {
    return this.prisma.student.findMany({
      where: { programId, course },
      include: ACADEMIC_INCLUDE,
    });
  }

  findGradeScale() {
    return this.prisma.gradeScale.findMany({
      orderBy: { minScore: 'asc' },
      select: { minScore: true, gpaPoints: true },
    });
  }

  findCurriculum(
    programId: string,
    date: Date,
  ): Promise<CurriculumRecord | null> {
    return this.prisma.curriculum.findFirst({
      where: {
        programId,
        OR: [
          { effectiveFrom: null },
          { effectiveFrom: { lte: date } },
        ],
        AND: [
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: date } },
            ],
          },
        ],
      },
      include: CURRICULUM_INCLUDE,
      orderBy: { effectiveFrom: 'desc' },
    });
  }
}
