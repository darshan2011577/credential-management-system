import { AUTH_CONFIG } from '@credential-manager/config';
import { UserModel } from '../models/user.model.js';
import { UserService } from './user.service.js';
import { env } from '../config/env.js';
import { ApiLogger } from '../utils/logger.js';

export async function bootstrapAdminAndSampleUsers(): Promise<void> {
  try {
    // 1. Check if any Admin user exists
    const adminCount = await UserModel.countDocuments({ role: 'ADMIN' });
    if (adminCount === 0) {
      ApiLogger.info('Bootstrap', 'No administrator account detected. Seeding initial development Admin...');
      const adminEmail = env.ADMIN_BOOTSTRAP_EMAIL || AUTH_CONFIG.bootstrap.defaultAdminEmail;
      const adminPassword = env.ADMIN_BOOTSTRAP_PASSWORD || AUTH_CONFIG.bootstrap.defaultAdminPassword;
      const adminEmployeeId = env.ADMIN_BOOTSTRAP_EMPLOYEE_ID || AUTH_CONFIG.bootstrap.defaultAdminEmployeeId;
      const adminName = env.ADMIN_BOOTSTRAP_NAME || AUTH_CONFIG.bootstrap.defaultAdminName;

      await UserService.createUser({
        employeeId: adminEmployeeId,
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        department: 'Information Technology / Security',
      });

      ApiLogger.info(
        'Bootstrap',
        `Default Admin created successfully: [${adminEmployeeId}] <${adminEmail}> (Role: ADMIN)`
      );
    }

    // 2. Check if sample employee user exists
    const sampleEmployeeEmail = AUTH_CONFIG.bootstrap.defaultEmployeeEmail;
    const existingEmployee = await UserModel.findOne({ email: sampleEmployeeEmail });
    if (!existingEmployee) {
      ApiLogger.info('Bootstrap', 'Seeding initial development sample Employee...');
      await UserService.createUser({
        employeeId: AUTH_CONFIG.bootstrap.defaultEmployeeEmployeeId,
        name: AUTH_CONFIG.bootstrap.defaultEmployeeName,
        email: sampleEmployeeEmail,
        password: AUTH_CONFIG.bootstrap.defaultEmployeePassword,
        role: 'EMPLOYEE',
        department: 'Academic Computing & Faculty Services',
      });

      ApiLogger.info(
        'Bootstrap',
        `Sample Employee created: [${AUTH_CONFIG.bootstrap.defaultEmployeeEmployeeId}] <${sampleEmployeeEmail}> (Role: EMPLOYEE)`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    ApiLogger.warn('Bootstrap', `Initial user bootstrap check completed with notice: ${msg}`);
  }
}

