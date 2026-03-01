import express from 'express';
import { body, validationResult } from 'express-validator';
import { register, verifyEmail, login, refresh, logout, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('username').trim().isLength({ min: 2, max: 30 }),
    body('password').isLength({ min: 6 }),
  ],
  validate,
  register
);

router.post(
  '/verify-email',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  validate,
  verifyEmail
);

router.post(
  '/login',
  [
    body('emailOrUsername').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 6 }),
  ],
  validate,
  resetPassword
);

export default router;
