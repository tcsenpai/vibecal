import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import xss from 'xss';

// Custom sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return xss(obj.trim());
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg,
        value: err.type === 'field' ? err.value : undefined
      }))
    });
  }
  next();
};

// Common validation chains
export const userValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters and contain uppercase, lowercase, number, and special character'),
  body('firstName')
    .optional()
    .isLength({ max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name must contain only letters and spaces'),
  body('lastName')
    .optional()
    .isLength({ max: 50 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name must contain only letters and spaces')
];

export const eventValidation = [
  body('title')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title is required and must be under 255 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be under 2000 characters'),
  body('location')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Location must be under 255 characters'),
  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('isAllDay')
    .optional()
    .isBoolean()
    .withMessage('isAllDay must be a boolean'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean'),
  body('eventType')
    .optional()
    .isIn(['regular', 'voting'])
    .withMessage('Event type must be either regular or voting')
];

export const voteValidation = [
  body('timeSlotId')
    .isInt({ min: 1 })
    .withMessage('Valid time slot ID is required'),
  body('voteType')
    .isIn(['yes', 'no', 'maybe'])
    .withMessage('Vote type must be yes, no, or maybe'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required for guest voting'),
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name must contain only letters and spaces')
];

// Custom validation for date ranges
export const validateDateRange = (req: Request, res: Response, next: NextFunction) => {
  const { startTime, endTime } = req.body;
  
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'endTime', message: 'End time must be after start time' }]
      });
    }
    
    // Prevent events more than 2 years in the future
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    
    if (start > twoYearsFromNow) {
      return res.status(400).json({
        error: 'Validation failed',
        details: [{ field: 'startTime', message: 'Event cannot be scheduled more than 2 years in the future' }]
      });
    }
  }
  
  next();
};