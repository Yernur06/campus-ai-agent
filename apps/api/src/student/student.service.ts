import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActorType, GradeType, UserRole } from '../generated/prisma/enums';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policy/policy.service';
import { maskIin } from '../shared/mask-iin';
import { AcademicDebtService } from './domain/academic-debt.service';
import { CurriculumProgressService } from './domain/curriculum-progress.service';
import { GpaCalculator, GradeAttempt, GradeScaleEntry } from './domain/gpa-calculator';
import { ScheduleService } from './domain/schedule.service';
import { StudentProfileUpdateDto } from './dto/student-profile-update.dto';
import { StudentGradesQueryDto } from './dto/student-query.dto';
import { AcademicRepository, StudentAcademicRecord } from './repositories/academic.repository';
import { ScheduleRecord, ScheduleRepository } from './repositories/schedule.repository';
import { StudentRepository, StudentProfileRecord } from './repositories/student.repository';
import {
  FreeWindowsResponse,
  ScheduleLesson,
  ScheduleOccurrence,
  StudentAcademicProfileResponse,
  StudentCurriculumResponse,
  StudentDashboardResponse,
  StudentGpaResponse,
  StudentGradesResponse,
  StudentProfileResponse,
} from './student.types';

@Injectable()
export class StudentService {
  private readonly gpaCalculator = new GpaCalculator();
  private readonly curriculumProgress = new CurriculumProgressService();
  private readonly academicDebtService = new AcademicDebtService();
  private readonly scheduleDomain = new ScheduleService();

  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly academicRepository: AcademicRepository,
    private readonly scheduleRepository: ScheduleRepository,
    private readonly policyService: PolicyService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(user: AuthenticatedUser): Promise<StudentProfileResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const [student, academic] = await Promise.all([
      this.requireProfile(studentId),
      this.requireAcademic(studentId),
    ]);
    const [gradeScale] = await Promise.all([this.getGradeScale()]);
    const gpa = this.gpaCalculator.calculate(
      this.gradeAttempts(academic),
      gradeScale,
    );
    return this.mapProfile(student, gpa.gpa, gpa.earnedCredits);
  }

  async updateProfile(
    user: AuthenticatedUser,
    update: StudentProfileUpdateDto,
  ): Promise<StudentProfileResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const before = await this.requireProfile(studentId);
    await this.studentRepository.updatePhoto(
      studentId,
      update.photoUrl === undefined ? before.photoUrl : update.photoUrl,
    );
    await this.auditService.log({
      actorId: user.userId,
      actorType: AuditActorType.USER,
      action: 'student.profile.photo_updated',
      entityType: 'Student',
      entityId: studentId,
      before: { photoUrl: before.photoUrl },
      after: {
        photoUrl: update.photoUrl === undefined ? before.photoUrl : update.photoUrl,
      },
      confirmed: true,
    });
    return this.getProfile(user);
  }

  async getDashboard(user: AuthenticatedUser): Promise<StudentDashboardResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const student = await this.requireProfile(studentId);
    const academic = await this.requireAcademic(studentId);
    const [gradeScale, currentSemester, notifications, scheduleRecords] =
      await Promise.all([
        this.getGradeScale(),
        this.studentRepository.findCurrentSemester(),
        this.studentRepository.findImportantUnreadNotifications(user.userId),
        this.scheduleRepository.findByGroup(student.groupId),
      ]);
    const attempts = this.gradeAttempts(academic);
    const gpa = this.gpaCalculator.calculate(attempts, gradeScale);
    const debts = this.getDebts(academic, gradeScale);
    const today = this.today();
    const nowTime = new Date().toISOString().slice(11, 16);
    const end = this.addDays(today, 14);
    const upcoming = this.scheduleDomain.between(
      this.mapScheduleRecords(scheduleRecords),
      today,
      end,
    );
    const nextLessons = upcoming
      .filter(
        ({ date, lesson }) =>
          date > today || (date === today && lesson.startTime >= nowTime),
      )
      .slice(0, 3);

    return {
      gpa: gpa.gpa,
      currentSemester,
      earnedCredits: gpa.earnedCredits,
      academicDebtsCount: debts.length,
      nextLessons,
      importantUnreadNotifications: notifications,
      attendance: [],
      exams: [],
      assignments: [],
    };
  }

  async getAcademicProfile(
    user: AuthenticatedUser,
  ): Promise<StudentAcademicProfileResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const academic = await this.requireAcademic(studentId);
    const gradeScale = await this.getGradeScale();
    const attempts = this.gradeAttempts(academic);
    const overall = this.gpaCalculator.calculate(attempts, gradeScale);
    const [cohort, curriculum] = await Promise.all([
      this.academicRepository.findCohortAcademicRecords(
        academic.programId,
        academic.course,
      ),
      this.academicRepository.findCurriculum(academic.programId, new Date()),
    ]);
    const cohortGpas = cohort
      .map((record) =>
        this.gpaCalculator.calculate(this.gradeAttempts(record), gradeScale),
      )
      .map((result) => result.gpa);
    const debts = this.getDebts(academic, gradeScale);
    const curriculumResult = curriculum
      ? this.calculateCurriculum(curriculum, academic, gradeScale)
      : { totalCredits: 0, earnedCredits: 0, percent: 0 };
    const semesterHistory = this.semesterHistory(academic, gradeScale);

    return {
      semesterHistory,
      overallGpa: overall.gpa,
      rating: {
        rank: 1 + cohortGpas.filter((gpa) => gpa > overall.gpa).length,
        total: cohortGpas.length,
      },
      academicDebts: debts.map((debt) => {
        const subject = academic.enrollments.find(
          (enrollment) => enrollment.course.subject.id === debt.subjectId,
        )?.course.subject;
        return {
          subjectId: debt.subjectId,
          code: subject?.code ?? '',
          name: subject?.name ?? '',
        };
      }),
      curriculumProgress: curriculumResult,
    };
  }

  async getCurriculum(user: AuthenticatedUser): Promise<StudentCurriculumResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const academic = await this.requireAcademic(studentId);
    const curriculum = await this.academicRepository.findCurriculum(
      academic.programId,
      new Date(),
    );
    if (!curriculum) {
      return {
        years: [],
        progress: { totalCredits: 0, earnedCredits: 0, percent: 0 },
      };
    }

    const progress = this.calculateCurriculum(
      curriculum,
      academic,
      await this.getGradeScale(),
    );
    const years = new Map<number, Map<number, StudentCurriculumResponse['years'][number]['semesters'][number]['items']>>();

    for (const [index, item] of curriculum.items.entries()) {
      const year = Math.ceil(item.semesterNumber / 2);
      let semesters = years.get(year);
      if (!semesters) {
        semesters = new Map();
        years.set(year, semesters);
      }
      const semesterItems =
        semesters.get(item.semesterNumber) ?? [];
      const itemStatus = progress.items[index];
      semesterItems.push({
        id: item.id,
        subjectId: item.subjectId,
        code: item.subject.code,
        name: item.subject.name,
        type: item.type,
        credits: Number(item.credits),
        prerequisites: item.prerequisites.map(({ prerequisiteItem }) => ({
          id: prerequisiteItem.id,
          code: prerequisiteItem.subject.code,
          name: prerequisiteItem.subject.name,
        })),
        status: itemStatus.status,
      });
      semesters.set(item.semesterNumber, semesterItems);
    }

    return {
      years: [...years.entries()]
        .sort(([yearA], [yearB]) => yearA - yearB)
        .map(([year, semesters]) => ({
          year,
          semesters: [...semesters.entries()]
            .sort(([semesterA], [semesterB]) => semesterA - semesterB)
            .map(([semesterNumber, items]) => ({ semesterNumber, items })),
        })),
      progress: {
        totalCredits: progress.totalCredits,
        earnedCredits: progress.earnedCredits,
        percent: progress.percent,
      },
    };
  }

  async getSchedule(
    user: AuthenticatedUser,
    from: string,
    to: string,
  ): Promise<ScheduleOccurrence[]> {
    const studentId = await this.getOwnedStudentId(user);
    const student = await this.requireProfile(studentId);
    const entries = this.mapScheduleRecords(
      await this.scheduleRepository.findByGroup(student.groupId),
    );
    try {
      return this.scheduleDomain.between(entries, from, to);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  async getScheduleToday(user: AuthenticatedUser): Promise<ScheduleLesson[]> {
    return this.getScheduleForDate(user, this.today());
  }

  async getScheduleTomorrow(user: AuthenticatedUser): Promise<ScheduleLesson[]> {
    return this.getScheduleForDate(user, this.addDays(this.today(), 1));
  }

  async getScheduleWeek(user: AuthenticatedUser): Promise<ScheduleOccurrence[]> {
    const studentId = await this.getOwnedStudentId(user);
    const student = await this.requireProfile(studentId);
    return this.scheduleDomain.forWeek(
      this.mapScheduleRecords(
        await this.scheduleRepository.findByGroup(student.groupId),
      ),
      this.today(),
    );
  }

  async getFreeWindows(
    user: AuthenticatedUser,
    date: string,
  ): Promise<FreeWindowsResponse> {
    const lessons = await this.getScheduleForDate(user, date);
    return { date, windows: this.scheduleDomain.freeWindows(lessons) };
  }

  async getGrades(
    user: AuthenticatedUser,
    query: StudentGradesQueryDto,
  ): Promise<StudentGradesResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const academic = await this.requireAcademic(studentId);
    return {
      items: academic.enrollments
        .filter(
          (enrollment) =>
            query.semesterId === undefined ||
            enrollment.semesterId === query.semesterId,
        )
        .sort(
          (a, b) =>
            a.semester.number - b.semester.number ||
            a.course.subject.name.localeCompare(b.course.subject.name),
        )
        .map((enrollment) => ({
          enrollmentId: enrollment.id,
          semesterId: enrollment.semesterId,
          semesterNumber: enrollment.semester.number,
          subject: {
            id: enrollment.course.subject.id,
            code: enrollment.course.subject.code,
            name: enrollment.course.subject.name,
            credits: Number(enrollment.course.subject.credits),
          },
          status: enrollment.status,
          grades: enrollment.grades
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((grade) => ({
              type: grade.type,
              score: Number(grade.score),
              maxScore: Number(grade.maxScore),
              letter: grade.letter,
              createdAt: grade.createdAt,
            })),
        })),
    };
  }

  async getGpa(user: AuthenticatedUser): Promise<StudentGpaResponse> {
    const studentId = await this.getOwnedStudentId(user);
    const academic = await this.requireAcademic(studentId);
    const gradeScale = await this.getGradeScale();
    const attempts = this.gradeAttempts(academic);
    const overall = this.gpaCalculator.calculate(attempts, gradeScale);
    const semesters = new Map<
      string,
      { semesterNumber: number; attempts: GradeAttempt[] }
    >();
    for (const enrollment of academic.enrollments) {
      const current = semesters.get(enrollment.semesterId) ?? {
        semesterNumber: enrollment.semester.number,
        attempts: [],
      };
      current.attempts.push(
        this.gradeAttempt(enrollment),
      );
      semesters.set(enrollment.semesterId, current);
    }
    const semesterResults = [...semesters.entries()]
      .map(([semesterId, entry]) => ({
        semesterId,
        semesterNumber: entry.semesterNumber,
        gpa: this.gpaCalculator.calculate(entry.attempts, gradeScale).gpa,
      }))
      .sort((a, b) => a.semesterNumber - b.semesterNumber);

    return {
      overallGpa: overall.gpa,
      earnedCredits: overall.earnedCredits,
      semesters: semesterResults,
      trend: semesterResults.map(({ semesterId, semesterNumber, gpa }) => ({
        semesterId,
        semesterNumber,
        gpa,
      })),
    };
  }

  private async getScheduleForDate(
    user: AuthenticatedUser,
    date: string,
  ): Promise<ScheduleLesson[]> {
    const studentId = await this.getOwnedStudentId(user);
    const student = await this.requireProfile(studentId);
    try {
      return this.scheduleDomain.forDay(
        this.mapScheduleRecords(
          await this.scheduleRepository.findByGroup(student.groupId),
        ),
        date,
      );
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async getOwnedStudentId(user: AuthenticatedUser): Promise<string> {
    if (user.role !== UserRole.STUDENT || !user.studentId) {
      throw new ForbiddenException('You are not allowed to access this resource');
    }
    await this.policyService.assertCanAccessStudent(user, user.studentId);
    return user.studentId;
  }

  private async requireProfile(studentId: string): Promise<StudentProfileRecord> {
    const student = await this.studentRepository.findProfile(studentId);
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
    return student;
  }

  private async requireAcademic(
    studentId: string,
  ): Promise<StudentAcademicRecord> {
    const student =
      await this.academicRepository.findStudentAcademicRecord(studentId);
    if (!student) {
      throw new NotFoundException('Student academic profile not found');
    }
    return student;
  }

  private async getGradeScale(): Promise<GradeScaleEntry[]> {
    const entries = await this.academicRepository.findGradeScale();
    return entries.map((entry) => ({
      minScore: Number(entry.minScore),
      gpaPoints: Number(entry.gpaPoints),
    }));
  }

  private gradeAttempts(student: StudentAcademicRecord): GradeAttempt[] {
    return student.enrollments.map((enrollment) =>
      this.gradeAttempt(enrollment),
    );
  }

  private gradeAttempt(
    enrollment: StudentAcademicRecord['enrollments'][number],
  ): GradeAttempt {
    const finalGrade = enrollment.grades.find(
      (grade) => grade.type === GradeType.FINAL,
    );
    return {
      subjectId: enrollment.course.subjectId,
      semesterId: enrollment.semesterId,
      credits: Number(enrollment.course.subject.credits),
      createdAt: enrollment.createdAt,
      finalScore: finalGrade ? Number(finalGrade.score) : null,
    };
  }

  private getDebts(
    student: StudentAcademicRecord,
    gradeScale: readonly GradeScaleEntry[],
  ): Array<{ subjectId: string; createdAt: Date }> {
    return this.academicDebtService.findDebts(
      student.enrollments.map((enrollment) => {
        const finalGrade = enrollment.grades.find(
          (grade) => grade.type === GradeType.FINAL,
        );
        return {
          subjectId: enrollment.course.subjectId,
          createdAt: enrollment.createdAt,
          enrollmentStatus: enrollment.status,
          finalGpaPoints: finalGrade
            ? this.gpaCalculator.pointsFor(Number(finalGrade.score), gradeScale)
            : null,
        };
      }),
    );
  }

  private calculateCurriculum(
    curriculum: NonNullable<
      Awaited<ReturnType<AcademicRepository['findCurriculum']>>
    >,
    student: StudentAcademicRecord,
    gradeScale: readonly GradeScaleEntry[],
  ) {
    const latestEnrollment = new Map<
      string,
      StudentAcademicRecord['enrollments'][number]
    >();
    for (const enrollment of student.enrollments) {
      const subjectId = enrollment.course.subjectId;
      const current = latestEnrollment.get(subjectId);
      if (!current || enrollment.createdAt > current.createdAt) {
        latestEnrollment.set(subjectId, enrollment);
      }
    }

    return this.curriculumProgress.calculate(
      curriculum.items.map((item) => {
        const enrollment = latestEnrollment.get(item.subjectId);
        const finalGrade = enrollment?.grades.find(
          (grade) => grade.type === GradeType.FINAL,
        );
        let enrollmentStatus = enrollment?.status;
        if (finalGrade) {
          enrollmentStatus =
            this.gpaCalculator.pointsFor(
              Number(finalGrade.score),
              gradeScale,
            ) > 0
              ? 'PASSED'
              : 'FAILED';
        }
        return {
          id: item.id,
          credits: Number(item.credits),
          prerequisiteIds: item.prerequisites.map(
            ({ prerequisiteItemId }) => prerequisiteItemId,
          ),
          enrollmentStatus,
        };
      }),
    );
  }

  private semesterHistory(
    student: StudentAcademicRecord,
    gradeScale: readonly GradeScaleEntry[],
  ): StudentAcademicProfileResponse['semesterHistory'] {
    const semesters = new Map<
      string,
      StudentAcademicRecord['enrollments']
    >();
    for (const enrollment of student.enrollments) {
      const records = semesters.get(enrollment.semesterId) ?? [];
      records.push(enrollment);
      semesters.set(enrollment.semesterId, records);
    }

    return [...semesters.entries()]
      .map(([semesterId, enrollments]) => {
        const semester = enrollments[0].semester;
        const attempts = enrollments.map((enrollment) =>
          this.gradeAttempt(enrollment),
        );
        const subjects = enrollments.map((enrollment) => ({
          subjectId: enrollment.course.subjectId,
          code: enrollment.course.subject.code,
          name: enrollment.course.subject.name,
          credits: Number(enrollment.course.subject.credits),
          status: enrollment.status,
          grades: enrollment.grades.map((grade) => ({
            type: grade.type,
            score: Number(grade.score),
            maxScore: Number(grade.maxScore),
            letter: grade.letter,
          })),
        }));
        return {
          semesterId,
          semesterNumber: semester.number,
          startDate: semester.startDate,
          endDate: semester.endDate,
          gpa: this.gpaCalculator.calculate(attempts, gradeScale).gpa,
          subjects,
          passedSubjects: enrollments.filter(
            (enrollment) => enrollment.status === 'PASSED',
          ).length,
          notPassedSubjects: enrollments.filter(
            (enrollment) => enrollment.status !== 'PASSED',
          ).length,
        };
      })
      .sort((a, b) => a.semesterNumber - b.semesterNumber);
  }

  private mapProfile(
    student: StudentProfileRecord,
    gpa: number,
    earnedCredits: number,
  ): StudentProfileResponse {
    return {
      photoUrl: student.photoUrl,
      fullName: student.fullName,
      studentCode: student.studentCode,
      iin: maskIin(student.iin) ?? null,
      group: {
        id: student.group.id,
        name: student.group.name,
        code: student.group.code,
      },
      course: student.course,
      program: {
        id: student.program.id,
        name: student.program.name,
        code: student.program.code,
      },
      institute: {
        id: student.program.department.institute.id,
        name: student.program.department.institute.name,
      },
      department: {
        id: student.program.department.id,
        name: student.program.department.name,
        code: student.program.department.code,
      },
      studyForm: student.studyForm,
      studyLanguage: student.studyLanguage,
      academicStatus: student.academicStatus,
      gpa,
      earnedCredits,
    };
  }

  private mapScheduleRecords(records: readonly ScheduleRecord[]): ScheduleLesson[] {
    return records.map((record) => ({
      id: record.id,
      dayOfWeek:
        ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].indexOf(
          record.dayOfWeek,
        ) + 1,
      startTime: this.formatTime(record.startTime),
      endTime: this.formatTime(record.endTime),
      lessonType: record.lessonType,
      status: record.status,
      subject: {
        id: record.course.subject.id,
        code: record.course.subject.code,
        name: record.course.subject.name,
      },
      classroom: {
        id: record.classroom.id,
        building: record.classroom.building,
        roomNumber: record.classroom.roomNumber,
      },
      teacher: { id: record.teacher.id, fullName: record.teacher.fullName },
    }));
  }

  private formatTime(value: Date): string {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(
      value.getUTCMinutes(),
    ).padStart(2, '0')}`;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }
}
