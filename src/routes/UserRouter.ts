import { Router } from 'express';
import { signup, myPage, findPasswordReset, login, refreshAccessToken, logout, deactivateAccount, updateNickname, changePassword } from '../controllers/UserController';
// import AuthJWT from '../middleware/AuthJWT';
import { authenticateToken } from '../middleware/AuthJWT';

const router = Router();

router.post('/signup', signup);

router.post('/find-password', findPasswordReset);

router.post('/login', login);

router.post('/refresh', refreshAccessToken);

router.post('/logout', logout); // DB 저장 기능 활성화

router.get('/mypage', authenticateToken, myPage);

router.post('/withdraw', authenticateToken, deactivateAccount);

// 닉네임 변경 API: 인증된 사용자만 접근 가능
router.put('/nickname', authenticateToken, updateNickname);

// 비밀번호 변경 API: 현재 비밀번호 검증 후 새 비밀번호 설정
router.post('/change-password', authenticateToken, changePassword);

export default router;