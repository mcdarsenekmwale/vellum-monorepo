import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('AuthAudit');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, url, ip, headers } = req;

    if (!url.startsWith('/api/auth/') && !url.startsWith('/api/admin/')) {
      next();
      return;
    }

    const startTime = Date.now();
    const userAgent = headers['user-agent'] || 'unknown';

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      const isAuthFailure =
        url.startsWith('/api/auth/login') && statusCode >= 400 ||
        url.startsWith('/api/auth/refresh') && statusCode >= 400 ||
        url.startsWith('/api/auth/register') && statusCode >= 400;

      const isAuthSuccess =
        (url.startsWith('/api/auth/login') || url.startsWith('/api/auth/register')) &&
        statusCode < 300;

      const isAdminUnauthorized =
        url.startsWith('/api/admin/') && statusCode === 401;

      if (isAuthFailure) {
        this.logger.warn(
          `[AUTH_FAILURE] ${method} ${url} - ${statusCode} - IP: ${ip} - UA: ${userAgent.slice(0, 80)}`,
        );
      } else if (isAuthSuccess) {
        this.logger.log(
          `[AUTH_SUCCESS] ${method} ${url} - ${statusCode} - IP: ${ip} - ${duration}ms`,
        );
      } else if (isAdminUnauthorized) {
        this.logger.warn(
          `[ADMIN_UNAUTHORIZED] ${method} ${url} - ${statusCode} - IP: ${ip} - UA: ${userAgent.slice(0, 60)}`,
        );
      }
    });

    next();
  }
}
