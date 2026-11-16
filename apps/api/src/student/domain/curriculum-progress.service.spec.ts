import { CurriculumProgressService } from './curriculum-progress.service';

describe('CurriculumProgressService', () => {
  it('locks an item until all its prerequisites are passed', () => {
    const result = new CurriculumProgressService().calculate([
      {
        id: 'advanced',
        credits: 4,
        prerequisiteIds: ['intro'],
      },
      {
        id: 'intro',
        credits: 3,
        prerequisiteIds: [],
      },
    ]);

    expect(result.items.map((item) => item.status)).toEqual([
      'LOCKED',
      'NOT_STARTED',
    ]);
    expect(result).toMatchObject({
      totalCredits: 7,
      earnedCredits: 0,
      percent: 0,
    });
  });
});
