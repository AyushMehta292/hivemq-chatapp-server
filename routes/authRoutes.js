import express from 'express';
import { body, validationResult } from 'express-validator';
import { register, login } from '../controllers/authController.js';

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
  '/login',
  [
    body('emailOrUsername').trim().notEmpty(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

export default router;
