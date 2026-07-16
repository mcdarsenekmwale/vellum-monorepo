import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          let token = null;
          if (request?.cookies && request.cookies['access_token']) {
            token = request.cookies['access_token'];
          }
          if (!token && request?.headers?.authorization) {
            const authHeader = request.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
              token = authHeader.substring(7);
            }
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: any) {
    return this.authService.validateUser(payload);
  }
}
