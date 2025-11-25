import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';
import { generateToeknPair, verifyRefreshToken, generateAccessToken, hashRefreshToken } from '../utils/JwtUtils';

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
    console.log("@@@ login", req.body);
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

        // 사용자 타입 결정 (role이 없으면 'member'로 기본값 설정)
        const userType = (user.role as 'guest' | 'member' | 'admin') || 'member';

        // ===== 기존 코드 (활성화) =====
        // JWT 토큰 쌍 생성 (Access Token + Refresh Token)
        const tokenPair = generateToeknPair({
            id: user.idx,
            type: userType,
        });

        // ===== DB 저장 코드 (활성화) =====
        // Refresh Token을 해시화 (DB에 평문 저장 금지)
        const refreshTokenHash = hashRefreshToken(tokenPair.refreshToken);

        // ===== 해시 확인용 (개발/테스트 목적) =====
        console.log('=== Refresh Token 해시 확인 ===');
        console.log('원본 Refresh Token (평문):', tokenPair.refreshToken);
        console.log('해시화된 Refresh Token:', refreshTokenHash);
        console.log('================================');
        // ===== 해시 확인용 끝 =====

        // Refresh Token 만료 시간 계산 (7일 후)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // 기기 정보 추출 (선택사항 - User-Agent에서)
        const deviceInfo = req.headers['user-agent'] || 'Unknown';

        // IP 주소 추출 (선택사항)
        const ipAddress = req.ip || req.socket.remoteAddress || 'Unknown';

        // 기존 Refresh Token이 있으면 무효화 (선택사항 - 여러 기기 지원 시 주석 처리)
        await prisma.refresh_tokens.updateMany({
            where: {
                user_id: user.idx,
                is_revoked: false,
            },
            data: {
                is_revoked: true,
            },
        });

        // Refresh Token을 DB에 저장
        await prisma.refresh_tokens.create({
            data: {
                user_id: user.idx,
                token_hash: refreshTokenHash,
                expires_at: expiresAt,
                device_info: deviceInfo,
                ip_address: ipAddress,
                is_revoked: false,
                created_at: new Date(),
            },
        });
        // ===== DB 저장 코드 끝 =====

        // 프론트엔드 authStore 형식에 맞춰서 응답 (토큰을 응답 본문에 포함)
        return res.status(200).json({ 
            message: '로그인 성공', 
            user: {
                idx: user.idx,
                email: user.user_id,
                nickname: user.nickname || '',
                role: userType,
            },
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            accessTokenExpiresIn: tokenPair.accessTokenExpiresIn,
            refreshTokenExpiresIn: tokenPair.refreshTokenExpiresIn,
        })
        // ===== 기존 코드 끝 =====


    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '로그인 오류 에러:', error })
    }
}


// Refresh Token으로 새 Access Token 발급
export const refreshAccessToken = async (req: Request, res: Response) => {
    try {
        // 요청 본문에서 Refresh Token 가져오기
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh Token이 필요합니다.' });
        }

        // ===== 기존 코드 (주석 처리) =====
        // // Refresh Token 검증
        // try {
        //     const decoded = verifyRefreshToken(refreshToken);
        //
        //     // DB에서 사용자 확인 (선택사항 - 토큰이 유효한지 추가 확인)
        //     const user = await prisma.users.findUnique({
        //         where: {
        //             idx: decoded.id
        //         }
        //     });
        //
        //     if (!user) {
        //         return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        //     }
        //
        //     // 사용자 타입 결정
        //     const userType = (user.role as 'guest' | 'member' | 'admin') || 'member';
        //
        //     // 새 Access Token 생성
        //     const newAccessToken = generateAccessToken({
        //         id: decoded.id,
        //         type: userType,
        //     });
        //
        //     return res.status(200).json({
        //         message: 'Access Token 갱신 성공',
        //         accessToken: newAccessToken,
        //     });
        //
        // } catch (error) {
        //     // Refresh Token이 유효하지 않거나 만료된 경우
        //     return res.status(401).json({ 
        //         message: '유효하지 않거나 만료된 Refresh Token입니다.',
        //         error: error instanceof Error ? error.message : 'Token verification failed'
        //     });
        // }
        // ===== 기존 코드 끝 =====

        // ===== DB 검증 코드 (활성화) =====
        // 1단계: JWT 서명 검증 (토큰이 유효한 형식인지 확인)
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch (error) {
            return res.status(401).json({ 
                message: '유효하지 않거나 만료된 Refresh Token입니다.',
                error: error instanceof Error ? error.message : 'Token verification failed'
            });
        }

        // 2단계: Refresh Token을 해시화
        const refreshTokenHash = hashRefreshToken(refreshToken);

        // 3단계: DB에서 Refresh Token 검색
        const storedToken = await prisma.refresh_tokens.findFirst({
            where: {
                user_id: decoded.id,
                token_hash: refreshTokenHash,
                is_revoked: false,
                expires_at: { gt: new Date() },
            },
            include: { users: true },
        });

        // 4단계: DB에 토큰이 없거나 무효화된 경우
        if (!storedToken || !storedToken.users) {
            return res.status(401).json({ 
                message: '유효하지 않거나 만료된 Refresh Token입니다.',
                error: 'Token not found in database or revoked'
            });
        }

        // 5단계: 사용자 정보 확인
        const user = storedToken.users;
        const userType = (user.role as 'guest' | 'member' | 'admin') || 'member';

        // 6단계: 새 Access Token 생성
        const newAccessToken = generateAccessToken({
            id: decoded.id,
            type: userType,
        });

        // 7단계: 마지막 사용 시간 업데이트
        await prisma.refresh_tokens.update({
            where: { id: storedToken.id },
            data: { last_used_at: new Date() },
        });

        // 8단계: 새 Access Token 반환
        return res.status(200).json({
            message: 'Access Token 갱신 성공',
            accessToken: newAccessToken,
        });
        // ===== DB 검증 코드 끝 =====

    } catch (error: any) {
        console.log(error);
        res.status(500).json({ message: '토큰 갱신 오류:', error })
    }
}

// 로그아웃 - Refresh Token 무효화 (DB 저장 기능 사용 시 활성화)
export const logout = async (req: Request, res: Response) => {
    try {
        // 요청 본문에서 Refresh Token 가져오기 (선택사항)
        const { refreshToken } = req.body;

        // Refresh Token이 제공된 경우 해당 토큰만 무효화
        if (refreshToken) {
            const refreshTokenHash = hashRefreshToken(refreshToken);
            
            await prisma.refresh_tokens.updateMany({
                where: {
                    token_hash: refreshTokenHash,
                    is_revoked: false,
                },
                data: {
                    is_revoked: true,
                },
            });
        } else {
            // Refresh Token이 없으면 모든 토큰 무효화 (보안상 안전)
            const { user_id } = req.body;
            
            if (user_id) {
                const user = await prisma.users.findUnique({
                    where: { user_id: user_id },
                });

                if (user) {
                    await prisma.refresh_tokens.updateMany({
                        where: {
                            user_id: user.idx,
                            is_revoked: false,
                        },
                        data: {
                            is_revoked: true,
                        },
                    });
                }
            }
        }

        return res.status(200).json({
            message: '로그아웃 성공',
        });

    } catch (error: any) {
        console.log(error);
        res.status(500).json({ message: '로그아웃 오류:', error });
    }
}

export const myPage = async (req: Request, res: Response) => {
    try {

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '마이페이지 조회 오류 에러:', error })
    }
}