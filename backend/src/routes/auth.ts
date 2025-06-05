import { Router } from 'express';
import { register, login, getProfile, registerValidation, loginValidation } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post('/register', registerValidation, asyncHandler(register));
router.post('/login', loginValidation, asyncHandler(login));
router.get('/profile', authenticateToken, asyncHandler(getProfile));

export default router;