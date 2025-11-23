const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

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