import { Router } from 'express';
import { sendEmailCode, verifyEmailCode, sendEmailResetCode, verifyEmailResetCode } from '../controllers/EmailController';
const router = Router();

router.post('/send-email-code', sendEmailCode);

router.post('/verify-email-code', verifyEmailCode);

router.post('/reset/send-code', sendEmailResetCode);

router.post('/reset/verify-code', verifyEmailResetCode);


export default router;