import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from './rbac.constants';

export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
