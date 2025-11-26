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

// 창업 위치 행정동 선택 
import fs from "fs";
import path from "path";

let emdData: any = null;

// 서버 시작 시 파일 한 번만 메모리에 로드
(function loadEmdData() {
  const filePath = path.join(__dirname, "../res/data/seoulDong_polygon.json");
  emdData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log("EMD 폴리곤 데이터 메모리 적재 완료:", emdData.features.length, "개");
})();

export const getDongPolygon = async (req: Request, res: Response) => {
  try {
    console.log("@@@ getDongPolygon", req.body);
    const { district, dong } = req.body; // 예: "은평구", "불광동"

    if (!district || !dong) {
      return res.status(400).json({ message: "district와 dong은 필수입니다." });
    }

    const normalizedDistrict = district.replace("구", "").trim(); // "종로"
    const normalizedDong = dong.replace("동", "").trim();         // "사직"
    
    const target = emdData.features.find((f: any) => {
      const fullName = f.properties.adm_nm || "";
      const noCity = fullName
        .replace("서울특별시", "")
        .replace("광역시", "")
        .replace("특별시", "")
        .trim(); // "종로구 사직동"
    
      return noCity.includes(normalizedDistrict) && noCity.includes(normalizedDong);
    });


    if (!target) {
      return res
        .status(404)
        .json({ message: `${district} ${dong} 폴리곤 데이터 없음` });
    }

    return res.status(200).json({
      type: target.geometry.type,
      coordinates: target.geometry.coordinates,
      properties: target.properties,
    });
  } catch (error) {
    console.error("폴리곤 조회 오류:", error);
    res.status(500).json({ message: "서버 오류", error });
  }
};

// 창업 위치 중심좌표 가져오기 > 시설 모달에서 사용 예정
export const getLocationCenter = async (req: Request, res: Response) => {
  try {
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

// 구 단위 모든 행정동 폴리곤 반환
export const getDistrictPolygons = async (req: Request, res: Response) => {
  try {
    console.log("@@@ getDistrictPolygons", req.body);
    const { city, district } = req.body;

    if (!city || !district) {
      return res.status(400).json({ message: "city 와 district는 필수입니다." });
    }

    if (!emdData || !emdData.features) {
      return res.status(500).json({ message: "폴리곤 데이터가 로드되지 않았습니다." });
    }

    // adm_nm 사용
    const matchedDongs = emdData.features.filter(
      (f: any) => f.properties.adm_nm.includes(district)
    );
    if (!matchedDongs.length) {
      return res.status(404).json({ message: `${district} 내 행정동 데이터 없음` });
    }

    const formatted = matchedDongs.map((data: any) => ({
      dong: data.properties.adm_nm.replace(/^.*\s/, ''), // 마지막 단어만 ("사직동")
      fullName: data.properties.adm_nm,
      coordinates: data.geometry.coordinates,
    }));
    return res.status(200).json({ district, dongs: formatted });
  } catch (error: any) {
    console.error("구 단위 폴리곤 조회 오류:", error.message);
    return res.status(500).json({ message: "서버 오류", error: error.message });
  }
};

// 유동인구 데이터 가져오기
let populationData: any = null;

// 서버 시작 시 파일 한 번만 메모리에 로드
(function loadPopulationData() {
  try {
    const filePath = path.join(__dirname, "../res/data/population_data.json");
    populationData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log("유동인구 데이터 메모리 적재 완료");
  } catch (error) {
    console.error("유동인구 데이터 로드 실패:", error);
  }
})();

export const getPopulationData = async (req: Request, res: Response) => {
  try {
    const { dongName } = req.body;
    console.log("@@@ getPopulationData dongName", dongName);
    console.log("@@@ getPopulationData", req.body);
    if (!dongName) {
      return res.status(400).json({ message: "dongName은 필수입니다." });
    }

    if (!populationData || !populationData.data) {
      return res.status(500).json({ message: "유동인구 데이터가 로드되지 않았습니다." });
    }

    // 동 이름 정규화 (동이 없으면 추가)
    const normalizedDong = dongName.endsWith('동') ? dongName.trim() : `${dongName.trim()}동`;
    console.log("@@@ normalizedDong", normalizedDong);
    const dongData = populationData.data[normalizedDong];
    console.log("@@@ dongData", dongData);
    if (!dongData) {
      return res.status(404).json({ 
        message: `${normalizedDong} 유동인구 데이터를 찾을 수 없습니다.`,
        availableDongs: Object.keys(populationData.data).slice(0, 10) 
      });
    }

    return res.status(200).json(dongData);
  } catch (error: any) {
    console.error("유동인구 데이터 조회 오류:", error);
    return res.status(500).json({ message: "서버 오류", error: error.message });
  }
};


  