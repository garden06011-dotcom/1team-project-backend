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

        if(user.use_yn !== 'Y') {
            return res.status(403).json({ message: '비활성화된 계정입니다. 관리자에게 문의하세요.' })
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

        // ===== DB 검증 코드 (활성화) =====
        // 1단계: JWT 서명 검증 (토큰이 유효한 형식인지 확인)
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
            console.log('Refresh Token 디코딩 성공:', { id: decoded.id, type: decoded.type });
        } catch (error) {
            console.error('Refresh Token 검증 실패:', error);
            return res.status(401).json({ 
                message: '유효하지 않거나 만료된 Refresh Token입니다.',
                error: error instanceof Error ? error.message : 'Token verification failed'
            });
        }

        // 2단계: Refresh Token을 해시화
        let refreshTokenHash;
        try {
            refreshTokenHash = hashRefreshToken(refreshToken);
            console.log('Refresh Token 해시화 성공');
        } catch (error) {
            console.error('Refresh Token 해시화 실패:', error);
            return res.status(500).json({ 
                message: '토큰 처리 중 오류가 발생했습니다.',
                error: error instanceof Error ? error.message : 'Token hashing failed'
            });
        }

        // 3단계: DB에서 Refresh Token 검색
        let storedToken;
        try {
            storedToken = await prisma.refresh_tokens.findFirst({
                where: {
                    user_id: decoded.id,
                    token_hash: refreshTokenHash,
                    is_revoked: false,
                    expires_at: { gt: new Date() },
                },
                include: { users: true },
            });
            console.log('DB에서 Refresh Token 검색 완료:', storedToken ? '발견됨' : '없음');
        } catch (error) {
            console.error('DB에서 Refresh Token 검색 실패:', error);
            return res.status(500).json({ 
                message: '토큰 검색 중 오류가 발생했습니다.',
                error: error instanceof Error ? error.message : 'Database query failed'
            });
        }

        // 4단계: DB에 토큰이 없거나 무효화된 경우
        if (!storedToken || !storedToken.users) {
            console.log('Refresh Token이 DB에 없거나 무효화됨');
            return res.status(401).json({ 
                message: '유효하지 않거나 만료된 Refresh Token입니다.',
                error: 'Token not found in database or revoked'
            });
        }

        // 5단계: 사용자 정보 확인
        const user = storedToken.users;
        
        // 사용자 계정이 비활성화되었는지 확인
        if (user.use_yn !== 'Y') {
            console.log('비활성화된 사용자 계정');
            return res.status(403).json({ 
                message: '비활성화된 계정입니다. 관리자에게 문의하세요.',
            });
        }

        const userType = (user.role as 'guest' | 'member' | 'admin') || 'member';

        // 6단계: 새 Access Token 생성
        let newAccessToken;
        try {
            newAccessToken = generateAccessToken({
                id: decoded.id,
                type: userType,
            });
            console.log('새 Access Token 생성 성공');
        } catch (error) {
            console.error('Access Token 생성 실패:', error);
            return res.status(500).json({ 
                message: '토큰 생성 중 오류가 발생했습니다.',
                error: error instanceof Error ? error.message : 'Token generation failed'
            });
        }

        // 7단계: 마지막 사용 시간 업데이트
        try {
            await prisma.refresh_tokens.update({
                where: { id: storedToken.id },
                data: { last_used_at: new Date() },
            });
            console.log('Refresh Token 사용 시간 업데이트 성공');
        } catch (error) {
            console.error('Refresh Token 사용 시간 업데이트 실패:', error);
            // 이 에러는 치명적이지 않으므로 계속 진행
        }

        // 8단계: 새 Access Token 반환
        return res.status(200).json({
            message: 'Access Token 갱신 성공',
            accessToken: newAccessToken,
        });
        // ===== DB 검증 코드 끝 =====

    } catch (error: any) {
        console.error('refreshAccessToken 전체 에러:', error);
        console.error('에러 스택:', error?.stack);
        res.status(500).json({ 
            message: '토큰 갱신 오류:', 
            error: error?.message || error,
            stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        });
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

export const deactivateAccount = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: '인증 정보가 필요합니다.' });
        }

        const user = await prisma.users.findUnique({
            where: { idx: req.user.id },
            select: { use_yn: true },
        });

        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        if (user.use_yn === 'N') {
            return res.status(200).json({ message: '이미 비활성화된 계정입니다.' });
        }

        await prisma.users.update({
            where: { idx: req.user.id },
            data: {
                use_yn: 'N',
                updated_at: new Date(),
            },
        });

        await prisma.refresh_tokens.updateMany({
            where: { user_id: req.user.id, is_revoked: false },
            data: { is_revoked: true },
        });

        return res.status(200).json({ message: '계정이 비활성화되었습니다.' });
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '계정 비활성화에 실패했습니다.', error });
    }
}

// 마이페이지 조회 (현재는 빈 함수로 유지)
export const myPage = async (req: Request, res: Response) => {
    try {

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '마이페이지 조회 오류 에러:', error })
    }
}

// 닉네임 변경 API: 사용자의 닉네임을 변경하는 기능
// ===== 변경 전 코드 (주석 처리) =====
// 이전에는 닉네임 변경 기능이 없었음
// export const updateNickname = async (req: Request, res: Response) => {
//     // 함수가 존재하지 않았음
// }
// ===== 변경 전 코드 끝 =====

// ===== 변경 후 코드 (현재 활성화) =====
export const updateNickname = async (req: Request, res: Response) => {
    try {
        // JWT 토큰에서 사용자 정보 추출 (authenticateToken 미들웨어를 통해 req.user에 저장됨)
        // 변경 전: 사용자 인증 정보 확인 로직이 없었음
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: '인증된 사용자 정보가 없습니다.' });
        }

        // 요청 본문에서 새 닉네임 가져오기
        // 변경 전: nickname 파라미터를 받는 로직이 없었음
        const { nickname } = req.body;

        // 닉네임 유효성 검사
        // 변경 전: 유효성 검사 로직이 없었음
        if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
            return res.status(400).json({ message: '닉네임을 입력해주세요.' });
        }

        // 닉네임 길이 제한 (예: 최대 20자)
        // 변경 전: 길이 제한 로직이 없었음
        if (nickname.trim().length > 20) {
            return res.status(400).json({ message: '닉네임은 20자 이하여야 합니다.' });
        }

        const userIdx = req.user.id;

        // 사용자 정보 조회
        // 변경 전: 사용자 정보 조회 로직이 없었음
        const user = await prisma.users.findUnique({
            where: { idx: userIdx },
            select: { nickname: true }
        });

        if (!user) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        // 닉네임이 변경되지 않은 경우
        // 변경 전: 중복 체크 로직이 없었음
        if (user.nickname === nickname.trim()) {
            return res.status(200).json({ 
                message: '닉네임이 변경되지 않았습니다.', 
                nickname: user.nickname 
            });
        }

        // 닉네임 업데이트
        // 변경 전: DB 업데이트 로직이 없었음
        const updatedUser = await prisma.users.update({
            where: { idx: userIdx },
            data: { 
                nickname: nickname.trim(),
                updated_at: new Date()
            },
            select: {
                idx: true,
                user_id: true,
                nickname: true,
                role: true
            }
        });

        // 변경 전: 성공 응답 로직이 없었음
        return res.status(200).json({ 
            message: '닉네임이 성공적으로 변경되었습니다.',
            user: {
                idx: updatedUser.idx,
                email: updatedUser.user_id,
                nickname: updatedUser.nickname,
                role: updatedUser.role
            }
        });

    } catch (error: any) {
        // 변경 전: 에러 처리 로직이 없었음
        console.error('닉네임 변경 오류:', error);
        res.status(500).json({ 
            message: '닉네임 변경에 실패했습니다.', 
            error: error?.message || error 
        });
    }
}
// ===== 변경 후 코드 끝 =====