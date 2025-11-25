require('dotenv').config();

const bcrypt = require('bcrypt');
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

const createAdminUser = async () => {

    const email = 'admin@admin.com';
    const password = 'admin1234!';
    const name = '관리자';
    const nickname = '관리자';
    const rrn = '990101';
    const sex = 'M';
    try {
        await prisma.users.create({
        data: {
            user_id: email,
            password: await bcrypt.hash(password, 10),
            name: name,
            nickname: nickname,
            role: 'admin',
            rrn: rrn,
            sex: sex,
            created_at: new Date(),
            updated_at: new Date(),
            use_yn: 'Y'
        }
        });
        console.log('관리자 유저 생성 완료');
    } catch (error) {
        console.error('이미 관리자 유저가 존재합니다.', error);
        process.exit(1);
    }
}

(async () => {
    try {
        console.log('관리자 유저 생성 시작');
        await createAdminUser();
        console.log('관리자 유저 생성 완료');
    } catch (error) {
        console.error('관리자 유저 생성 실패', error);
        process.exit(1);
    }
})();