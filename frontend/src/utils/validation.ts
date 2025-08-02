// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const isValidASIN = (asin: string): boolean => {
  const asinRegex = /^[A-Z0-9]{10}$/;
  return asinRegex.test(asin);
};

export const isValidURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
};

export const isValidPrice = (price: number): boolean => {
  return price > 0 && price < 1000000 && Number.isFinite(price);
};

export const isValidQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity >= 0;
};

// Form validation helpers
export const validateRequired = (value: any): string | null => {
  if (value === null || value === undefined || value === '') {
    return 'This field is required';
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  if (!isValidEmail(email)) return 'Please enter a valid email address';
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!isValidPassword(password)) {
    return 'Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number';
  }
  return null;
};

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): string | null => {
  if (!confirmPassword) return 'Please confirm your password';
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

export const validateASIN = (asin: string): string | null => {
  if (!asin) return 'ASIN is required';
  if (!isValidASIN(asin)) return 'Please enter a valid Amazon ASIN (10 characters, letters and numbers)';
  return null;
};

export const validatePrice = (price: number | string): string | null => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'Please enter a valid price';
  if (!isValidPrice(numPrice)) return 'Price must be between $0.01 and $999,999.99';
  return null;
};

export const validateQuantity = (quantity: number | string): string | null => {
  const numQuantity = typeof quantity === 'string' ? parseInt(quantity) : quantity;
  if (isNaN(numQuantity)) return 'Please enter a valid quantity';
  if (!isValidQuantity(numQuantity)) return 'Quantity must be a positive integer';
  return null;
};

export const validateURL = (url: string): string | null => {
  if (!url) return 'URL is required';
  if (!isValidURL(url)) return 'Please enter a valid URL';
  return null;
};

export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone) return 'Phone number is required';
  if (!isValidPhoneNumber(phone)) return 'Please enter a valid phone number';
  return null;
};

// Multi-field validation
export const validateRange = (
  min: number | string,
  max: number | string,
  fieldName: string = 'value'
): string | null => {
  const numMin = typeof min === 'string' ? parseFloat(min) : min;
  const numMax = typeof max === 'string' ? parseFloat(max) : max;
  
  if (isNaN(numMin) || isNaN(numMax)) {
    return `Please enter valid ${fieldName} range`;
  }
  
  if (numMin >= numMax) {
    return `Minimum ${fieldName} must be less than maximum ${fieldName}`;
  }
  
  return null;
};

export const validateDateRange = (startDate: Date, endDate: Date): string | null => {
  if (!startDate || !endDate) {
    return 'Both start and end dates are required';
  }
  
  if (startDate >= endDate) {
    return 'Start date must be before end date';
  }
  
  return null;
};

// File validation
export const validateFileSize = (file: File, maxSizeMB: number): string | null => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return `File size must be less than ${maxSizeMB}MB`;
  }
  return null;
};

export const validateFileType = (file: File, allowedTypes: string[]): string | null => {
  if (!allowedTypes.includes(file.type)) {
    return `File type not supported. Allowed types: ${allowedTypes.join(', ')}`;
  }
  return null;
};

// Custom validation function type
export type ValidationFunction = (value: any) => string | null;

// Compose multiple validation functions
export const composeValidators = (...validators: ValidationFunction[]): ValidationFunction => {
  return (value: any) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };
};