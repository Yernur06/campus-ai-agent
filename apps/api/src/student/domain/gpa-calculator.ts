export interface GradeScaleEntry {
  minScore: number;
  gpaPoints: number;
}

export interface GradeAttempt {
  subjectId: string;
  semesterId: string;
  credits: number;
  createdAt: Date;
  finalScore: number | null;
}

export interface GpaResult {
  gpa: number;
  earnedCredits: number;
}

export class GpaCalculator {
  calculate(
    attempts: readonly GradeAttempt[],
    gradeScale: readonly GradeScaleEntry[],
    semesterId?: string,
  ): GpaResult {
    const scale = [...gradeScale].sort((a, b) => a.minScore - b.minScore);
    const latestBySubject = new Map<string, GradeAttempt>();

    for (const attempt of attempts) {
      if (semesterId !== undefined && attempt.semesterId !== semesterId) {
        continue;
      }

      const current = latestBySubject.get(attempt.subjectId);
      if (!current || attempt.createdAt > current.createdAt) {
        latestBySubject.set(attempt.subjectId, attempt);
      }
    }

    let qualityPoints = 0;
    let gradedCredits = 0;
    let earnedCredits = 0;

    for (const attempt of latestBySubject.values()) {
      if (attempt.finalScore === null) {
        continue;
      }
      if (attempt.credits > 0) {
        qualityPoints += this.pointsFor(attempt.finalScore, scale) * attempt.credits;
        gradedCredits += attempt.credits;
      }
      if (this.pointsFor(attempt.finalScore, scale) > 0 && attempt.credits > 0) {
        earnedCredits += attempt.credits;
      }
    }

    return {
      gpa: gradedCredits === 0 ? 0 : this.round(qualityPoints / gradedCredits),
      earnedCredits: this.round(earnedCredits),
    };
  }

  pointsFor(score: number, gradeScale: readonly GradeScaleEntry[]): number {
    const matchingScale = gradeScale
      .filter((entry) => entry.minScore <= score)
      .reduce<GradeScaleEntry | undefined>(
        (best, entry) =>
          best === undefined || entry.minScore > best.minScore ? entry : best,
        undefined,
      );
    return matchingScale?.gpaPoints ?? 0;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
