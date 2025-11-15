require('dotenv').config();
const nodemailer = require('nodemailer');
import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export const sendEmailCode = async (req: Request, res: Response) => {

        const { email } = req.body;
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

        try {
            await transporter.sendMail(emailOptions);
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
            return res.status(200).json({ message: '이메일 전송 성공', code: code })
        } catch (error:any) {
            console.error(error);
            return res.status(500).json({ message: '이메일 전송 실패', error: error.message })
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
    const { email } = req.body;
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

        try {
            await transporter.sendMail(emailOptions);
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
            return res.status(200).json({ message: '이메일 전송 성공', code: code })
        } catch (error:any) {
            console.error(error);
            return res.status(500).json({ message: '이메일 전송 실패', error: error.message })
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