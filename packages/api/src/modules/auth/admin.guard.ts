import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  /** Roles that qualify as "admin" in legacy equality checks. */
  private readonly ADMIN_LEVEL_ROLES: ReadonlySet<Role> = new Set([
    Role.ADMIN,
    Role.PLATFORM_ADMIN,
    Role.SUPER_ADMIN,
  ]);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request.user?.role as Role | undefined;
    return !!role && this.ADMIN_LEVEL_ROLES.has(role);
  }
}