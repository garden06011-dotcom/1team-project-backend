const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // 토큰 해싱을 위해 추가
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// 토큰 만료 시간 설정
const ACCESS_TOKEN_EXPIRES_IN = '5m'; // 15분
const REFRESH_TOKEN_EXPIRES_IN = '7d';
// const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

interface TokenPayload {
    id: number;
    type: 'guest' | 'member' | 'admin'
}

export interface JwtPayload {
    userId: string;
    email: string;
    role?: string;
}

// Access Token 생성
export const generateAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
};

// Refresh Token 생성
export const generateRefreshToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
};

// Access Toekn 검증
export const verifyAccessToken = (token: string): TokenPayload => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

        // 필요한 필드가 있는지 확인
        if(!decoded.id || !decoded.type) {
            throw new Error('Invalid token');
        }

        return {
            id: decoded.id as number,
            type: decoded.type as 'guest' | 'member' | 'admin',
        };
    } catch (error) {
        throw new Error('Invalid or expired accesstoken');
    }
}


// Refresh Token 검증
export const verifyRefreshToken = (token: string): TokenPayload => {
    try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;

        // 필요한 필드가 있는지 확인
        if(!decoded.id || !decoded.type) {
            throw new Error('Invalid token');
        }

        return {
            id: decoded.id as number,
            type: decoded.type as 'guest' | 'member' | 'admin',
        };
    } catch (error) {
        throw new Error('Invalid or expired refreshtoken');
    }
}


// token 쌍 생성 (Access + Refresh)
export const generateToeknPair = (payload: TokenPayload) => {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    
    return {
        accessToken,
        refreshToken,
        accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
        refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES_IN,
    };
}

/**
 * Refresh Token을 해시화하는 함수
 * 
 * 왜 해시화하는가?
 * - DB에 평문으로 저장하면 보안 위험
 * - DB가 탈취되어도 원본 토큰을 알 수 없음
 * - 검증 시 해시를 비교하여 일치 여부 확인
 * 
 * 기존: Refresh Token을 그대로 localStorage에 저장 (평문)
 * 변경: Refresh Token을 해시화해서 DB에 저장
 */
export const hashRefreshToken = (token: string): string => {
    // SHA-256 해시 사용 (bcrypt보다 빠르고 토큰 검증에 적합)
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Refresh Token 검증 (해시 비교)
 * 
 * 기존: JWT 서명만 검증
 * 변경: JWT 서명 검증 + DB에서 해시 비교
 */
export const verifyRefreshTokenHash = (token: string, hashedToken: string): boolean => {
    const tokenHash = hashRefreshToken(token);
    return tokenHash === hashedToken;
}