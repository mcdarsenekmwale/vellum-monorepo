import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.user?.role as Role;

    if (!userRole) {
      throw new ForbiddenException('User role not found');
    }

    const hasRequiredRole = requiredRoles.some((role) => {
      const roleOrder = [Role.GUEST, Role.USER, Role.CREATOR, Role.MODERATOR, Role.ADMIN];
      const userRoleIndex = roleOrder.indexOf(userRole);
      const requiredRoleIndex = roleOrder.indexOf(role);
      return userRoleIndex >= requiredRoleIndex;
    });

    if (!hasRequiredRole) {
      throw new ForbiddenException(`Insufficient permissions. Required role: ${requiredRoles.join(', ')}, your role: ${userRole}`);
    }

    return true;
  }
}