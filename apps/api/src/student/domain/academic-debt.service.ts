export interface AcademicAttempt {
  subjectId: string;
  createdAt: Date;
  enrollmentStatus: 'IN_PROGRESS' | 'PASSED' | 'FAILED';
  finalGpaPoints: number | null;
}

export interface AcademicDebt {
  subjectId: string;
  createdAt: Date;
}

export class AcademicDebtService {
  findDebts(attempts: readonly AcademicAttempt[]): AcademicDebt[] {
    const latestBySubject = new Map<string, AcademicAttempt>();
    for (const attempt of attempts) {
      const current = latestBySubject.get(attempt.subjectId);
      if (!current || attempt.createdAt > current.createdAt) {
        latestBySubject.set(attempt.subjectId, attempt);
      }
    }

    return [...latestBySubject.values()]
      .filter(
        (attempt) =>
          attempt.enrollmentStatus === 'FAILED' ||
          (attempt.finalGpaPoints !== null && attempt.finalGpaPoints <= 0),
      )
      .map(({ subjectId, createdAt }) => ({ subjectId, createdAt }));
  }
}
