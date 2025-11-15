import { Router } from 'express';
import { signup, myPage, findPasswordReset, login } from '../controllers/UserController';

const router = Router();

router.post('/signup', signup);

router.post('/find-password', findPasswordReset);

router.post('/login', login);

router.get('/mypage', myPage);

export default router;