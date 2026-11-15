import { UserRole } from '../generated/prisma/enums';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
}

export interface AuthUserResponse extends AuthenticatedUser {
  email: string;
}

export interface AuthenticationResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUserResponse;
}

export interface JwtAccessPayload {
  sub: string;
  tokenType: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string;
  tokenType: 'refresh';
}
