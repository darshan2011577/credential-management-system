import { UserRole } from '@credential-manager/types';

export {};

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
      user?: {
        id: string;
        employeeId: string;
        role: UserRole;
      };
    }
  }
}

