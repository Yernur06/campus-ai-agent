import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StudentProfileUpdateDto } from './dto/student-profile-update.dto';
import {
  StudentDateQueryDto,
  StudentGradesQueryDto,
  StudentScheduleQueryDto,
} from './dto/student-query.dto';
import { StudentService } from './student.service';

function schemaFor(value: unknown): SchemaObject {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? schemaFor(value[0]) : { type: 'object' },
    };
  }
  if (value === null) {
    return { type: 'string', nullable: true };
  }
  if (typeof value === 'object') {
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          schemaFor(nestedValue),
        ]),
      ),
    };
  }
  return {
    type:
      typeof value === 'number'
        ? 'number'
        : typeof value === 'boolean'
          ? 'boolean'
          : 'string',
  };
}

function studentResponse(example: unknown): MethodDecorator {
  return ApiOkResponse({
    schema: schemaFor(example),
    examples: {
      success: { summary: 'Successful response', value: example },
    },
  });
}

@ApiTags('student')
@ApiBearerAuth()
@Roles(UserRole.STUDENT)
@Controller({ path: 'student', version: '1' })
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the current student profile' })
  @studentResponse({
    photoUrl: 'https://cdn.campus.kz/students/profile.jpg',
    fullName: 'Aruzhan Example',
    studentCode: 'ST-2024-001',
    iin: '********9012',
    group: { id: 'group-id', name: 'SE-24-1', code: 'SE241' },
    course: 3,
    program: { id: 'program-id', name: 'Software Engineering', code: 'SE' },
    institute: { id: 'institute-id', name: 'Institute of Technology' },
    department: { id: 'department-id', name: 'Computer Science', code: 'CS' },
    studyForm: 'FULL_TIME',
    studyLanguage: 'EN',
    academicStatus: 'STUDYING',
    gpa: 3.42,
    earnedCredits: 84,
  })
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getProfile']> {
    return this.studentService.getProfile(user);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update the current student photo URL' })
  @studentResponse({
    photoUrl: 'https://cdn.campus.kz/students/profile.jpg',
    fullName: 'Aruzhan Example',
    studentCode: 'ST-2024-001',
    iin: '********9012',
    group: { id: 'group-id', name: 'SE-24-1', code: 'SE241' },
    course: 3,
    program: { id: 'program-id', name: 'Software Engineering', code: 'SE' },
    institute: { id: 'institute-id', name: 'Institute of Technology' },
    department: { id: 'department-id', name: 'Computer Science', code: 'CS' },
    studyForm: 'FULL_TIME',
    studyLanguage: 'EN',
    academicStatus: 'STUDYING',
    gpa: 3.42,
    earnedCredits: 84,
  })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() update: StudentProfileUpdateDto,
  ): ReturnType<StudentService['updateProfile']> {
    return this.studentService.updateProfile(user, update);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get current student dashboard data' })
  @studentResponse({
    gpa: 3.42,
    currentSemester: {
      id: 'semester-id',
      number: 5,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-01-15T00:00:00.000Z',
    },
    earnedCredits: 84,
    academicDebtsCount: 1,
    nextLessons: [
      {
        date: '2026-11-16',
        lesson: {
          id: 'schedule-id',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:30',
          lessonType: 'LECTURE',
          status: 'ACTIVE',
          subject: { id: 'subject-id', code: 'CS301', name: 'Architecture' },
          classroom: { id: 'room-id', building: 'A', roomNumber: '204' },
          teacher: { id: 'teacher-id', fullName: 'Teacher Example' },
        },
      },
    ],
    importantUnreadNotifications: [],
    attendance: [],
    exams: [],
    assignments: [],
  })
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getDashboard']> {
    return this.studentService.getDashboard(user);
  }

  @Get('academic-profile')
  @ApiOperation({ summary: 'Get academic history, GPA, debts and rating' })
  @studentResponse({
    semesterHistory: [],
    overallGpa: 3.42,
    rating: { rank: 4, total: 28 },
    academicDebts: [],
    curriculumProgress: { totalCredits: 240, earnedCredits: 84, percent: 35 },
  })
  getAcademicProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getAcademicProfile']> {
    return this.studentService.getAcademicProfile(user);
  }

  @Get('curriculum')
  @ApiOperation({ summary: 'Get the curriculum plan and completion progress' })
  @studentResponse({
    years: [
      {
        year: 1,
        semesters: [
          {
            semesterNumber: 1,
            items: [
              {
                id: 'item-id',
                subjectId: 'subject-id',
                code: 'CS101',
                name: 'Introduction to Programming',
                type: 'MANDATORY',
                credits: 3,
                prerequisites: [],
                status: 'PASSED',
              },
            ],
          },
        ],
      },
    ],
    progress: { totalCredits: 240, earnedCredits: 84, percent: 35 },
  })
  getCurriculum(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getCurriculum']> {
    return this.studentService.getCurriculum(user);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get schedule occurrences in a date range' })
  @ApiQuery({ name: 'from', required: true, example: '2026-11-16' })
  @ApiQuery({ name: 'to', required: true, example: '2026-11-22' })
  @studentResponse([
    {
      date: '2026-11-16',
      lesson: {
        id: 'schedule-id',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        lessonType: 'LECTURE',
        status: 'ACTIVE',
        subject: { id: 'subject-id', code: 'CS301', name: 'Architecture' },
        classroom: { id: 'room-id', building: 'A', roomNumber: '204' },
        teacher: { id: 'teacher-id', fullName: 'Teacher Example' },
      },
    },
  ])
  getSchedule(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudentScheduleQueryDto,
  ): ReturnType<StudentService['getSchedule']> {
    return this.studentService.getSchedule(user, query.from, query.to);
  }

  @Get('schedule/today')
  @ApiOperation({ summary: 'Get today’s lessons' })
  @studentResponse([])
  getScheduleToday(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getScheduleToday']> {
    return this.studentService.getScheduleToday(user);
  }

  @Get('schedule/tomorrow')
  @ApiOperation({ summary: 'Get tomorrow’s lessons' })
  @studentResponse([])
  getScheduleTomorrow(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getScheduleTomorrow']> {
    return this.studentService.getScheduleTomorrow(user);
  }

  @Get('schedule/week')
  @ApiOperation({ summary: 'Get this week’s lessons' })
  @studentResponse([])
  getScheduleWeek(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getScheduleWeek']> {
    return this.studentService.getScheduleWeek(user);
  }

  @Get('schedule/free-windows')
  @ApiOperation({ summary: 'Get free windows between lessons for a date' })
  @ApiQuery({ name: 'date', required: true, example: '2026-11-16' })
  @studentResponse({
    date: '2026-11-16',
    windows: [{ startTime: '10:30', endTime: '12:00', durationMinutes: 90 }],
  })
  getFreeWindows(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudentDateQueryDto,
  ): ReturnType<StudentService['getFreeWindows']> {
    return this.studentService.getFreeWindows(user, query.date);
  }

  @Get('grades')
  @ApiOperation({ summary: 'Get grades, optionally filtered by semester' })
  @ApiQuery({ name: 'semesterId', required: false, format: 'uuid' })
  @studentResponse({
    items: [
      {
        enrollmentId: 'enrollment-id',
        semesterId: 'semester-id',
        semesterNumber: 5,
        subject: {
          id: 'subject-id',
          code: 'CS301',
          name: 'Architecture',
          credits: 3,
        },
        status: 'PASSED',
        grades: [
          {
            type: 'FINAL',
            score: 92,
            maxScore: 100,
            letter: 'A-',
            createdAt: '2026-12-10T12:00:00.000Z',
          },
        ],
      },
    ],
  })
  getGrades(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StudentGradesQueryDto,
  ): ReturnType<StudentService['getGrades']> {
    return this.studentService.getGrades(user, query);
  }

  @Get('gpa')
  @ApiOperation({ summary: 'Get GPA by semester and academic trend' })
  @studentResponse({
    overallGpa: 3.42,
    earnedCredits: 84,
    semesters: [{ semesterId: 'semester-id', semesterNumber: 5, gpa: 3.6 }],
    trend: [{ semesterId: 'semester-id', semesterNumber: 5, gpa: 3.6 }],
  })
  getGpa(
    @CurrentUser() user: AuthenticatedUser,
  ): ReturnType<StudentService['getGpa']> {
    return this.studentService.getGpa(user);
  }
}
