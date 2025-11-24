import { Router } from 'express';
import { signup, myPage, findPasswordReset, login, refreshAccessToken, logout } from '../controllers/UserController';
// import AuthJWT from '../middleware/AuthJWT';
import { authenticateToken } from '../middleware/AuthJWT';

const router = Router();

router.post('/signup', signup);

router.post('/find-password', findPasswordReset);

router.post('/login', login);

router.post('/refresh', refreshAccessToken);

router.post('/logout', logout); // DB 저장 기능 활성화

router.get('/mypage', authenticateToken, myPage);

export default router;