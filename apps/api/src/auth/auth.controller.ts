import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type {
  AuthenticatedUser,
  AuthenticationResponse,
  AuthUserResponse,
} from './auth.types';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  login(
    @Body() body: LoginDto,
    @Req() request: Request,
  ): Promise<AuthenticationResponse> {
    return this.authService.login(body.email, body.password, request.ip);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate the refresh token' })
  refresh(
    @Body() body: RefreshTokenDto,
    @Req() request: Request,
  ): Promise<AuthenticationResponse> {
    return this.authService.refresh(body.refreshToken, request.ip);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke the supplied refresh token' })
  logout(
    @Body() body: RefreshTokenDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ): Promise<{ success: true }> {
    return this.authService.logout(body.refreshToken, user.userId, request.ip);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserResponse> {
    return this.authService.getCurrentUser(user.userId);
  }
}
