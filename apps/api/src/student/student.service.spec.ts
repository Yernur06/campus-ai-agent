import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { UserRole } from '../generated/prisma/enums';
import { PolicyService } from '../policy/policy.service';
import { AcademicRepository } from './repositories/academic.repository';
import { ScheduleRepository } from './repositories/schedule.repository';
import { StudentRepository } from './repositories/student.repository';
import { StudentService } from './student.service';
import { AuditService } from '../audit/audit.service';

describe('StudentService ownership', () => {
  it('queries only the authenticated student and checks that same identity with policy', async () => {
    const findProfile = jest.fn().mockResolvedValue(null);
    const findStudentAcademicRecord = jest.fn().mockResolvedValue(null);
    const assertCanAccessStudent = jest.fn().mockImplementation(
      async (user: { studentId?: string }, studentId: string) => {
        if (user.studentId !== studentId) {
          throw new ForbiddenException();
        }
      },
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: StudentRepository, useValue: { findProfile } },
        {
          provide: AcademicRepository,
          useValue: { findStudentAcademicRecord },
        },
        { provide: ScheduleRepository, useValue: {} },
        {
          provide: PolicyService,
          useValue: { assertCanAccessStudent },
        },
        { provide: AuditService, useValue: {} },
      ],
    }).compile();
    const service = moduleRef.get(StudentService);
    const user = {
      userId: 'user-a',
      role: UserRole.STUDENT,
      studentId: 'student-a',
    };

    await expect(service.getProfile(user)).rejects.toThrow(
      'Student profile not found',
    );
    expect(assertCanAccessStudent).toHaveBeenCalledWith(user, 'student-a');
    expect(findProfile).toHaveBeenCalledWith('student-a');
    expect(findStudentAcademicRecord).toHaveBeenCalledWith('student-a');

    await moduleRef.close();
  });
});
