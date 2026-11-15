import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../generated/prisma/enums';
import { AuthenticatedUser } from '../auth/auth.types';
import { PolicyService } from './policy.service';

type StudentScopedRequest = Request & {
  user: AuthenticatedUser;
  studentScope?: string;
};

@Injectable()
export class StudentScopeGuard implements CanActivate {
  constructor(private readonly policyService: PolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StudentScopedRequest>();
    if (request.user.role === UserRole.STUDENT) {
      if (!request.user.studentId) {
        throw new ForbiddenException(
          'You are not allowed to access this resource',
        );
      }
      request.studentScope = request.user.studentId;
      return true;
    }

    const paramStudentId = request.params.studentId;
    if (typeof paramStudentId !== 'string' || !paramStudentId) {
      throw new ForbiddenException(
        'You are not allowed to access this resource',
      );
    }
    const requestedStudentId = paramStudentId;
    await this.policyService.assertCanAccessStudent(
      request.user,
      requestedStudentId,
    );
    request.studentScope = requestedStudentId;
    return true;
  }
}

export const StudentScope = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<StudentScopedRequest>();
    if (!request.studentScope) {
      throw new ForbiddenException(
        'You are not allowed to access this resource',
      );
    }
    return request.studentScope;
  },
);
