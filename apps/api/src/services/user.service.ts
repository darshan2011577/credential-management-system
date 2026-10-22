import { CreateUserDto, SafeUser, UpdateUserDto, UserRole, UserStatus } from '@credential-manager/types';
import { IUserDocument, toPublicUser, UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../utils/errors.js';

export class UserService {
  /**
   * Create a new user with hashed password and unique constraints check
   */
  static async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedEmployeeId = dto.employeeId.trim().toUpperCase();

    // Check duplicate email
    const existingEmail = await UserModel.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw AppError.conflict(`A user with email "${normalizedEmail}" already exists.`);
    }

    // Check duplicate employeeId
    const existingEmployeeId = await UserModel.findOne({ employeeId: normalizedEmployeeId });
    if (existingEmployeeId) {
      throw AppError.conflict(`A user with Employee ID "${normalizedEmployeeId}" already exists.`);
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await UserModel.create({
      employeeId: normalizedEmployeeId,
      name: dto.name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: dto.role || 'EMPLOYEE',
      status: 'ACTIVE',
      department: dto.department?.trim() || '',
    });

    return toPublicUser(user);
  }

  /**
   * Find user by MongoDB ObjectId
   */
  static async findUserById(id: string, includePasswordHash: boolean = false): Promise<IUserDocument | null> {
    const query = UserModel.findById(id);
    if (includePasswordHash) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  /**
   * Find user by Email (case-normalized)
   */
  static async findUserByEmail(email: string, includePasswordHash: boolean = false): Promise<IUserDocument | null> {
    const normalized = email.trim().toLowerCase();
    const query = UserModel.findOne({ email: normalized });
    if (includePasswordHash) {
      query.select('+passwordHash');
    }
    return query.exec();
  }

  /**
   * Find user by Employee ID
   */
  static async findUserByEmployeeId(employeeId: string): Promise<IUserDocument | null> {
    const normalized = employeeId.trim().toUpperCase();
    return UserModel.findOne({ employeeId: normalized }).exec();
  }

  /**
   * Update general user profile
   */
  static async updateUser(id: string, updateData: UpdateUserDto): Promise<SafeUser | null> {
    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    if (updateData.name !== undefined) user.name = updateData.name.trim();
    if (updateData.department !== undefined) user.department = updateData.department.trim();
    if (updateData.role !== undefined) user.role = updateData.role;
    if (updateData.status !== undefined) user.status = updateData.status;

    if (updateData.email) {
      const normalizedEmail = updateData.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await UserModel.findOne({ email: normalizedEmail, _id: { $ne: id } });
        if (existing) {
          throw AppError.conflict(`Email "${normalizedEmail}" is already taken by another account.`);
        }
        user.email = normalizedEmail;
      }
    }

    await user.save();
    return toPublicUser(user);
  }

  /**
   * Update user password hash and record timestamp
   */
  static async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    user.passwordHash = newPasswordHash;
    user.passwordChangedAt = new Date();
    await user.save();
  }

  /**
   * Set user status (ACTIVE, INACTIVE, SUSPENDED)
   */
  static async setUserStatus(id: string, status: UserStatus): Promise<SafeUser | null> {
    const user = await UserModel.findById(id);
    if (!user) {
      throw AppError.notFound('User not found.');
    }

    user.status = status;
    await user.save();
    return toPublicUser(user);
  }

  /**
   * Record last login timestamp
   */
  static async recordLogin(id: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $set: { lastLoginAt: new Date() },
    }).exec();
  }

  /**
   * List all users for Admin management foundation
   */
  static async listUsers(filter?: { role?: UserRole; status?: UserStatus }): Promise<SafeUser[]> {
    const query: Record<string, unknown> = {};
    if (filter?.role) query.role = filter.role;
    if (filter?.status) query.status = filter.status;

    const users = await UserModel.find(query).sort({ createdAt: -1 }).exec();
    return users.map(toPublicUser);
  }
}
