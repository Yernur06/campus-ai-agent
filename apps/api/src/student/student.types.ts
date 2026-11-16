import type { CurriculumStatus } from './domain/curriculum-progress.service';
import type { FreeWindow } from './domain/schedule.service';

export interface StudentProfileResponse {
  photoUrl: string | null;
  fullName: string;
  studentCode: string;
  iin: string | null;
  group: { id: string; name: string; code: string };
  course: number;
  program: { id: string; name: string; code: string };
  institute: { id: string; name: string };
  department: { id: string; name: string; code: string };
  studyForm: string;
  studyLanguage: string;
  academicStatus: string;
  gpa: number;
  earnedCredits: number;
}

export interface ScheduleLesson {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  lessonType: string;
  status: 'ACTIVE' | 'CANCELLED' | 'CHANGED';
  subject: { id: string; code: string; name: string };
  classroom: { id: string; building: string; roomNumber: string };
  teacher: { id: string; fullName: string };
}

export interface ScheduleOccurrence {
  date: string;
  lesson: ScheduleLesson;
}

export interface StudentDashboardResponse {
  gpa: number;
  currentSemester: {
    id: string;
    number: number;
    startDate: Date;
    endDate: Date;
  } | null;
  earnedCredits: number;
  academicDebtsCount: number;
  nextLessons: ScheduleOccurrence[];
  importantUnreadNotifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    priority: string;
    createdAt: Date;
  }>;
  attendance: Array<Record<string, unknown>>;
  exams: Array<Record<string, unknown>>;
  assignments: Array<Record<string, unknown>>;
}

export interface StudentAcademicProfileResponse {
  semesterHistory: Array<{
    semesterId: string;
    semesterNumber: number;
    startDate: Date;
    endDate: Date;
    gpa: number;
    subjects: Array<{
      subjectId: string;
      code: string;
      name: string;
      credits: number;
      status: string;
      grades: Array<{
        type: string;
        score: number;
        maxScore: number;
        letter: string | null;
      }>;
    }>;
    passedSubjects: number;
    notPassedSubjects: number;
  }>;
  overallGpa: number;
  rating: { rank: number; total: number };
  academicDebts: Array<{ subjectId: string; code: string; name: string }>;
  curriculumProgress: { totalCredits: number; earnedCredits: number; percent: number };
}

export interface StudentCurriculumResponse {
  years: Array<{
    year: number;
    semesters: Array<{
      semesterNumber: number;
      items: Array<{
        id: string;
        subjectId: string;
        code: string;
        name: string;
        type: string;
        credits: number;
        prerequisites: Array<{ id: string; code: string; name: string }>;
        status: CurriculumStatus;
      }>;
    }>;
  }>;
  progress: { totalCredits: number; earnedCredits: number; percent: number };
}

export interface StudentGradesResponse {
  items: Array<{
    enrollmentId: string;
    semesterId: string;
    semesterNumber: number;
    subject: { id: string; code: string; name: string; credits: number };
    status: string;
    grades: Array<{
      type: string;
      score: number;
      maxScore: number;
      letter: string | null;
      createdAt: Date;
    }>;
  }>;
}

export interface StudentGpaResponse {
  overallGpa: number;
  earnedCredits: number;
  semesters: Array<{
    semesterId: string;
    semesterNumber: number;
    gpa: number;
  }>;
  trend: Array<{ semesterId: string; semesterNumber: number; gpa: number }>;
}

export interface FreeWindowsResponse {
  date: string;
  windows: FreeWindow[];
}
