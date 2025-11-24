import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

// 사용자가 원하는 입지 요청값 저장
 export const user_request_save = async (req: Request, res: Response) => {
    try {
        const {user_id, category, rent_range, region_city, region_district} = req.body;
        if(!user_id || !category || !rent_range || !region_city || !region_district) {
            return res.status(400).json({ message: '모든 입력 필드를 채워주세요.' })
        }

        const request = await prisma.analysis_requests.create({
            data: {
                user_id: String(user_id),
                category: String(category),
                rent_range: String(rent_range),
                region_city: String(region_city),           
                region_district: String(region_district),   
                created_at: new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
              }
          });
        console.log("@@@ request", request);
          
        return res.status(200).json({ message: '요청이 성공적으로 접수되었습니다.', request: request })
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '요청 접수 오류 에러:', error })
    
    }
 }

 // 창업 위치 데이터 가져오기
export const getLocationDate = async (req: Request, res: Response) => {
  try {
    console.log("@@@ getLocationDate", req.body);
    const regions = await prisma.regions.findMany({
      where: { use_yn: 'Y' },
      orderBy: [
        { city: 'asc' },
        { district: 'asc' },
      ],
    });

    const formatted: any = {};
    regions.forEach((region: any) => {
      if (!formatted[region.city]) formatted[region.city] = [];
      if (!formatted[region.city].includes(region.district)) {
        formatted[region.city].push(region.district);
      }
    });

    // 서울, 부산 상단 정렬
    const priorityRegions = ['서울', '부산'];
    const sorted = Object.keys(formatted).sort((a, b) => {
      const indexA = priorityRegions.indexOf(a);
      const indexB = priorityRegions.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    const reordered: any = {};
    sorted.forEach(city => {
      reordered[city] = formatted[city];
    });

    res.json(reordered);

  } catch (error: any) {
    console.log(error);
    res.status(500).json({ message: "창업 위치 데이터 가져오기 오류", error });
  }
};

  
// 창업 위치 중심좌표 가져오기
export const getLocationCenter = async (req: Request, res: Response) => {
  try {
    console.log("@@@ getLocationCenter", req.body);
    const { city, district } = req.body;

    // city 필수
    if (!city) {
      return res.status(400).json({ message: "city 값은 필수입니다." });
    }

    // district도 반드시 있어야 함
    if (!district) {
      return res.status(400).json({ message: "district(구) 값은 필수입니다." });
    }

    // DB에서 시/구 기준으로 조회 (동은 무시)
    const location = await prisma.regions.findFirst({
      where: {
        city,
        district,
        use_yn: "Y",
      },
      select: {
        lat: true,
        lng: true,
      },
    });

    if (!location) {
      return res.status(404).json({ message: "해당 지역의 위치 정보를 찾을 수 없습니다." });
    }

    return res.json(location);

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "창업 위치 중심좌표 가져오기 오류", error });
  }
};



  