import { Request, Response } from 'express';
import { community_posts_category, PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

// 게시판 페이지 (검색 기능 포함) 1페이지당 5개씩 페이지네이션 적용 및 정렬 기능 적용
// 한글 카테고리 문자열을 Prisma enum 값으로 변환
const categoryMap: Record<string, community_posts_category> = {
    '정보공유': 'INFO_SHARE',
    '질문': 'QUESTION',
    '자유': 'FREE',
    // '정보공유': 'INFO_SHARE',
    // '질문': 'QUESTION',
    // '자유': 'FREE',
} as const;

// Prisma enum 값을 한글로 변환
const categoryReverseMap: Record<community_posts_category, string> = {
    'INFO_SHARE': '정보공유',
    'QUESTION': '질문',
    'FREE': '자유',
    // '정보공유': 'INFO_SHARE',
    // '질문': 'QUESTION',
    // '자유': 'FREE',
};

export const BoardPage = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 5, title='', content='', tags='', nickname='', sort = 'latest', category = 'all', user_id='' as string } = req.query;


        const titleCondition = title ? { contains: title as string } : {};
        const contentCondition = content ? { contains: content as string } : {};
        const tagsCondition = tags ? { contains: tags as string } : {};
        const nicknameCondition = nickname ? { contains: nickname as string } : {};
        const categoryCondition = // equals: category 를 쓰면 category = 'all' 인 데이터만 가져오게 돼서 실제로 아무것도 안나옴. 그래서 추가함
            category && category !== "all" && typeof category === 'string' && categoryMap[category]
                ? { equals: categoryMap[category] }
                : undefined
        const userIdCondition = user_id ? { contains: user_id as string } : {};

        const boardList = await prisma.community_posts.findMany({
            skip: (parseInt(page as string) - 1) * parseInt(limit as string),
            take: parseInt(limit as string),
            where: {
                title: titleCondition, // 글 제목
                content: contentCondition, // 글 내용
                tags: tagsCondition, // 글 태그
                category: categoryCondition, // 글 카테고리
                views: { gte: 0 }, // 글 조회수
                user_id: userIdCondition, // 글 작성자
                likes: {  gte: 0, }, // 글 좋아요수
                comments_count: {  gte: 0 }, // 글 댓글수
                users: { nickname: nicknameCondition }, // 글 작성자
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

        // prisma enum -> 한글로 변환해서 프론트로 보내기
        const mappedBoardList = boardList.map((post) => ({
            ...post,
            category: post.category ? categoryReverseMap[post.category] : null,
        }))

        res.status(200).json({ message: '게시글 조회 성공', data: mappedBoardList, pagination })
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

        // 한글 카테고리 문자열을 Prisma enum 값으로 변환
        const normalizedCategory = categoryMap[category] || null;

        const board = await prisma.community_posts.create({
            data: {
                title: title,
                content: content,
                category: normalizedCategory,
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
        const { id } = req.params;

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' });
        }

        const post = await prisma.community_posts.findUnique({
            where: {
                idx: Number(id),
            },
            include: {
                users: true,
                comments: {
                    include: {
                        users: true,
                    },
                    orderBy: {
                        created_at: 'desc',
                    },
                },
            },
        });

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        // 카테고리 한글로 바꿔서 보내기
        const mappedPost = {
            ...post,
            category: post.category ? categoryReverseMap[post.category] : null,
        }

        res.status(200).json({ message: '게시글 조회 성공', data: mappedPost });

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 상세 페이지 요청 실패:', error })
    }
}

// 좋아요 클릭시 좋아요 수 토글 (증가/감소)
export const likeBoard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'like' 또는 'unlike'

        // 유효성 검사
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' });
        }

        // 게시글 조회
        const post = await prisma.community_posts.findUnique({
            where: {
                idx: Number(id),
            }
        })

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        // 좋아요 수 토글 (action에 따라 증가 또는 감소)
        const increment = action === 'unlike' ? -1 : 1;
        const updatedPost = await prisma.community_posts.update({
            where: { idx: Number(id) },
            data: {
                // post.likes 에서 ?? 는 null 또는 undefined 일 때만 오른쪽 값을 대신 사용하라는 뜻
                // 즉 post.likes 값이 null 또는 undefined 일 때만 0을 사용 그 외의 값은 그 값을 사용해라
                likes: Math.max(0, (post.likes ?? 0) + increment), // 음수 방지
            }
        })

        res.status(200).json({ 
            message: action === 'unlike' ? '좋아요 취소 성공' : '좋아요 처리 성공', 
            data: updatedPost 
        })
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '좋아요 처리에 실패하였습니다', error: error.message || error })
    }
}


// 댓글 작성 후 댓글 수 증가 및 댓글 내용 초기화 및 댓글 작성 후 댓글 리스트에 추가
export const commentBoard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { content, user_id } = req.body;

        // 유효성 검사
        if(!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않는 게시글 ID 입니다.' })
        }

        if(!content) {
            return res.status(400).json({ message: '댓글 내용을 입력해주세요.' })
        }

        if(!user_id) {
            return res.status(400).json({ message: '로그인이 필요합니다.' })
        }

        const post = await prisma.community_posts.findUnique({
            where: {
                idx: Number(id),
            }
        })

        if(!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
        }

        const comment = await prisma.comments.create({
            data: {
                post_id: Number(id),
                user_id: user_id,
                content: content,
                created_at: new Date(),

            }
        })

        // 댓글 작성 후 댓글 수 증가
        await prisma.community_posts.update({
            where: { idx: Number(id) },
            data: {
                comments_count: (post.comments_count ?? 0) + 1,
            }
        })
        res.status(200).json({ message: '댓글 작성 성공', data: comment })
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '댓글 작성에 실패했습니다. 다시 시도해주세요.', error: error.message })
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

