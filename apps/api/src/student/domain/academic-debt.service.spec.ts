import { AcademicDebtService } from './academic-debt.service';

describe('AcademicDebtService', () => {
  it('reports the latest failed attempt, but clears debt after a passing retake', () => {
    const debts = new AcademicDebtService().findDebts([
      {
        subjectId: 'failed',
        createdAt: new Date('2025-01-01'),
        enrollmentStatus: 'FAILED',
        finalGpaPoints: 0,
      },
      {
        subjectId: 'resolved',
        createdAt: new Date('2025-01-01'),
        enrollmentStatus: 'FAILED',
        finalGpaPoints: 0,
      },
      {
        subjectId: 'resolved',
        createdAt: new Date('2025-06-01'),
        enrollmentStatus: 'PASSED',
        finalGpaPoints: 2,
      },
    ]);

    expect(debts.map((debt) => debt.subjectId)).toEqual(['failed']);
  });
});
