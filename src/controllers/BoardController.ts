import { Request, Response } from 'express';
import { community_posts_category, PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

// 게시판 페이지 (검색 기능 포함) 1페이지당 5개씩 페이지네이션 적용 및 정렬 기능 적용
export const BoardPage = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 5, title='', content='', tags='', nickname='', sort = 'latest', category = 'all', user_id='' as string } = req.query;


        const titleCondition = title ? { contains: title as string } : {};
        const contentCondition = content ? { contains: content as string } : {};
        const tagsCondition = tags ? { contains: tags as string } : {};
        const nicknameCondition = nickname ? { contains: nickname as string } : {};
        const categoryCondition = category ? { equals: category as community_posts_category } : undefined;
        const user_idCondition = user_id ? { contains: user_id as string } : {};

        const boardList = await prisma.community_posts.findMany({
            skip: (parseInt(page as string) - 1) * parseInt(limit as string),
            take: parseInt(limit as string),
            where: {
                title: titleCondition, // 글 제목
                content: contentCondition, // 글 내용
                tags: tagsCondition, // 글 태그
                category: categoryCondition, // 글 카테고리
                views: { // 글 조회수
                    gte: 0,
                },
                user_id: { // 글 작성자
                    contains: user_id as string,
                },
                likes: { // 글 좋아요수
                    gte: 0,
                },
                comments_count: { // 글 댓글수
                    gte: 0,
                },
                users: {
                    nickname: nicknameCondition, // 글 작성자
                },
            },
            include: {
                users: true, // 글 작성자
            },
            orderBy: {
                created_at: sort === 'latest' ? 'desc' : 'asc', // 글 작성일
            }, // 글 작성일 정렬
        });
        const totalCount = await prisma.community_posts.count({
            where: {
                title: titleCondition,
                content: contentCondition,
                tags: tagsCondition,
                category: categoryCondition,
            },
        });
        const totalPages = Math.ceil(totalCount / parseInt(limit as string));
        const currentPage = parseInt(page as string);
        const hasPreviousPage = currentPage > 1;
        const hasNextPage = currentPage < totalPages;

        const pagination = {
            currentPage,
            totalPages,
            hasPreviousPage,
            hasNextPage,
        }

        res.status(200).json({ message: '게시글 조회 성공', data: boardList, pagination })
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 조회 실패:', error })
    }
}




// 게시글 저장하기
export const saveBoard = async (req: Request, res: Response) => {
    try {
        const { title, content, category, tags, user_id } = req.body;
        console.log('받은 데이터:', { title, content, category, tags, user_id });
        
        if(!title || !content) {
            return res.status(400).json({ message: '제목과 내용을 입력해주세요' })
        }

        if(!category) {
            return res.status(400).json({ message: '카테고리를 입력하세요' })
        }
        
        if(!user_id) {
            return res.status(400).json({ message: '로그인이 필요합니다.' })
        }

        // category enum이 비어있으므로 null로 처리
        // Prisma schema에서 category가 optional이므로 null 허용
        const board = await prisma.community_posts.create({
            data: {
                title: title,
                content: content,
                category: null, // enum이 비어있어서 null로 처리
                tags: tags || null,
                user_id: user_id,
                created_at: new Date(),
                updated_at: new Date(),
            }
        })
        console.log('게시글 저장 성공:', board);
        res.status(201).json({ message: '게시글 저장 성공', data: board })
    } catch (error:any) {
        console.log('게시글 저장 에러:', error);
        res.status(500).json({ message: '게시글 저장 실패:', error: error.message || error })
    }
}

// 게시글 상세 페이지
export const getBoardDetail = async (req: Request, res: Response) => {
    try {

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 상세 페이지 요청 실패:', error })
    }
}

// 게시글 수정
export const updateBoard = async (req: Request, res: Response) => {
    try {

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 수정 실패:', error })
    }
}

// 게시글 삭제
export const deleteBoard = async (req: Request, res: Response) => {
    try {

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 삭제 실패:', error })
    }
}

