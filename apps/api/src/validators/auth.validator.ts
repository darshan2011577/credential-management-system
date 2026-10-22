import { z } from 'zod';
import { AUTH_CONFIG } from '@credential-manager/config';

export const loginBodySchema = z.object({
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z
    .string({ required_error: 'Current password is required' })
    .min(1, 'Current password cannot be empty'),
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(
      AUTH_CONFIG.passwordMinLength,
      `New password must be at least ${AUTH_CONFIG.passwordMinLength} characters long`
    ),
});

export const createUserBodySchema = z.object({
  employeeId: z
    .string({ required_error: 'Employee ID is required' })
    .trim()
    .min(2, 'Employee ID must be at least 2 characters'),
  name: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters'),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(
      AUTH_CONFIG.passwordMinLength,
      `Password must be at least ${AUTH_CONFIG.passwordMinLength} characters long`
    ),
  role: z.enum(['ADMIN', 'EMPLOYEE']).optional().default('EMPLOYEE'),
  department: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
});

export const registerBodySchema = z.object({
  name: z
    .string({ required_error: 'Full name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .email('Please enter a valid email address')
    .max(150, 'Email cannot exceed 150 characters'),
  phoneNumber: z
    .string()
    .trim()
    .max(30, 'Phone number cannot exceed 30 characters')
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .trim()
    .max(100, 'Department cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),
  employeeId: z
    .string({ required_error: 'Employee ID is required' })
    .trim()
    .min(2, 'Employee ID must be at least 2 characters')
    .max(50, 'Employee ID cannot exceed 50 characters'),
});

