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
            orderBy: 
                sort === 'views' 
                    ? { views: 'desc' } // 조회순: 조회수가 많은 순서대로
                    : sort === 'likes'
                    ? { likes: 'desc' } // 좋아요순: 좋아요가 많은 순서대로
                    : { created_at: 'desc' }, // 최신순: 최신 게시글이 먼저
        });
        // totalCount도 findMany와 동일한 where 조건을 사용해야 정확한 페이지네이션 가능
        const totalCount = await prisma.community_posts.count({
            where: {
                title: titleCondition,
                content: contentCondition,
                tags: tagsCondition,
                category: categoryCondition,
                user_id: userIdCondition,
                users: { nickname: nicknameCondition },
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
                views: 0,
                likes: 0,
                comments_count: 0,
                created_at: new Date(),
                updated_at: new Date(),
            }
        })

        // 게시글 작성자에게 알림 생성
        await prisma.notifications.create({
            data: {
                user_id: user_id,
                type: 'POST',
                message: `"${title}" 글이 등록되었습니다.`,
                is_read: false,
                created_at: new Date(),
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
        const { user_id } = req.query;
        const commentPageParam = parseInt(req.query.commentPage as string, 10);
        const commentLimitParam = parseInt(req.query.commentLimit as string, 10);

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' });
        }

        const post = await prisma.community_posts.findUnique({
            where: {
                idx: Number(id),
            },
        });

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        const commentPage = Number.isNaN(commentPageParam) || commentPageParam < 1 ? 1 : commentPageParam;
        const commentLimit = Number.isNaN(commentLimitParam) || commentLimitParam < 1 ? 5 : commentLimitParam;

        const totalCommentCount = await prisma.comments.count({
            where: {
                post_id: Number(id),
            },
        });
        const totalCommentPages = Math.max(1, Math.ceil(totalCommentCount / commentLimit));
        const safeCommentPage = Math.min(commentPage, totalCommentPages);
        const commentSkip = (safeCommentPage - 1) * commentLimit;

        let isLiked = false;
        if(user_id && typeof user_id === 'string') {
            const likeRecord = await prisma.post_likes.findUnique({
                where: {
                    // @@unique([post_id, user_id]) 이름이 uniq_post_user 라서 이렇게 사용
                    post_id_user_id: {
                        post_id: post.idx,
                        user_id: user_id
                    },
                },
            });
            isLiked = !!likeRecord;
        }

        // 조회수 증가 없이 게시글과 댓글 조회
        const [postData, comments] = await Promise.all([
            prisma.community_posts.findUnique({
                where: { idx: Number(id) },
                include: {
                    users: true,
                },
            }),
            prisma.comments.findMany({
                where: {
                    post_id: Number(id),
                },
                include: {
                    users: true,
                },
                orderBy: {
                    created_at: 'desc',
                },
                skip: commentSkip,
                take: commentLimit,
            })
        ]);
        
        if (!postData) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        // 카테고리 한글로 바꿔서 보내기
        const mappedPost = {
            ...postData,
            category: postData.category ? categoryReverseMap[postData.category] : null,
            isLiked,
            comments,
        };

        res.status(200).json({
            message: '게시글 조회 성공',
            data: mappedPost,
            commentPagination: {
                totalCount: totalCommentCount,
                totalPages: totalCommentPages,
                currentPage: safeCommentPage,
                pageSize: commentLimit,
                hasPrev: safeCommentPage > 1,
                hasNext: safeCommentPage < totalCommentPages,
            },
        });

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 상세 페이지 요청 실패:', error })
    }
}

// 특정 사용자의 게시글 목록 조회
export const getUserBoards = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const pageParam = parseInt(req.query.page as string, 10);
        const limitParam = parseInt(req.query.limit as string, 10);

        if (!userId) {
            return res.status(400).json({ message: '유효하지 않은 사용자 ID 입니다.' });
        }

        const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
        const limit = Number.isNaN(limitParam) || limitParam < 1 ? 5 : limitParam;
        const skip = (page - 1) * limit;

        const [totalCount, posts] = await Promise.all([
            prisma.community_posts.count({
                where: {
                    user_id: userId,
                },
            }),
            prisma.community_posts.findMany({
                where: {
                    user_id: userId,
                },
                include: {
                    users: true,
                },
                orderBy: {
                    created_at: 'desc',
                },
                skip,
                take: limit,
            }),
        ]);

        const mappedPosts = posts.map((post) => ({
            ...post,
            category: post.category ? categoryReverseMap[post.category] : null,
        }));

        const totalPages = Math.max(1, Math.ceil(totalCount / limit));

        res.status(200).json({
            message: '사용자 게시글 조회 성공',
            data: mappedPosts,
            pagination: {
                totalCount,
                totalPages,
                currentPage: Math.min(page, totalPages),
                pageSize: limit,
                hasPrev: page > 1,
                hasNext: page < totalPages,
            },
        });
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '사용자 게시글을 불러오지 못했습니다.', error })
    }
}

// 좋아요 클릭시 좋아요 수 토글 (증가/감소)
// export const likeBoard = async (req: Request, res: Response) => {
//     try {
//         const { id } = req.params;
//         const { action, user_id } = req.body; // 'like' 또는 'unlike'

//         // 유효성 검사
//         if (!id || isNaN(Number(id))) {
//             return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' });
//         }

//         // 게시글 조회
//         const post = await prisma.community_posts.findUnique({
//             where: {
//                 idx: Number(id),
//             }
//         })

//         if (!post) {
//             return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
//         }

//         // 좋아요 수 토글 (action에 따라 증가 또는 감소)
//         const increment = action === 'unlike' ? -1 : 1;
//         const updatedPost = await prisma.community_posts.update({
//             where: { idx: Number(id) },
//             data: {
//                 // post.likes 에서 ?? 는 null 또는 undefined 일 때만 오른쪽 값을 대신 사용하라는 뜻
//                 // 즉 post.likes 값이 null 또는 undefined 일 때만 0을 사용 그 외의 값은 그 값을 사용해라
//                 likes: Math.max(0, (post.likes ?? 0) + increment), // 음수 방지
//             }
//         })

//         res.status(200).json({ 
//             message: action === 'unlike' ? '좋아요 취소 성공' : '좋아요 처리 성공', 
//             data: updatedPost 
//         })
//     } catch (error:any) {
//         console.log(error);
//         res.status(500).json({ message: '좋아요 처리에 실패하였습니다', error: error.message || error })
//     }
// }

export const likeBoard = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { action, user_id } = req.body; // ✅ user_id 추가
  
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' });
      }
  
      if (!user_id) {
        return res.status(400).json({ message: '로그인이 필요합니다.' });
      }
  
      const postId = Number(id);
  
      // 트랜잭션으로 좋아요 기록 + 카운트 동기화
      const result = await prisma.$transaction(async (tx) => {
        // 이미 좋아요 눌렀는지 확인
        const existingLike = await tx.post_likes.findUnique({
          where: {
            post_id_user_id: {
              post_id: postId,
              user_id,
            },
          },
        });
  
        if (action === 'like') {
          if (existingLike) {
            // 이미 좋아요 눌렀으면 그냥 현재 상태만 반환 (증가 X)
            const post = await tx.community_posts.findUnique({
              where: { idx: postId },
            });
            return { post, isLiked: true, message: '이미 좋아요를 누르셨습니다.' };
          }
  
          // 새 좋아요 기록 생성 + likes +1
          await tx.post_likes.create({
            data: {
              post_id: postId,
              user_id,
              created_at: new Date(),
            },
          });
          console.log('좋아요 기록 생성', postId, user_id);
          const updatedPost = await tx.community_posts.update({
            where: { idx: postId },
            data: {
              likes: { increment: 1 },
            },
          });

          console.log('updatedPost', updatedPost);
          // 게시글 작성자에게 알림 생성 (좋아요 누른 사용자와 게시글 작성자가 다를 때만)
          if (updatedPost.user_id && updatedPost.user_id !== user_id) {
            console.log('전 알림 생성', updatedPost.user_id, updatedPost.title, user_id);
            // 좋아요 누른 사용자 정보 가져오기
            const likeUser = await tx.users.findUnique({
              where: { user_id: user_id },
              select: { nickname: true },
            });

            const likerName = likeUser?.nickname || '익명';
            const postTitle = updatedPost.title || '게시글';

            console.log('전전전 알림 생성', updatedPost.user_id, updatedPost.title, likerName);

            await tx.notifications.create({
              data: {
                user_id: updatedPost.user_id,
                type: 'LIKE',
                message: `작성하신 게시글 "${postTitle}"에 ${likerName}님이 좋아요를 눌렀습니다.`,
                is_read: false,
                created_at: new Date(),
              }
            });

            console.log('좋아요 생성 시 알림 생성', updatedPost.user_id, updatedPost.title, likerName);
          }

          return { post: updatedPost, isLiked: true, message: '좋아요 처리 성공' };
        }
  
        if (action === 'unlike') {
          if (!existingLike) {
            // 좋아요 기록이 없으면 그냥 현재 상태 반환
            const post = await tx.community_posts.findUnique({
              where: { idx: postId },
            });
            return { post, isLiked: false, message: '이미 좋아요가 취소된 상태입니다.' };
          }
  
          // 좋아요 기록 삭제 + likes -1 (0 밑으로는 내려가지 않게)
          await tx.post_likes.delete({
            where: {
              post_id_user_id: {
                post_id: postId,
                user_id,
              },
            },
          });
  
          const updatedPost = await tx.community_posts.update({
            where: { idx: postId },
            data: {
              likes: {
                // 음수 방지
                decrement: 1,
              },
            },
          });
  
          // 혹시 DB likes 가 음수 되는 케이스가 걱정되면 한 번 더 보정해도 됨
          const safePost =
            (updatedPost.likes ?? 0) < 0
              ? await tx.community_posts.update({
                  where: { idx: postId },
                  data: { likes: 0 },
                })
              : updatedPost;
  
          return { post: safePost, isLiked: false, message: '좋아요 취소 성공' };
        }
  
        throw new Error('올바르지 않은 action 값입니다.');
      });
  
      if (!result.post) {
        return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
      }
  
      res.status(200).json({
        message: result.message,
        data: {
          ...result.post,
          isLiked: result.isLiked,
        },
      });
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ message: '좋아요 처리에 실패하였습니다', error: error.message || error });
    }
  };



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

        // 게시글 작성자에게 알림 생성 (댓글 작성자와 게시글 작성자가 다를 때만)
        if (post.user_id && post.user_id !== user_id) {
            // 댓글 작성자 정보 가져오기
            const commentUser = await prisma.users.findUnique({
                where: { user_id: user_id },
                select: { nickname: true },
            });

            const commenterName = commentUser?.nickname || '익명';
            const postTitle = post.title || '게시글';

            await prisma.notifications.create({
                data: {
                    user_id: post.user_id,
                    type: 'COMMENT',
                    message: `작성하신 게시글 "${postTitle}"에 ${commenterName}님이 댓글을 남겼습니다.`,
                    is_read: false,
                    created_at: new Date(),
                }
            });
        }

        res.status(200).json({ message: '댓글 작성 성공', data: comment })
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '댓글 작성에 실패했습니다. 다시 시도해주세요.', error: error.message })
    }
}


// 댓글 삭제
export const deleteComment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { commentId } = req.params;
        if(!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않는 게시글 ID 입니다.' })
        }

        if(!commentId || isNaN(Number(commentId))) {
            return res.status(400).json({ message: '유효하지 않는 댓글 ID 입니다.' })
        }

        const comment = await prisma.comments.findUnique({
            where: {
                idx: Number(commentId),
            }
        })
        if(comment && comment.post_id !== Number(id)) {
            return res.status(403).json({ message: '댓글 삭제 권한이 없습니다.' })
        }
        if(!comment) {
            return res.status(404).json({ message: '댓글을 찾을 수 없습니다.' })
        }

        await prisma.comments.delete({
            where: {
                idx: Number(commentId),
            }
        })
        res.status(200).json({ message: '댓글 삭제 성공' })

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '댓글 삭제에 실패했습니다. 다시 시도해 주세요.', error: error.message })
    }
}


// 게시글 수정 불러오기
export const getBoardEdit = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 유효성 검사
        if(!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' })
        }
        // 게시글 조회
        const post = await prisma.community_posts.findUnique({
            where: {
                idx: Number(id),
            },
        });
        if(!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
        }
        // 카테고리 한글로 바꿔서 보내기
        const mappedPost = {
            ...post,
            category: post.category ? categoryReverseMap[post.category] : null,
        }
        res.status(200).json({ message: '게시글 수정 불러오기 성공', data: mappedPost })
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 수정 불러오기 실패:', error: error.message })
    }
}


// 게시글 수정
export const updateBoard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, content, tags, category, user_id } = req.body;
        // 유효성 검사
        if(!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않는 게시글 ID 입니다.' })
        }

        if(!title || !content) {
            return res.status(400).json({ message: '제목 및 내용을 입력해 주세요.' })
        }

        if(!category) {
            return res.status(400).json({ message: '카테고리를 선택해 주세요.' })
        }

        
        if(!user_id) {
            return res.status(400).json({ message: '로그인이 필요합니다.' })
        }

        const post = await prisma.community_posts.findUnique({
            where: { idx: Number(id) },
        })

        if(!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
        }
        
        if(post.user_id !== user_id) {
            return res.status(403).json({ message: '게시글 수정 권한이 없습니다.' })
        }

        const normalizedCategory = categoryMap[category] || null;

        const updatedPost = await prisma.community_posts.update({
            where: { idx: Number(id) },
            data: { title, content, category: normalizedCategory, tags: tags || null },
        })

        if(!updatedPost) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
        }

        res.status(200).json({ message: '게시글 수정 성공', data: updatedPost })

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 수정 실패:', error })
    }
}

// 조회수 증가 (별도 엔드포인트)
export const incrementViewCount = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' });
        }

        const post = await prisma.community_posts.findUnique({
            where: {
                idx: Number(id),
            },
        });

        if (!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' });
        }

        // 조회수 증가
        const updatedPost = await prisma.community_posts.update({
            where: { idx: Number(id) },
            data: {
                views: (post.views ?? 0) + 1,
            },
        });

        res.status(200).json({
            message: '조회수 증가 성공',
            data: { views: updatedPost.views },
        });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ message: '조회수 증가 실패:', error });
    }
};

// 게시글 삭제
export const deleteBoard = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // const { user_id } = req.body;
        if(!id || isNaN(Number(id))) {
            return res.status(400).json({ message: '유효하지 않은 게시글 ID 입니다.' })
        }

        // if(!user_id) {
        //     return res.status(400).json({ message: '로그인이 필요합니다.' })
        // }

        const post = await prisma.community_posts.findUnique({
            where: { idx: Number(id) }, // id는 params로 url에 있는 것을 뜻한다 저 부분은 Number(id)로 숫자형으로 변환하였으며
            // idx는 게시글 고유번호이며 그 부분과 id가 일치하는 게시글을 찾는다
            // 또한 게시글 작성자와 삭제 권한이 있는 사용자가 일치하는 게시글을 찾는다
            // 일반적인 mongodb에서 findOne과 동일한 기능 findUnique를 사용
        })
        if(!post) {
            return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
        }

        // if(post.user_id !== user_id) {
        //     return res.status(403).json({ message: '게시글 삭제 권한이 없습니다.' })
        // }
        
        await prisma.community_posts.delete({
            where: { idx: Number(id) },
        })
        res.status(200).json({ message: '게시글 삭제 성공' })

    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '게시글 삭제 실패:', error })
    }
}

