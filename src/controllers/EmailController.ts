require('dotenv').config();
const nodemailer = require('nodemailer');
import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export const sendEmailCode = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        // 이메일 유효성 검사
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: '유효한 이메일 주소를 입력해주세요.' });
        }

        // 환경 변수 검증
        if (!process.env.NAVER_USER || !process.env.NAVER_PASS) {
            console.error('SMTP 설정 오류: NAVER_USER 또는 NAVER_PASS 환경 변수가 설정되지 않았습니다.');
            return res.status(500).json({ 
                message: '이메일 서비스 설정 오류입니다. 관리자에게 문의해주세요.',
                error: 'SMTP credentials not configured'
            });
        }

        const user = await prisma.users.findUnique({
            where: {
                user_id: email
            }
        })
        if(user) {
            return res.status(400).json({ message: '이미 회원가입 된 이메일입니다.' })
        }
        const code = Math.floor(100000 + Math.random() * 900000);

        const transporter = nodemailer.createTransport({
            service: 'naver',
            host: 'smtp.naver.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.NAVER_USER,
                pass: process.env.NAVER_PASS
            },
        });

        const emailOptions = {
            from: process.env.NAVER_USER,
            to: email,
            subject: '이메일 인증 코드',
            text: `인증 코드 번호는 ${code} 입니다. 3분내 입력해 주세요`
        }

        // 이메일 전송 시도
        let emailSent = false;
        try {
            await transporter.sendMail(emailOptions);
            emailSent = true;
            console.log('✅ 이메일 전송 성공:', email);
        } catch (emailError: any) {
            emailSent = false;
            console.warn('❌ 이메일 전송 실패:', emailError.message);
            if (emailError.code === 'EAUTH' || emailError.responseCode === 535) {
                console.warn('⚠️ 네이버 SMTP 인증 실패 - 앱 비밀번호를 사용해야 합니다.');
                console.warn('💡 해결 방법: 네이버 메일 > 환경설정 > POP3/IMAP 설정 > 애플리케이션 비밀번호 생성');
            }
        }

        // 이메일 전송 성공/실패와 관계없이 DB에 코드 저장
        await prisma.email_verifications.deleteMany({
            where: {
                email: email,
                purpose: 'signup'
            }
        })
        await prisma.email_verifications.create({
            data: {
                purpose: 'signup',
                email: email as string,
                code: code.toString(),
                expires_at: new Date(Date.now() + 180000),
                created_at: new Date(),
                is_used: false
            }
        })
        
        // 이메일 전송 성공 여부에 따라 다른 응답
        if (emailSent) {
            return res.status(200).json({ 
                message: '이메일 전송 성공', 
                code: code
            })
        } else {
            // 개발 모드: 이메일 전송 실패해도 코드를 응답에 포함
            return res.status(200).json({ 
                message: '인증 코드가 생성되었습니다. (이메일 전송 실패 - 개발 모드)', 
                code: code,
                devMode: true,
                warning: '이메일 전송에 실패했습니다. 네이버 앱 비밀번호를 설정해주세요.'
            })
        }
    } catch (error:any) {
        console.error('이메일 코드 생성 오류:', error);
        return res.status(500).json({ 
            message: '인증 코드 생성 실패', 
            error: error.message || 'Unknown error'
        })
    }
}

export const verifyEmailCode = async (req: Request, res: Response) => {
    
    const { email, code } = req.body;
    const recorded = await prisma.email_verifications.findFirst({
        where: {
            email: email,
            code: code.toString(),
            purpose: 'signup',
            is_used: false
        },
        orderBy: {
            created_at: 'desc'
        }
    })

    if(!recorded) {
        return res.status(400).json({ message: '인증 코드가 일치하지 않습니다.' })
    }

    const now = new Date(); // 현재 시간
    const created = new Date(recorded.created_at || ''); // 인증 코드 생성 시간
    const diff = (now.getTime() - created.getTime()) / 1000; // 현재 시간과 인증 코드 생성 시간의 차이를 초로 계산 ms로 계산

    if(diff > 180) {
        await prisma.email_verifications.delete({
            where: {
                idx: recorded.idx
            }
        })
        return res.status(400).json({ message: '인증 코드가 만료되었습니다.' })
    } else {
        await prisma.email_verifications.delete({
            where: {
                idx: recorded.idx
            }
        })
        return res.status(200).json({ message: '인증 코드가 일치합니다.' })
    }
}

export const sendEmailResetCode = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        // 이메일 유효성 검사
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: '유효한 이메일 주소를 입력해주세요.' });
        }

        // 환경 변수 검증
        if (!process.env.NAVER_USER || !process.env.NAVER_PASS) {
            console.error('SMTP 설정 오류: NAVER_USER 또는 NAVER_PASS 환경 변수가 설정되지 않았습니다.');
            return res.status(500).json({ 
                message: '이메일 서비스 설정 오류입니다. 관리자에게 문의해주세요.',
                error: 'SMTP credentials not configured'
            });
        }

        const user = await prisma.users.findUnique({
            where: {
                user_id: email
            }
        })
        if(!user) {
            return res.status(400).json({ message: '가입되지 않은 이메일입니다.' })
        }
        const code = Math.floor(100000 + Math.random() * 900000);

        const transporter = nodemailer.createTransport({
            service: 'naver',
            host: 'smtp.naver.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.NAVER_USER,
                pass: process.env.NAVER_PASS
            },
        });

        const emailOptions = {
            from: process.env.NAVER_USER,
            to: email,
            subject: '이메일 인증 코드',
            text: `인증 코드 번호는 ${code} 입니다. 3분내 입력해 주세요`
        }

        // 이메일 전송 시도
        let emailSent = false;
        try {
            await transporter.sendMail(emailOptions);
            emailSent = true;
            console.log('✅ 이메일 전송 성공:', email);
        } catch (emailError: any) {
            emailSent = false;
            console.warn('❌ 이메일 전송 실패:', emailError.message);
            if (emailError.code === 'EAUTH' || emailError.responseCode === 535) {
                console.warn('⚠️ 네이버 SMTP 인증 실패 - 앱 비밀번호를 사용해야 합니다.');
                console.warn('💡 해결 방법: 네이버 메일 > 환경설정 > POP3/IMAP 설정 > 애플리케이션 비밀번호 생성');
            }
        }

        // 이메일 전송 성공/실패와 관계없이 DB에 코드 저장
        await prisma.email_verifications.deleteMany({
            where: {
                email: email,
                purpose: 'reset'
            }
        })
        await prisma.email_verifications.create({
            data: {
                purpose: 'reset',
                email: email as string,
                user_id: email,
                code: code.toString(),
                expires_at: new Date(Date.now() + 180000),
                created_at: new Date(),
                is_used: false
            }
        })
        
        // 이메일 전송 성공 여부에 따라 다른 응답
        if (emailSent) {
            return res.status(200).json({ 
                message: '이메일 전송 성공', 
                code: code
            })
        } else {
            // 개발 모드: 이메일 전송 실패해도 코드를 응답에 포함
            return res.status(200).json({ 
                message: '인증 코드가 생성되었습니다. (이메일 전송 실패 - 개발 모드)', 
                code: code,
                devMode: true,
                warning: '이메일 전송에 실패했습니다. 네이버 앱 비밀번호를 설정해주세요.'
            })
        }
    } catch (error:any) {
        console.error('이메일 코드 생성 오류:', error);
        return res.status(500).json({ 
            message: '인증 코드 생성 실패', 
            error: error.message || 'Unknown error'
        })
    }
}

export const verifyEmailResetCode = async (req: Request, res: Response) => {
    const { email, code } = req.body;
    const recorded = await prisma.email_verifications.findFirst({
        where: {
            email: email,
            code: code.toString(),
            purpose: 'reset',
            is_used: false
        },
        orderBy: {
            created_at: 'desc'
        }
    })
    if(!recorded) {
        return res.status(400).json({ message: '인증 코드가 일치하지 않습니다.' })
    }

    const now = new Date();
    const created = new Date(recorded.created_at || '');
    const diff = (now.getTime() - created.getTime()) / 1000;

    if(diff > 180) {
        await prisma.email_verifications.delete({
            where: {
                idx: recorded.idx
            }
        })
        return res.status(400).json({ message: '인증 코드가 만료되었습니다.' })
    } else {
        await prisma.email_verifications.delete({
            where: {
                idx: recorded.idx
            }
        })
        return res.status(200).json({ message: '인증 코드가 일치합니다.' })
    }
}