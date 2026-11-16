import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'argon2';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import {
  AcademicStatus,
  CampusObjectType,
  CurriculumItemType,
  DayOfWeek,
  EnrollmentStatus,
  Gender,
  GradeType,
  LessonType,
  NotificationPriority,
  NotificationType,
  ScheduleStatus,
  StudyForm,
  StudyLanguage,
  UserRole,
} from '../src/generated/prisma/enums';
import { Prisma, PrismaClient } from '../src/generated/prisma/client';

let prisma: PrismaClient;
let demoPasswordHash: string;

const toDecimal = (value: string | number) => new Prisma.Decimal(String(value));
const toDate = (value: string) => new Date(value);
const toTime = (value: string) => new Date(`1970-01-01T${value}:00Z`);

async function upsertUser(email: string, role: UserRole, fullName: string) {
  return prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: demoPasswordHash,
      role,
      isActive: true,
      updatedAt: new Date()
    },
    create: {
      email,
      passwordHash: demoPasswordHash,
      role,
      isActive: true
    }
  });
}

async function ensureGradeScale() {
  const rows = [
    { letter: 'A', minScore: '95.00', gpaPoints: '4.00' },
    { letter: 'A-', minScore: '90.00', gpaPoints: '3.67' },
    { letter: 'B+', minScore: '85.00', gpaPoints: '3.33' },
    { letter: 'B', minScore: '80.00', gpaPoints: '3.00' },
    { letter: 'B-', minScore: '75.00', gpaPoints: '2.67' },
    { letter: 'C+', minScore: '70.00', gpaPoints: '2.33' },
    { letter: 'C', minScore: '65.00', gpaPoints: '2.00' },
    { letter: 'D', minScore: '55.00', gpaPoints: '1.00' },
    { letter: 'F', minScore: '0.00', gpaPoints: '0.00' }
  ];

  for (const scale of rows) {
    await prisma.gradeScale.upsert({
      where: { letter: scale.letter },
      update: {
        minScore: toDecimal(scale.minScore),
        gpaPoints: toDecimal(scale.gpaPoints),
        updatedAt: new Date()
      },
      create: {
        letter: scale.letter,
        minScore: toDecimal(scale.minScore),
        gpaPoints: toDecimal(scale.gpaPoints)
      }
    });
  }
}

async function ensureDocumentTypes() {
  const names = ['Transcript', 'Student ID', 'Certificate', 'Dormitory card'];

  for (const name of names) {
    await prisma.documentType.upsert({
      where: { name },
      update: { description: `Seeded document type: ${name}`, updatedAt: new Date() },
      create: { name, description: `Seeded document type: ${name}` }
    });
  }
}

async function ensureSemesterBlocks() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const firstAcademicYear = currentYear - 3;
  const academicStartYear =
    now.getMonth() >= 6 ? currentYear : currentYear - 1;
  const currentSemesterNumber =
    (academicStartYear - firstAcademicYear) * 2 +
    (now.getMonth() >= 6 ? 1 : 2);
  const semesters = Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    const isFallSemester = number % 2 === 1;
    const startYear =
      firstAcademicYear + Math.floor(index / 2) + (isFallSemester ? 0 : 1);
    const endYear = startYear + (isFallSemester ? 1 : 0);
    const startDate = toDate(
      `${startYear}-${isFallSemester ? '09-01' : '02-01'}`,
    );
    const endDate = toDate(
      `${endYear}-${isFallSemester ? '01-31' : '06-30'}`,
    );

    return {
      number,
      startDate,
      endDate,
      isCurrent: number === currentSemesterNumber,
    };
  });

  const semesterRecords: Record<
    number,
    { id: string; number: number; isCurrent: boolean }
  > = {};

  for (const semester of semesters) {
    const existing = await prisma.semester.findFirst({ where: { number: semester.number } });
    if (existing) {
      semesterRecords[semester.number] = await prisma.semester.update({
        where: { id: existing.id },
        data: {
          isCurrent: semester.isCurrent,
          startDate: semester.startDate,
          endDate: semester.endDate,
        },
      });
      continue;
    }

    const created = await prisma.semester.create({
      data: {
        number: semester.number,
        startDate: semester.startDate,
        endDate: semester.endDate,
        isCurrent: semester.isCurrent
      }
    });
    semesterRecords[semester.number] = created;
  }

  return semesterRecords;
}

async function ensureInstituteAndDepartments() {
  const institute = await prisma.institute.upsert({
    where: { code: 'IIT' },
    update: { name: 'Institute of Information Technologies', description: 'Core digital transformation and engineering institute', updatedAt: new Date() },
    create: {
      code: 'IIT',
      name: 'Institute of Information Technologies',
      description: 'Core digital transformation and engineering institute'
    }
  });

  const csDepartment = await prisma.department.upsert({
    where: { code: 'CS' },
    update: { instituteId: institute.id, name: 'Computer Science', description: 'Algorithms, systems and software engineering', updatedAt: new Date() },
    create: {
      code: 'CS',
      name: 'Computer Science',
      description: 'Algorithms, systems and software engineering',
      instituteId: institute.id
    }
  });

  const dsDepartment = await prisma.department.upsert({
    where: { code: 'DS' },
    update: { instituteId: institute.id, name: 'Digital Systems', description: 'Digital infrastructure and applied technologies', updatedAt: new Date() },
    create: {
      code: 'DS',
      name: 'Digital Systems',
      description: 'Digital infrastructure and applied technologies',
      instituteId: institute.id
    }
  });

  return { institute, csDepartment, dsDepartment };
}

async function ensureProgram(departmentId: string) {
  return prisma.program.upsert({
    where: { code: 'SE' },
    update: {
      departmentId,
      name: 'Software Engineering',
      degree: 'Bachelor',
      durationYears: 4,
      updatedAt: new Date()
    },
    create: {
      code: 'SE',
      name: 'Software Engineering',
      degree: 'Bachelor',
      durationYears: 4,
      departmentId
    }
  });
}

async function ensureGroups(programId: string) {
  const firstGroup = await prisma.group.upsert({
    where: { code: 'SE-2023-A' },
    update: { programId, name: 'Software Engineering Group A', admissionYear: 2023, updatedAt: new Date() },
    create: { code: 'SE-2023-A', name: 'Software Engineering Group A', programId, admissionYear: 2023 }
  });

  const secondGroup = await prisma.group.upsert({
    where: { code: 'SE-2023-B' },
    update: { programId, name: 'Software Engineering Group B', admissionYear: 2023, updatedAt: new Date() },
    create: { code: 'SE-2023-B', name: 'Software Engineering Group B', programId, admissionYear: 2023 }
  });

  return { firstGroup, secondGroup };
}

async function ensureTeachers(departmentId: string) {
  const teacherEntries = [
    { email: 'aigul.nurmaganbetova@campus.kz', fullName: 'Айгуль Нурмагамбетовa', teacherCode: 'T-101' },
    { email: 'daniyar.kassenov@campus.kz', fullName: 'Данияр Касенов', teacherCode: 'T-102' },
    { email: 'nurgul.seitova@campus.kz', fullName: 'Нургуль Сеитова', teacherCode: 'T-103' },
    { email: 'sultan.tulegenov@campus.kz', fullName: 'Султан Тулегенов', teacherCode: 'T-104' },
    { email: 'zhanna.kaimuldinova@campus.kz', fullName: 'Жанна Каймулдинова', teacherCode: 'T-105' }
  ];

  const teachers: Array<{ id: string; email: string; fullName: string; teacherCode: string }> = [];

  for (const entry of teacherEntries) {
    const user = await upsertUser(entry.email, UserRole.TEACHER, entry.fullName);
    const teacher = await prisma.teacher.upsert({
      where: { teacherCode: entry.teacherCode },
      update: { userId: user.id, fullName: entry.fullName, departmentId, updatedAt: new Date() },
      create: {
        userId: user.id,
        teacherCode: entry.teacherCode,
        fullName: entry.fullName,
        departmentId
      }
    });

    teachers.push({ id: teacher.id, email: entry.email, fullName: entry.fullName, teacherCode: entry.teacherCode });
  }

  return teachers;
}

async function seedUsersAndStudents(groups: { firstGroup: { id: string }; secondGroup: { id: string } }, programId: string) {
  const studentNames = [
    'Аман Қасымов', 'Айжан Байсеитова', 'Ержан Султанов', 'Мадина Нұрқұлова', 'Алексей Орлов',
    'Динара Жанбырбаева', 'Нұрболат Абдрахманов', 'Гульназ Темирбаева', 'Бекзат Бейсенов', 'Асель Куанышова',
    'Рамазан Ермеков', 'Ляззат Маратова', 'Ерасыл Бекенов', 'Жансая Тлегенова', 'Анель Туманова',
    'Марат Баймуратов', 'София Петрова', 'Нурлан Жумабаев', 'Аяна Кенжебаева', 'Бауыржан Аманов'
  ];

  const studentRecords: Array<{ id: string; email: string; fullName: string; groupId: string; course: number }> = [];

  for (let index = 0; index < studentNames.length; index += 1) {
    const groupId = index < 10 ? groups.firstGroup.id : groups.secondGroup.id;
    const email = `student${index + 1}@campus.kz`;
    const fullName = studentNames[index];
    const user = await upsertUser(email, UserRole.STUDENT, fullName);
    const course = 2 + (index % 3);
    const studentCode = `ST-${String(index + 1).padStart(4, '0')}`;

    const student = await prisma.student.upsert({
      where: { studentCode },
      update: {
        userId: user.id,
        fullName,
        groupId,
        programId,
        course,
        studyForm: StudyForm.FULL_TIME,
        studyLanguage: index % 2 === 0 ? StudyLanguage.KK : StudyLanguage.RU,
        gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        academicStatus: AcademicStatus.STUDYING,
        iin: `970${String(index + 1).padStart(8, '0')}`,
        birthDate: toDate(`200${(index % 4) + 3}-0${(index % 9) + 1}-1${(index % 7) + 1}`),
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        studentCode,
        fullName,
        groupId,
        programId,
        course,
        studyForm: StudyForm.FULL_TIME,
        studyLanguage: index % 2 === 0 ? StudyLanguage.KK : StudyLanguage.RU,
        gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        academicStatus: AcademicStatus.STUDYING,
        iin: `970${String(index + 1).padStart(8, '0')}`,
        birthDate: toDate(`200${(index % 4) + 3}-0${(index % 9) + 1}-1${(index % 7) + 1}`)
      }
    });

    studentRecords.push({ id: student.id, email, fullName, groupId, course });
  }

  const demoUser = await upsertUser('student@campus.kz', UserRole.STUDENT, 'Демо студент');
  const demoStudent = await prisma.student.upsert({
    where: { studentCode: 'ST-DEMO' },
    update: {
      userId: demoUser.id,
      fullName: 'Демо студент',
      groupId: groups.firstGroup.id,
      programId,
      course: 4,
      studyForm: StudyForm.FULL_TIME,
      studyLanguage: StudyLanguage.KK,
      gender: Gender.MALE,
      academicStatus: AcademicStatus.STUDYING,
      iin: '970000000001',
      birthDate: toDate('2005-05-05'),
      updatedAt: new Date()
    },
    create: {
      userId: demoUser.id,
      studentCode: 'ST-DEMO',
      fullName: 'Демо студент',
      groupId: groups.firstGroup.id,
      programId,
      course: 4,
      studyForm: StudyForm.FULL_TIME,
      studyLanguage: StudyLanguage.KK,
      gender: Gender.MALE,
      academicStatus: AcademicStatus.STUDYING,
      iin: '970000000001',
      birthDate: toDate('2005-05-05')
    }
  });

  studentRecords.push({ id: demoStudent.id, email: 'student@campus.kz', fullName: 'Демо студент', groupId: groups.firstGroup.id, course: 3 });

  return studentRecords;
}

async function ensureSubjects(departmentId: string) {
  const subjectCatalog = [
    { code: 'CS101', name: 'Introduction to Programming', credits: '3.00', semesterNumber: 1, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'CS102', name: 'Discrete Mathematics', credits: '4.00', semesterNumber: 1, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'CS103', name: 'Calculus I', credits: '4.00', semesterNumber: 1, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'ENG101', name: 'English for IT', credits: '2.00', semesterNumber: 1, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'CS104', name: 'Academic Writing', credits: '2.00', semesterNumber: 1, type: CurriculumItemType.ELECTIVE, prerequisites: [] },
    { code: 'CS201', name: 'Data Structures and Algorithms', credits: '4.00', semesterNumber: 2, type: CurriculumItemType.MANDATORY, prerequisites: ['CS101', 'CS102'] },
    { code: 'CS202', name: 'Object-Oriented Programming', credits: '4.00', semesterNumber: 2, type: CurriculumItemType.MANDATORY, prerequisites: ['CS101'] },
    { code: 'CS203', name: 'Probability and Statistics', credits: '3.00', semesterNumber: 2, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'DB201', name: 'Database Fundamentals', credits: '3.00', semesterNumber: 2, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'SE201', name: 'Software Design Principles', credits: '2.00', semesterNumber: 2, type: CurriculumItemType.ELECTIVE, prerequisites: ['CS202'] },
    { code: 'CS301', name: 'Computer Architecture', credits: '3.00', semesterNumber: 3, type: CurriculumItemType.MANDATORY, prerequisites: ['CS101'] },
    { code: 'OS301', name: 'Operating Systems', credits: '4.00', semesterNumber: 3, type: CurriculumItemType.MANDATORY, prerequisites: ['CS201'] },
    { code: 'AL301', name: 'Algorithms II', credits: '3.00', semesterNumber: 3, type: CurriculumItemType.MANDATORY, prerequisites: ['CS201'] },
    { code: 'WEB301', name: 'Web Development Basics', credits: '3.00', semesterNumber: 3, type: CurriculumItemType.MANDATORY, prerequisites: ['CS202'] },
    { code: 'UX301', name: 'UX Design', credits: '2.00', semesterNumber: 3, type: CurriculumItemType.ELECTIVE, prerequisites: [] },
    { code: 'DB401', name: 'Databases', credits: '4.00', semesterNumber: 4, type: CurriculumItemType.MANDATORY, prerequisites: ['DB201'] },
    { code: 'NET401', name: 'Computer Networks', credits: '3.00', semesterNumber: 4, type: CurriculumItemType.MANDATORY, prerequisites: ['CS301'] },
    { code: 'SE401', name: 'Software Engineering', credits: '4.00', semesterNumber: 4, type: CurriculumItemType.MANDATORY, prerequisites: ['CS202'] },
    { code: 'MOB401', name: 'Mobile Development', credits: '3.00', semesterNumber: 4, type: CurriculumItemType.MANDATORY, prerequisites: ['WEB301'] },
    { code: 'AI401', name: 'AI Foundations', credits: '2.00', semesterNumber: 4, type: CurriculumItemType.ELECTIVE, prerequisites: ['CS203'] },
    { code: 'DS501', name: 'Distributed Systems', credits: '3.00', semesterNumber: 5, type: CurriculumItemType.MANDATORY, prerequisites: ['NET401'] },
    { code: 'CLOUD501', name: 'Cloud Computing', credits: '3.00', semesterNumber: 5, type: CurriculumItemType.MANDATORY, prerequisites: ['DB401'] },
    { code: 'DEV501', name: 'DevOps', credits: '3.00', semesterNumber: 5, type: CurriculumItemType.MANDATORY, prerequisites: ['SE401'] },
    { code: 'SEC501', name: 'Cybersecurity', credits: '3.00', semesterNumber: 5, type: CurriculumItemType.MANDATORY, prerequisites: ['NET401'] },
    { code: 'DATA501', name: 'Data Science', credits: '2.00', semesterNumber: 5, type: CurriculumItemType.ELECTIVE, prerequisites: ['CS203'] },
    { code: 'ML601', name: 'Machine Learning', credits: '4.00', semesterNumber: 6, type: CurriculumItemType.MANDATORY, prerequisites: ['DATA501', 'CS201'] },
    { code: 'DB601', name: 'Advanced Databases', credits: '3.00', semesterNumber: 6, type: CurriculumItemType.MANDATORY, prerequisites: ['DB401'] },
    { code: 'TEST601', name: 'Software Testing', credits: '3.00', semesterNumber: 6, type: CurriculumItemType.MANDATORY, prerequisites: ['SE401'] },
    { code: 'HCI601', name: 'Human-Computer Interaction', credits: '3.00', semesterNumber: 6, type: CurriculumItemType.MANDATORY, prerequisites: ['UX301'] },
    { code: 'IND601', name: 'Industrial Internship', credits: '2.00', semesterNumber: 6, type: CurriculumItemType.ELECTIVE, prerequisites: ['SE401'] },
    { code: 'CAP701', name: 'Capstone Project', credits: '5.00', semesterNumber: 7, type: CurriculumItemType.MANDATORY, prerequisites: ['SE401'] },
    { code: 'PP701', name: 'Professional Practice', credits: '3.00', semesterNumber: 7, type: CurriculumItemType.MANDATORY, prerequisites: ['SE401'] },
    { code: 'ROBOT701', name: 'Robotics and AI', credits: '3.00', semesterNumber: 7, type: CurriculumItemType.MANDATORY, prerequisites: ['ML601'] },
    { code: 'ENT701', name: 'Entrepreneurship', credits: '2.00', semesterNumber: 7, type: CurriculumItemType.ELECTIVE, prerequisites: [] },
    { code: 'BUS701', name: 'Business Analytics', credits: '2.00', semesterNumber: 7, type: CurriculumItemType.ELECTIVE, prerequisites: ['DATA501'] },
    { code: 'GRAD801', name: 'Graduation Project', credits: '6.00', semesterNumber: 8, type: CurriculumItemType.MANDATORY, prerequisites: ['CAP701'] },
    { code: 'THESIS801', name: 'Thesis Seminar', credits: '2.00', semesterNumber: 8, type: CurriculumItemType.MANDATORY, prerequisites: ['CAP701'] },
    { code: 'RM801', name: 'Research Methods', credits: '2.00', semesterNumber: 8, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'ETH801', name: 'Digital Ethics', credits: '2.00', semesterNumber: 8, type: CurriculumItemType.MANDATORY, prerequisites: [] },
    { code: 'INN801', name: 'Innovation Lab', credits: '2.00', semesterNumber: 8, type: CurriculumItemType.ELECTIVE, prerequisites: ['CAP701'] }
  ];

  const createdSubjects: Record<string, { id: string; code: string; name: string; credits: string; semesterNumber: number }> = {};

  for (const subject of subjectCatalog) {
    const record = await prisma.subject.upsert({
      where: { code: subject.code },
      update: {
        departmentId,
        name: subject.name,
        credits: toDecimal(subject.credits),
        updatedAt: new Date()
      },
      create: {
        code: subject.code,
        name: subject.name,
        departmentId,
        credits: toDecimal(subject.credits)
      }
    });

    createdSubjects[subject.code] = {
      id: record.id,
      code: record.code,
      name: record.name,
      credits: String(record.credits),
      semesterNumber: subject.semesterNumber
    };
  }

  return createdSubjects;
}

async function ensureCurriculum(programId: string, subjectsByCode: Record<string, { id: string }>) {
  const curriculum = await prisma.curriculum.upsert({
    where: { programId_version: { programId, version: '2024-2028' } },
    update: { name: 'Software Engineering Curriculum', effectiveFrom: toDate('2024-09-01'), updatedAt: new Date() },
    create: {
      programId,
      name: 'Software Engineering Curriculum',
      version: '2024-2028',
      effectiveFrom: toDate('2024-09-01')
    }
  });

  const itemBySubjectCode = new Map<string, { id: string }>();
  const subjectCatalog = [
    { code: 'CS101', semesterNumber: 1, type: CurriculumItemType.MANDATORY },
    { code: 'CS102', semesterNumber: 1, type: CurriculumItemType.MANDATORY },
    { code: 'CS103', semesterNumber: 1, type: CurriculumItemType.MANDATORY },
    { code: 'ENG101', semesterNumber: 1, type: CurriculumItemType.MANDATORY },
    { code: 'CS104', semesterNumber: 1, type: CurriculumItemType.ELECTIVE },
    { code: 'CS201', semesterNumber: 2, type: CurriculumItemType.MANDATORY },
    { code: 'CS202', semesterNumber: 2, type: CurriculumItemType.MANDATORY },
    { code: 'CS203', semesterNumber: 2, type: CurriculumItemType.MANDATORY },
    { code: 'DB201', semesterNumber: 2, type: CurriculumItemType.MANDATORY },
    { code: 'SE201', semesterNumber: 2, type: CurriculumItemType.ELECTIVE },
    { code: 'CS301', semesterNumber: 3, type: CurriculumItemType.MANDATORY },
    { code: 'OS301', semesterNumber: 3, type: CurriculumItemType.MANDATORY },
    { code: 'AL301', semesterNumber: 3, type: CurriculumItemType.MANDATORY },
    { code: 'WEB301', semesterNumber: 3, type: CurriculumItemType.MANDATORY },
    { code: 'UX301', semesterNumber: 3, type: CurriculumItemType.ELECTIVE },
    { code: 'DB401', semesterNumber: 4, type: CurriculumItemType.MANDATORY },
    { code: 'NET401', semesterNumber: 4, type: CurriculumItemType.MANDATORY },
    { code: 'SE401', semesterNumber: 4, type: CurriculumItemType.MANDATORY },
    { code: 'MOB401', semesterNumber: 4, type: CurriculumItemType.MANDATORY },
    { code: 'AI401', semesterNumber: 4, type: CurriculumItemType.ELECTIVE },
    { code: 'DS501', semesterNumber: 5, type: CurriculumItemType.MANDATORY },
    { code: 'CLOUD501', semesterNumber: 5, type: CurriculumItemType.MANDATORY },
    { code: 'DEV501', semesterNumber: 5, type: CurriculumItemType.MANDATORY },
    { code: 'SEC501', semesterNumber: 5, type: CurriculumItemType.MANDATORY },
    { code: 'DATA501', semesterNumber: 5, type: CurriculumItemType.ELECTIVE },
    { code: 'ML601', semesterNumber: 6, type: CurriculumItemType.MANDATORY },
    { code: 'DB601', semesterNumber: 6, type: CurriculumItemType.MANDATORY },
    { code: 'TEST601', semesterNumber: 6, type: CurriculumItemType.MANDATORY },
    { code: 'HCI601', semesterNumber: 6, type: CurriculumItemType.MANDATORY },
    { code: 'IND601', semesterNumber: 6, type: CurriculumItemType.ELECTIVE },
    { code: 'CAP701', semesterNumber: 7, type: CurriculumItemType.MANDATORY },
    { code: 'PP701', semesterNumber: 7, type: CurriculumItemType.MANDATORY },
    { code: 'ROBOT701', semesterNumber: 7, type: CurriculumItemType.MANDATORY },
    { code: 'ENT701', semesterNumber: 7, type: CurriculumItemType.ELECTIVE },
    { code: 'BUS701', semesterNumber: 7, type: CurriculumItemType.ELECTIVE },
    { code: 'GRAD801', semesterNumber: 8, type: CurriculumItemType.MANDATORY },
    { code: 'THESIS801', semesterNumber: 8, type: CurriculumItemType.MANDATORY },
    { code: 'RM801', semesterNumber: 8, type: CurriculumItemType.MANDATORY },
    { code: 'ETH801', semesterNumber: 8, type: CurriculumItemType.MANDATORY },
    { code: 'INN801', semesterNumber: 8, type: CurriculumItemType.ELECTIVE }
  ];

  const prereqMap: Record<string, string[]> = {
    CS201: ['CS101', 'CS102'],
    CS202: ['CS101'],
    SE201: ['CS202'],
    OS301: ['CS201'],
    AL301: ['CS201'],
    WEB301: ['CS202'],
    DB401: ['DB201'],
    NET401: ['CS301'],
    SE401: ['CS202'],
    MOB401: ['WEB301'],
    AI401: ['CS203'],
    DS501: ['NET401'],
    CLOUD501: ['DB401'],
    DEV501: ['SE401'],
    SEC501: ['NET401'],
    DATA501: ['CS203'],
    ML601: ['DATA501', 'CS201'],
    DB601: ['DB401'],
    TEST601: ['SE401'],
    HCI601: ['UX301'],
    IND601: ['SE401'],
    CAP701: ['SE401'],
    PP701: ['SE401'],
    ROBOT701: ['ML601'],
    BUS701: ['DATA501'],
    GRAD801: ['CAP701'],
    THESIS801: ['CAP701'],
    INN801: ['CAP701']
  };

  for (const entry of subjectCatalog) {
    const item = await prisma.curriculumItem.upsert({
      where: { curriculumId_subjectId: { curriculumId: curriculum.id, subjectId: subjectsByCode[entry.code].id } },
      update: {
        semesterNumber: entry.semesterNumber,
        type: entry.type,
        credits: toDecimal('3.00'),
        updatedAt: new Date()
      },
      create: {
        curriculumId: curriculum.id,
        subjectId: subjectsByCode[entry.code].id,
        semesterNumber: entry.semesterNumber,
        type: entry.type,
        credits: toDecimal('3.00')
      }
    });

    itemBySubjectCode.set(entry.code, item);

    for (const prerequisiteCode of prereqMap[entry.code] ?? []) {
      const prerequisiteItem = itemBySubjectCode.get(prerequisiteCode) ?? (await prisma.curriculumItem.findFirst({
        where: { curriculumId: curriculum.id, subject: { code: prerequisiteCode } }
      }));
      if (!prerequisiteItem) {
        continue;
      }
      await prisma.curriculumPrerequisite.upsert({
        where: { curriculumItemId_prerequisiteItemId: { curriculumItemId: item.id, prerequisiteItemId: prerequisiteItem.id } },
        update: {},
        create: {
          curriculumItemId: item.id,
          prerequisiteItemId: prerequisiteItem.id
        }
      });
    }
  }

  return curriculum;
}

async function ensureClassrooms() {
  const classroomRows = [
    { building: 'Main Building', roomNumber: 'A-101', capacity: 120, description: 'Lecture hall' },
    { building: 'Main Building', roomNumber: 'A-204', capacity: 50, description: 'Computer lab' },
    { building: 'Innovation Center', roomNumber: 'B-205', capacity: 35, description: 'Project studio' },
    { building: 'Research Building', roomNumber: 'R-310', capacity: 40, description: 'Seminar room' },
    { building: 'Technology Hub', roomNumber: 'TH-405', capacity: 60, description: 'Innovation studio' }
  ];

  const classroomMap: Record<string, { id: string }> = {};

  for (const classroom of classroomRows) {
    const record = await prisma.classroom.upsert({
      where: { building_roomNumber: { building: classroom.building, roomNumber: classroom.roomNumber } },
      update: { capacity: classroom.capacity, description: classroom.description, updatedAt: new Date() },
      create: {
        building: classroom.building,
        roomNumber: classroom.roomNumber,
        capacity: classroom.capacity,
        description: classroom.description
      }
    });
    classroomMap[`${classroom.building}-${classroom.roomNumber}`] = record;
  }

  return classroomMap;
}

async function ensureCurrentSemesterCourses(
  semesterNumber: number,
  semesterId: string,
  groups: { firstGroup: { id: string }; secondGroup: { id: string } },
  teacherIds: string[],
  classroomMap: Record<string, { id: string }>,
): Promise<void> {
  const courseSubjectsBySemester: Record<number, string[]> = {
    5: ['DS501', 'CLOUD501', 'DEV501', 'SEC501'],
    6: ['ML601', 'DB601', 'TEST601', 'HCI601'],
    7: ['CAP701', 'PP701', 'ROBOT701', 'ENT701', 'BUS701'],
    8: ['GRAD801', 'THESIS801', 'RM801', 'ETH801', 'INN801'],
  };
  const courseSubjects = courseSubjectsBySemester[semesterNumber] ?? [];
  const courseData: Array<{
    course: { id: string; groupId: string; subjectId: string; teacherId: string };
    groupId: string;
  }> = [];

  for (const groupEntry of [groups.firstGroup, groups.secondGroup]) {
    for (const subjectCode of courseSubjects) {
      const subject = await prisma.subject.findUnique({ where: { code: subjectCode } });
      if (!subject) {
        continue;
      }

      const course = await prisma.course.upsert({
        where: { subjectId_semesterId_groupId: { subjectId: subject.id, semesterId, groupId: groupEntry.id } },
        update: { teacherId: teacherIds[0], updatedAt: new Date() },
        create: {
          subjectId: subject.id,
          semesterId,
          groupId: groupEntry.id,
          teacherId: teacherIds[0]
        }
      });

      courseData.push({ course, groupId: groupEntry.id });
    }
  }

  for (let index = 0; index < courseData.length; index += 1) {
    const entry = courseData[index];
    const day = [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY][index % 3];
    const startTimes = ['09:00', '11:00', '13:00'];
    const roomKeys = Object.keys(classroomMap);
    const roomKey = roomKeys[index % roomKeys.length];
    const classroomId = classroomMap[roomKey].id;
    const startTimeText = startTimes[index % startTimes.length];
    const [startHour, startMinute] = startTimeText.split(':').map(Number);
    const endMinuteTotal = startHour * 60 + startMinute + 90;
    const endTimeText = `${String(Math.floor(endMinuteTotal / 60)).padStart(2, '0')}:${String(endMinuteTotal % 60).padStart(2, '0')}`;
    const startTime = toTime(startTimeText);
    const scheduleData = {
      courseId: entry.course.id,
      classroomId,
      teacherId: entry.course.teacherId,
      groupId: entry.groupId,
      dayOfWeek: day,
      startTime,
      endTime: toTime(endTimeText),
      lessonType: index % 2 === 0 ? LessonType.LECTURE : LessonType.PRACTICE,
      status: ScheduleStatus.ACTIVE,
    };
    const existing = await prisma.scheduleEntry.findFirst({
      where: { courseId: entry.course.id, dayOfWeek: day, startTime },
    });
    if (existing) {
      await prisma.scheduleEntry.update({
        where: { id: existing.id },
        data: scheduleData,
      });
    } else {
      await prisma.scheduleEntry.create({ data: scheduleData });
    }
  }
}

async function ensurePastSemesterGrades(
  studentRecords: Array<{ id: string; groupId: string }>,
  semesterRecords: Record<number, { id: string }>,
  courseAssignments: Record<string, string[]>,
) {
  const completedSemesterNumbers = [1, 2, 3, 4];

  for (const student of studentRecords) {
    for (const semesterNumber of completedSemesterNumbers) {
      const semesterId = semesterRecords[semesterNumber].id;
      const coursesForGroup = courseAssignments[`${semesterNumber}:${student.groupId}`] ?? [];

      for (let index = 0; index < Math.min(coursesForGroup.length, 3); index += 1) {
        const courseId = coursesForGroup[index];
        const status =
          index % 5 === 0 ? EnrollmentStatus.FAILED : EnrollmentStatus.PASSED;
        const enrollment = await prisma.enrollment.upsert({
          where: {
            studentId_courseId_semesterId: {
              studentId: student.id,
              courseId,
              semesterId,
            },
          },
          update: { status },
          create: {
            studentId: student.id,
            courseId,
            semesterId,
            status,
          },
        });

        const finalGrade = index % 5 === 0 ? 'F' : ['A', 'B', 'C', 'B+'][index % 4];
        const score = index % 5 === 0 ? '32.00' : ['97.00', '89.00', '78.00', '84.00'][index % 4];

        await prisma.grade.upsert({
          where: { enrollmentId_type: { enrollmentId: enrollment.id, type: GradeType.FINAL } },
          update: { score: toDecimal(score), maxScore: toDecimal('100.00'), letter: finalGrade, points: toDecimal(score === '32.00' ? '0.00' : '3.00'), updatedAt: new Date() },
          create: {
            enrollmentId: enrollment.id,
            type: GradeType.FINAL,
            score: toDecimal(score),
            maxScore: toDecimal('100.00'),
            letter: finalGrade,
            points: toDecimal(score === '32.00' ? '0.00' : '3.00')
          }
        });
      }
    }
  }

}

async function ensureCurrentSemesterEnrollments(
  studentId: string,
  groupId: string,
  semesterId: string,
): Promise<void> {
  const courses = await prisma.course.findMany({
    where: { groupId, semesterId },
    orderBy: { subject: { code: 'asc' } },
    select: { id: true },
  });

  for (const [index, course] of courses.entries()) {
    const enrollment = await prisma.enrollment.upsert({
      where: {
        studentId_courseId_semesterId: {
          studentId,
          courseId: course.id,
          semesterId,
        },
      },
      update: { status: EnrollmentStatus.IN_PROGRESS },
      create: {
        studentId,
        courseId: course.id,
        semesterId,
        status: EnrollmentStatus.IN_PROGRESS,
      },
    });
    const score = ['84.00', '76.00', '91.00', '88.00', '79.00'][index % 5];

    await prisma.grade.upsert({
      where: {
        enrollmentId_type: {
          enrollmentId: enrollment.id,
          type: GradeType.CURRENT,
        },
      },
      update: {
        score: toDecimal(score),
        maxScore: toDecimal('100.00'),
        letter: null,
        points: null,
      },
      create: {
        enrollmentId: enrollment.id,
        type: GradeType.CURRENT,
        score: toDecimal(score),
        maxScore: toDecimal('100.00'),
      },
    });
  }
}

async function ensureNotifications(users: Array<{ id: string; email: string }>) {
  const notificationSeeds = [
    { email: 'admin@campus.kz', type: NotificationType.SYSTEM, title: 'System backup completed', body: 'Daily database backup was completed successfully.', priority: NotificationPriority.HIGH },
    { email: 'student@campus.kz', type: NotificationType.GRADE, title: 'Grade updated', body: 'Your final grade was published in the student portal.', priority: NotificationPriority.NORMAL },
    { email: 'student1@campus.kz', type: NotificationType.SCHEDULE, title: 'Schedule changed', body: 'Applied mathematics lecture moved to room A-204.', priority: NotificationPriority.NORMAL },
    { email: 'aigul.nurmaganbetova@campus.kz', type: NotificationType.APPLICATION, title: 'Application review', body: 'Two student applications are awaiting your review.', priority: NotificationPriority.HIGH }
  ];

  for (const entry of notificationSeeds) {
    const user = await prisma.user.findUnique({ where: { email: entry.email } });
    if (!user) {
      continue;
    }

    const existing = await prisma.notification.findFirst({
      where: { userId: user.id, title: entry.title, body: entry.body }
    });

    if (!existing) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: entry.type,
          title: entry.title,
          body: entry.body,
          priority: entry.priority
        }
      });
    }
  }

  for (const user of users) {
    const count = await prisma.notification.count({ where: { userId: user.id } });
    if (count === 0) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.GENERAL,
          title: 'Welcome to Campus',
          body: 'Your account is ready and synced to the university system.',
          priority: NotificationPriority.NORMAL
        }
      });
    }
  }
}

async function ensureCampusObjects(departmentId: string) {
  const objects = [
    { type: CampusObjectType.BUILDING, name: 'Main Building', description: 'Academic centre with classrooms and labs', location: 'North block', workingHours: '08:00-20:00' },
    { type: CampusObjectType.LIBRARY, name: 'Library', description: 'Reading room and digital resources', location: 'Ground floor', workingHours: '09:00-21:00' },
    { type: CampusObjectType.DEAN_OFFICE, name: 'Dean office', description: 'Academic administration desk', location: 'Second floor', workingHours: '09:00-18:00' },
    { type: CampusObjectType.CANTEEN, name: 'Cafeteria', description: 'Student canteen and coffee station', location: 'South wing', workingHours: '08:30-19:00' },
    { type: CampusObjectType.DORM, name: 'Dormitory', description: 'Accommodation for students', location: 'Campus East', workingHours: '24/7' },
    { type: CampusObjectType.DEPARTMENT, name: 'Computer Science Department', description: 'Department administrative unit', location: 'Floor 3', workingHours: '09:00-18:00', departmentId }
  ];

  for (const object of objects) {
    const existing = await prisma.campusObject.findFirst({
      where: { type: object.type, name: object.name }
    });

    if (!existing) {
      await prisma.campusObject.create({
        data: {
          type: object.type,
          name: object.name,
          description: object.description,
          location: object.location,
          workingHours: object.workingHours,
          departmentId: object.departmentId ?? null
        }
      });
    }
  }
}

async function seed() {
  const { institute, csDepartment, dsDepartment } = await ensureInstituteAndDepartments();
  const program = await ensureProgram(csDepartment.id);
  const groups = await ensureGroups(program.id);
  const semesterRecords = await ensureSemesterBlocks();
  const teachers = await ensureTeachers(csDepartment.id);
  const adminUser = await upsertUser('admin@campus.kz', UserRole.ADMIN, 'Админ');
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { isActive: true }
  });

  const studentRecords = await seedUsersAndStudents(groups, program.id);
  const subjectMap = await ensureSubjects(csDepartment.id);
  await ensureCurriculum(program.id, subjectMap);
  await ensureGradeScale();
  await ensureDocumentTypes();

  const currentSemester = Object.values(semesterRecords).find(
    (semester) => semester.isCurrent,
  );
  if (!currentSemester) {
    throw new Error('Unable to determine the current semester for seed data.');
  }
  const classroomMap = await ensureClassrooms();
  const teacherIds = teachers.map((teacher) => teacher.id);

  await ensureCurrentSemesterCourses(
    currentSemester.number,
    currentSemester.id,
    groups,
    teacherIds,
    classroomMap,
  );

  const courseAssignments: Record<string, string[]> = {};
  for (const semesterNumber of [1, 2, 3, 4]) {
    const semesterId = semesterRecords[semesterNumber]?.id;
    if (!semesterId) {
      continue;
    }

    for (const groupKey of ['firstGroup', 'secondGroup'] as const) {
      const groupId = groups[groupKey].id;
      const assignments: string[] = [];
      const subjectCodes = ['CS101', 'CS102', 'CS103', 'ENG101', 'CS201', 'CS202', 'CS203', 'DB201', 'CS301', 'OS301', 'AL301', 'WEB301', 'DB401', 'NET401', 'SE401', 'MOB401'];

      for (const subjectCode of subjectCodes.slice((semesterNumber - 1) * 4, (semesterNumber - 1) * 4 + 4)) {
        const subject = await prisma.subject.findUnique({ where: { code: subjectCode } });
        if (!subject) {
          continue;
        }
        const course = await prisma.course.upsert({
          where: { subjectId_semesterId_groupId: { subjectId: subject.id, semesterId, groupId } },
          update: { teacherId: teacherIds[(semesterNumber + assignments.length) % teacherIds.length], updatedAt: new Date() },
          create: {
            subjectId: subject.id,
            semesterId,
            groupId,
            teacherId: teacherIds[(semesterNumber + assignments.length) % teacherIds.length]
          }
        });
        assignments.push(course.id);
      }

      courseAssignments[`${semesterNumber}:${groupId}`] = assignments;
    }
  }

  await ensurePastSemesterGrades(
    studentRecords,
    semesterRecords,
    courseAssignments,
  );

  const demoStudentRecord = studentRecords.find(
    (student) => student.email === 'student@campus.kz',
  );
  if (!demoStudentRecord) {
    throw new Error('Seeded demo student record was not created.');
  }
  await ensureCurrentSemesterEnrollments(
    demoStudentRecord.id,
    groups.firstGroup.id,
    currentSemester.id,
  );

  const demoStudent = await prisma.student.findUnique({
    where: { id: demoStudentRecord.id },
  });
  if (!demoStudent) {
    throw new Error('Seeded demo student could not be read back from the database.');
  }
  const transcriptType = await prisma.documentType.findUnique({
    where: { name: 'Transcript' },
  });
  if (transcriptType) {
    const existingDocument = await prisma.document.findFirst({
      where: {
        studentId: demoStudent.id,
        documentTypeId: transcriptType.id,
        title: 'Transcript 2024',
      },
    });

    if (!existingDocument) {
      await prisma.document.create({
        data: {
          studentId: demoStudent.id,
          documentTypeId: transcriptType.id,
          title: 'Transcript 2024',
          fileUrl: 'https://example.com/documents/transcript-demo.pdf',
          issuedAt: toDate('2024-06-25'),
        },
      });
    }
  }

  await ensureCampusObjects(csDepartment.id);
  const demoUser = await prisma.user.findUnique({
    where: { email: 'student@campus.kz' },
    select: { id: true },
  });
  if (!demoUser) {
    throw new Error('Seeded demo student user could not be read back from the database.');
  }
  await ensureNotifications([
    { id: adminUser.id, email: 'admin@campus.kz' },
    { id: demoUser.id, email: 'student@campus.kz' },
  ]);
}

async function printDatabaseSummary(): Promise<void> {
  const [
    users,
    students,
    teachers,
    groups,
    subjects,
    courses,
    scheduleEntries,
    grades,
    notifications,
    campusObjects,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.group.count(),
    prisma.subject.count(),
    prisma.course.count(),
    prisma.scheduleEntry.count(),
    prisma.grade.count(),
    prisma.notification.count(),
    prisma.campusObject.count(),
  ]);

  console.log('Seed complete. Database row counts:');
  console.log(`  Users: ${users}`);
  console.log(`  Students: ${students}`);
  console.log(`  Teachers: ${teachers}`);
  console.log(`  Groups: ${groups}`);
  console.log(`  Subjects: ${subjects}`);
  console.log(`  Courses: ${courses}`);
  console.log(`  ScheduleEntries: ${scheduleEntries}`);
  console.log(`  Grades: ${grades}`);
  console.log(`  Notifications: ${notifications}`);
  console.log(`  CampusObjects: ${campusObjects}`);
}

function getDatabaseTarget(databaseUrl: string): string {
  const parsedUrl = new URL(databaseUrl);
  const defaultPort =
    parsedUrl.protocol === 'postgresql:' || parsedUrl.protocol === 'postgres:'
      ? '5432'
      : '';
  const host =
    parsedUrl.hostname.includes(':')
      ? `[${parsedUrl.hostname}]`
      : parsedUrl.hostname;
  const database = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));

  if (!host || !database) {
    throw new Error('DATABASE_URL must include a database host and database name.');
  }

  return `${host}:${parsedUrl.port || defaultPort}/${database}`;
}

async function main(): Promise<void> {
  try {
    const envPath = resolve(__dirname, '..', '.env');
    const envResult = loadDotenv({ path: envPath });
    if (envResult.error) {
      throw new Error(`Unable to load apps/api/.env: ${envResult.error.message}`);
    }

    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error(
        'Missing required DATABASE_URL in apps/api/.env; refusing to seed without a configured database.',
      );
    }
    console.log(`Seeding database: ${getDatabaseTarget(databaseUrl)}`);
    const demoPassword = process.env.SEED_DEMO_PASSWORD?.trim();
    if (!demoPassword || demoPassword.length < 8) {
      throw new Error(
        'SEED_DEMO_PASSWORD in apps/api/.env must be at least 8 characters.',
      );
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg(new Pool({ connectionString: databaseUrl })),
    });
    demoPasswordHash = await hash(demoPassword);

    await seed();
    await printDatabaseSummary();
  } catch (error) {
    console.error('Prisma seed failed:', error);
    process.exitCode = 1;
  } finally {
    if (typeof prisma !== 'undefined') {
      try {
        await prisma.$disconnect();
      } catch (error) {
        console.error('Failed to disconnect Prisma after seeding:', error);
        process.exitCode = 1;
      }
    }
  }
}

void main();
