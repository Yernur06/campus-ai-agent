import { UserRole } from '../generated/prisma/enums';
import { AuthenticatedUser } from '../auth/auth.types';

export function maskIin(
  value: string | null | undefined,
): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return value.replace(/\d(?=(?:\D*\d){4})/g, '*');
}

export function maskIinForUser(
  value: string | null | undefined,
  ownerStudentId: string,
  user: AuthenticatedUser,
): string | null | undefined {
  if (
    user.role === UserRole.ADMIN ||
    (user.role === UserRole.STUDENT && user.studentId === ownerStudentId)
  ) {
    return value;
  }

  return maskIin(value);
}
