import { GpaCalculator, GradeAttempt, GradeScaleEntry } from './gpa-calculator';

describe('GpaCalculator', () => {
  const calculator = new GpaCalculator();
  const scale: GradeScaleEntry[] = [
    { minScore: 0, gpaPoints: 0 },
    { minScore: 50, gpaPoints: 1 },
    { minScore: 70, gpaPoints: 2 },
    { minScore: 90, gpaPoints: 4 },
  ];

  it('uses only the latest final attempt for a retaken subject', () => {
    const attempts: GradeAttempt[] = [
      {
        subjectId: 'math',
        semesterId: 'fall',
        credits: 4,
        createdAt: new Date('2025-01-01'),
        finalScore: 95,
      },
      {
        subjectId: 'math',
        semesterId: 'spring',
        credits: 4,
        createdAt: new Date('2025-06-01'),
        finalScore: 40,
      },
    ];

    expect(calculator.calculate(attempts, scale)).toEqual({
      gpa: 0,
      earnedCredits: 0,
    });
  });

  it('counts failed finals in GPA and ignores zero-credit courses', () => {
    const attempts: GradeAttempt[] = [
      {
        subjectId: 'failed',
        semesterId: 'fall',
        credits: 3,
        createdAt: new Date('2025-01-01'),
        finalScore: 25,
      },
      {
        subjectId: 'no-credit',
        semesterId: 'fall',
        credits: 0,
        createdAt: new Date('2025-01-02'),
        finalScore: 100,
      },
      {
        subjectId: 'unfinished',
        semesterId: 'fall',
        credits: 3,
        createdAt: new Date('2025-01-03'),
        finalScore: null,
      },
    ];

    expect(calculator.calculate(attempts, scale)).toEqual({
      gpa: 0,
      earnedCredits: 0,
    });
  });

  it('returns zero GPA when no final grade has positive credits', () => {
    expect(
      calculator.calculate(
        [
          {
            subjectId: 'unfinished',
            semesterId: 'fall',
            credits: 3,
            createdAt: new Date(),
            finalScore: null,
          },
        ],
        scale,
      ),
    ).toEqual({ gpa: 0, earnedCredits: 0 });
  });
});
