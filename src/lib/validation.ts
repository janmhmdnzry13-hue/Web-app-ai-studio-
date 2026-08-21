/**
 * ORIGIN Validation Engine
 * Type-safe, zero-dependency schema validation for forms, contracts, and API payloads.
 */

export type ValidationRule<T> = (value: T, fieldName: string) => string | null;

export interface ValidationResult<T> {
  isValid: boolean;
  errors: Partial<Record<keyof T, string>>;
}

export const Validators = {
  required(message = 'This field is required'): ValidationRule<unknown> {
    return (value, fieldName) => {
      if (value === undefined || value === null || value === '') {
        return message || `${fieldName} is required`;
      }
      if (Array.isArray(value) && value.length === 0) {
        return message || `${fieldName} cannot be empty`;
      }
      return null;
    };
  },

  email(message = 'Please enter a valid email address'): ValidationRule<string> {
    return (value) => {
      if (!value) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value) ? null : message;
    };
  },

  minLength(min: number, message?: string): ValidationRule<string> {
    return (value, fieldName) => {
      if (!value) return null;
      return value.length >= min
        ? null
        : message || `${fieldName} must be at least ${min} characters`;
    };
  },

  maxLength(max: number, message?: string): ValidationRule<string> {
    return (value, fieldName) => {
      if (!value) return null;
      return value.length <= max
        ? null
        : message || `${fieldName} cannot exceed ${max} characters`;
    };
  },

  minNumber(min: number, message?: string): ValidationRule<number> {
    return (value, fieldName) => {
      if (value === undefined || value === null) return null;
      return value >= min
        ? null
        : message || `${fieldName} must be at least ${min}`;
    };
  },

  maxNumber(max: number, message?: string): ValidationRule<number> {
    return (value, fieldName) => {
      if (value === undefined || value === null) return null;
      return value <= max
        ? null
        : message || `${fieldName} cannot exceed ${max}`;
    };
  },

  isoDate(message = 'Please provide a valid ISO date string'): ValidationRule<string> {
    return (value) => {
      if (!value) return null;
      const parsed = Date.parse(value);
      return !isNaN(parsed) ? null : message;
    };
  },
};

/**
 * Validate an object against schema rules
 */
export function validateSchema<T extends Record<string, unknown>>(
  data: T,
  schema: Partial<{ [K in keyof T]: ValidationRule<T[K]>[] }>
): ValidationResult<T> {
  const errors: Partial<Record<keyof T, string>> = {};
  let isValid = true;

  for (const key in schema) {
    const rules = schema[key];
    if (!rules) continue;

    const value = data[key];
    for (const rule of rules) {
      const error = rule(value, String(key));
      if (error) {
        errors[key] = error;
        isValid = false;
        break; // First error per field
      }
    }
  }

  return { isValid, errors };
}
