import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const bcrypt = require('bcrypt');
require('dotenv').config();


const prisma = new PrismaClient();


// 회원가입
export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, name, nickname, birth, genderDigit } = req.body;
        
        // 유효성 검사
        if(!email || !password || !name || !nickname || !birth || !genderDigit) {
            return res.status(400).json({ message: '모든 입력 필드를 채워주세요.' })
        }

        // 이미 가입된 회원인지 확인
        const existingUser = await prisma.users.findUnique({
            where: {
                user_id: email
            }
        })
        if(existingUser) {
            return res.status(400).json({ message: '이미 가입된 회원입니다.' })
        }

        // genderDigit를 sex로 변환 (1,3 -> M, 2,4 -> F)
        const sex = (genderDigit === "1" || genderDigit === "3") ? "M" : "F";
        
        // birth + genderDigit를 rrn으로 변환 (주민등록번호 형식: YYYYMMDD,성별코드)
        // 생년월일과 성별 구분자를 쉼표로 구분
        const rrn = `${birth}`;

        // 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.users.create({
            data: {
                user_id: email,
                password: hashedPassword,
                name: name,
                nickname: nickname,
                sex: sex,
                rrn : (rrn),
                created_at: new Date(),
                updated_at: new Date(),
                use_yn: 'Y'
            }
        })

        return res.status(201).json({ message: '회원가입 성공', user: {
            user_id: user.user_id,
            name: user.name,
            password: user.password,
            nickname: user.nickname,
            sex: user.sex,
            role: user.role,
            created_at: user.created_at,
            updated_at: user.updated_at,
            use_yn: user.use_yn,
            rrn: user.rrn   
        } }) 

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '로그인 오류 에러:', error })
    }
}

// 비밀번호 변경
export const findPasswordReset = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) {
            return res.status(400).json({ message: '모든 입력 필드를 입력해 주세요' })
        }
        const user = await prisma.users.findUnique({
            where: {
                user_id: email
            }
        })
        if(!user) {
            return res.status(400).json({ message: '가입되지 않은 회원입니다.' })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.users.update({
            where: {
                user_id: email
            },
            data: {
                password: hashedPassword,
                updated_at: new Date()
            }
        })
        return res.status(200).json({ message: '비밀번호 변경 성공' })

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '비밀번호 변경 오류 에러:', error })
    }
}

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if(!email || !password) {
            return res.status(400).json({ message: '모든 입력 필드를 입력해 주세요' })
        }
        const user = await prisma.users.findUnique({
            where: {
                user_id: email
            }
        })
        if(!user) {
            return res.status(400).json({ message: '가입되지 않은 회원입니다.' })
        }

        // 비밀번호 일치 여부 확인
        // compare 함수에서 첫자리는 비밀번호 원본 즉 유저가 친 비밀번호, 두번째 자리는 DB에 저장된 비밀번호
        const isPasswordValid = await bcrypt.compare(password, user.password); 
        if(!isPasswordValid) {
            return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' })
        }

        return res.status(200).json({ message: '로그인 성공', user: {
            user_id: user.user_id,
            name: user.name,
            password: user.password,
            nickname: user.nickname,
            sex: user.sex,
            role: user.role,
        }})


    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '로그인 오류 에러:', error })
    }
}


export const myPage = async (req: Request, res: Response) => {
    try {

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '마이페이지 조회 오류 에러:', error })
    }
}