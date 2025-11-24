import { Router } from 'express';
import { signup, myPage, findPasswordReset, login, refreshAccessToken } from '../controllers/UserController';

const router = Router();

router.post('/signup', signup);

router.post('/find-password', findPasswordReset);

router.post('/login', login);

router.post('/refresh', refreshAccessToken);

router.get('/mypage', myPage);

export default router;