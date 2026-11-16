export type CurriculumStatus =
  | 'PASSED'
  | 'IN_PROGRESS'
  | 'NOT_STARTED'
  | 'FAILED'
  | 'LOCKED';

export interface CurriculumProgressItem {
  id: string;
  credits: number;
  prerequisiteIds: readonly string[];
  enrollmentStatus?: 'IN_PROGRESS' | 'PASSED' | 'FAILED';
}

export interface CurriculumProgressItemResult extends CurriculumProgressItem {
  status: CurriculumStatus;
}

export interface CurriculumProgressResult {
  items: CurriculumProgressItemResult[];
  totalCredits: number;
  earnedCredits: number;
  percent: number;
}

export class CurriculumProgressService {
  calculate(
    items: readonly CurriculumProgressItem[],
  ): CurriculumProgressResult {
    const passedIds = new Set(
      items
        .filter((item) => item.enrollmentStatus === 'PASSED')
        .map((item) => item.id),
    );
    const results: CurriculumProgressItemResult[] = [];

    for (const item of items) {
      const prerequisitesPassed = item.prerequisiteIds.every(
        (id) => passedIds.has(id),
      );
      let status: CurriculumStatus;

      if (item.enrollmentStatus === 'PASSED') {
        status = 'PASSED';
      } else if (item.enrollmentStatus === 'FAILED') {
        status = 'FAILED';
      } else if (item.enrollmentStatus === 'IN_PROGRESS') {
        status = 'IN_PROGRESS';
      } else if (!prerequisitesPassed) {
        status = 'LOCKED';
      } else {
        status = 'NOT_STARTED';
      }

      results.push({ ...item, status });
    }

    const totalCredits = items.reduce((total, item) => total + item.credits, 0);
    const earnedCredits = results.reduce(
      (total, item) => total + (item.status === 'PASSED' ? item.credits : 0),
      0,
    );

    return {
      items: results,
      totalCredits,
      earnedCredits,
      percent:
        totalCredits === 0
          ? 0
          : Math.round((earnedCredits / totalCredits) * 10000) / 100,
    };
  }
}
