import { Request, Response } from 'express';
import { community_posts_category, PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();
const categoryMap: Record<string, community_posts_category> = {
    '정보공유': 'INFO_SHARE',
    '질문': 'QUESTION',
    '자유': 'FREE',
} as const;

const categoryReverseMap: Record<community_posts_category, string> = {
    'INFO_SHARE': '정보공유',
    'QUESTION': '질문',
    'FREE': '자유',
}


// 대시보드 관리자만 조회
export const getAdminDashboard = async (req: Request, res: Response) => {
    try {
        const dashboard = await prisma.users.findUnique({
            where: {
                user_id: 'admin@admin.com'
            }
        })
        return res.status(200).json({ message: '관리자 대시보드 조회 성공', dashboard: dashboard });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: '관리자 대시보드 조회 오류 에러:', error });
    }
}

// 관리자 회원 조회 (페이지네이션 추가 예정)
export const getAdminUsers = async (req: Request, res: Response) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            type = 'name', 
            keyword = '' 
        } = req.query;

        const pageNumber = Math.max(1, parseInt(page as string));
        const take = Math.max(1, parseInt(limit as string));
        const searchField = typeof type === 'string' ? type : 'name';
        const searchKeyword = typeof keyword === 'string' ? keyword.trim() : '';

        const whereClause: any = {
            role: { not: 'admin' },
        };

        // 검색 조건으로 활성화된 유저 조회
        if (searchKeyword) {
            if (searchField === 'email') {
                whereClause.user_id = { contains: searchKeyword };
            } else if (searchField === 'nickname') {
                whereClause.nickname = { contains: searchKeyword };
            } else {
                whereClause.name = { contains: searchKeyword };
            }
        }

        const [totalCount, users] = await Promise.all([
            prisma.users.count({ where: whereClause }),
            prisma.users.findMany({
                where: whereClause,
                select: {
                    idx: true,
                    name: true,
                    nickname: true,
                    user_id: true,
                    role: true,
                    use_yn: true,
                    created_at: true,
                },
                orderBy: {
                    created_at: 'desc',
                },
                skip: (pageNumber - 1) * take,
                take,
            }),
        ]);

        const totalPages = Math.max(1, Math.ceil(totalCount / take));
        const currentPage = Math.min(pageNumber, totalPages);

        const pagination = {
            currentPage,
            totalPages,
            hasPreviousPage: currentPage > 1,
            hasNextPage: currentPage < totalPages,
        };

        return res.status(200).json({ 
            message: '관리자 회원 조회 성공', 
            data: users, 
            pagination 
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: '관리자 회원 조회 오류', error: error });
    }
}

// 관리자 회원 삭제하기(삭제가 아닌 비활동 유저로 변환)
export const deleteAdminUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userIdx = parseInt(id);

        if (Number.isNaN(userIdx)) {
            return res.status(400).json({ message: '유효하지 않은 사용자 ID 입니다.' });
        }

        const targetUser = await prisma.users.findUnique({
            where: { idx: userIdx },
            select: { role: true, use_yn: true },
        });

        if (!targetUser) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        if (targetUser.role === 'admin') {
            return res.status(403).json({ message: '관리자 계정은 비활성화할 수 없습니다.' });
        }

        if (targetUser.use_yn === 'N') {
            return res.status(200).json({ message: '이미 비활성화된 사용자입니다.' });
        }

        const updatedUser = await prisma.users.update({
            where: { idx: userIdx },
            data: {
                use_yn: 'N',
                updated_at: new Date(),
            },
        });

        await prisma.refresh_tokens.updateMany({
            where: { user_id: userIdx, is_revoked: false },
            data: { is_revoked: true },
        });

        return res.status(200).json({ message: '사용자가 비활성화되었습니다.', user: updatedUser });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: '관리자 회원 삭제 오류', error: error });
    }
}


// 관리자 게시글 페이지(페이지네이션, 검색 기능 추가)
export const getAdminBoard = async (req: Request, res: Response) => {
    try {
        const { 
            page = 1, 
            limit = 5, 
            sort = 'latest', 
            category = 'all',
            keyword = '',
            type = 'title',
        } = req.query;

        const requestedPage = parseInt(page as string);
        const take = parseInt(limit as string);

        const searchKeyword = typeof keyword === 'string' ? keyword.trim() : '';
        const searchType = typeof type === 'string' ? type : 'title';

        const resolveCategoryEnum = (value: string): community_posts_category | undefined => {
            if (!value) return undefined;
            if (categoryMap[value]) {
                return categoryMap[value];
            }
            const upperValue = value.toUpperCase();
            if ((Object.keys(categoryReverseMap) as Array<community_posts_category>).includes(upperValue as community_posts_category)) {
                return upperValue as community_posts_category;
            }
            const fuzzy = (Object.entries(categoryReverseMap) as Array<[community_posts_category, string]>).find(([, label]) => label.includes(value));
            if (fuzzy) {
                return fuzzy[0];
            }
            return undefined;
        };

        let categoryCondition: { equals: community_posts_category } | undefined;

        if (category && category !== "all" && typeof category === 'string') {
            const normalizedCategory = resolveCategoryEnum(category);
            if (normalizedCategory) {
                categoryCondition = { equals: normalizedCategory };
            }
        }

        if (searchType === 'category' && searchKeyword) {
            const resolved = resolveCategoryEnum(searchKeyword);
            if (resolved) {
                categoryCondition = { equals: resolved };
            } else {
                return res.status(200).json({
                    message: '관리자 게시판 조회 성공',
                    data: [],
                    pagination: {
                        currentPage: 1,
                        totalPages: 1,
                        hasPreviousPage: false,
                        hasNextPage: false,
                    },
                });
            }
        }

        const whereClause: any = {};

        if (categoryCondition) {
            whereClause.category = categoryCondition;
        }

        if (searchType === 'title' && searchKeyword) {
            whereClause.title = { contains: searchKeyword };
        }

        if (searchType === 'nickname' && searchKeyword) {
            whereClause.users = { nickname: { contains: searchKeyword } };
        }

        const orderByClause = (() => {
            if (sort === 'name') {
                return { users: { name: 'asc' as const } };
            }
            if (sort === 'nickname') {
                return { users: { nickname: 'asc' as const } };
            }
            if (sort === 'email') {
                return { users: { user_id: 'asc' as const } };
            }
            return { users: { created_at: 'desc' as const } };
        })();
        console.log(orderByClause);

        const totalCount = await prisma.community_posts.count({
            where: whereClause,
        });

        const totalPages = Math.max(1, Math.ceil(totalCount / take));
        const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);

        const boardList = await prisma.community_posts.findMany({
            skip: (currentPage - 1) * take,
            take,
            where: whereClause,
            include: {
                users: true, // 글 작성자
            },
            orderBy: orderByClause,
        });
        const hasPreviousPage = currentPage > 1;
        const hasNextPage = currentPage < totalPages;

        const pagination = {
            currentPage,
            totalPages,
            hasPreviousPage,
            hasNextPage,
        }

        // prisma enum -> 한글로 변환해서 프론트로 보내기
        const mappedBoardList = boardList.map((post) => ({
            ...post,
            category: post.category ? categoryReverseMap[post.category] : null,
        }))

        return res.status(200).json({ message: '관리자 게시판 조회 성공', data: mappedBoardList, pagination });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: '관리자 게시판 조회 오류 에러:', error })
    }
}

// 관리자 게시글 삭제하기
export const deleteAdminBoard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if(!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' })
        }

        const post = await prisma.community_posts.findUnique({
            where: { idx: Number(id) },
        })
        
        if(!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
        }
        
        await prisma.community_posts.delete({
            where: { idx: Number(id) },
        })
        
        return res.status(200).json({ message: '게시글 삭제 성공' })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: '게시글 삭제 실패:', error })
    }
}