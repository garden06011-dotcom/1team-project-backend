import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

// 사용자가 원하는 입지 요청값 저장
 export const custom_request = async (req: Request, res: Response) => {
    try {
        const {user_id, category, rent_range, region_city, region_district, region_subdistrict } = req.body;
        if(!user_id || !category || !rent_range || !region_city || !region_district || !region_subdistrict) {
            return res.status(400).json({ message: '모든 입력 필드를 채워주세요.' })
        }

        const request = await prisma.analysis_requests.create({
            data: {
                user_id: String(user_id),
                category: String(category),
                rent_range: String(rent_range),
                region_city: String(region_city),           
                region_district: String(region_district),   
                region_subdistrict: String(region_subdistrict), 
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
      const regions = await prisma.regions.findMany({
        where: { city: "서울", use_yn: 'Y' }, // 서울만 가져오기
        orderBy: [
          { city: 'asc' },
          { district: 'asc' },
          { subdistrict: 'asc' },
        ],
      });
      
      const formatted: any = {};
      regions.forEach((region: any) => {
        if (!formatted[region.city]) formatted[region.city] = {};
        if (!formatted[region.city][region.district]) {
          formatted[region.city][region.district] = [];
        }
        formatted[region.city][region.district].push(region.subdistrict);
      });
  
      res.json(formatted); // 예: { 서울: { 강남구: ["역삼동", ...], ... } }
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ message: "창업 위치 데이터 가져오기 오류", error });
    }
  };
  
 // 창업 위치 중심좌표 가져오기
export const getLocationCenter = async (req: Request, res: Response) => {
    try {
      console.log("@@@ getLocationCenter", req.body);
      const { city, district, subdistrict } = req.body;
  
      if (!city) {
        return res.status(400).json({ message: "city 값은 필수입니다." });
      }
  
      // 서울 이외 지역 좌표 매핑
      const fixedCenters: any = {
            "경기":  { lat: 37.263574, lng: 127.028601 },
            "인천":  { lat: 37.4562557, lng: 126.7052062 },
            "부산":  { lat: 35.172784561228, lng: 129.05284004337 },
            "대구":  { lat: 35.8706718037181, lng: 128.597094576837 },
            "광주":  { lat: 35.157878146258, lng: 126.865060134513 },
            "대전":  { lat: 36.3197490445653, lng: 127.431037175935 },
            "울산":  { lat: 35.5444169723478, lng: 129.331864527423 },
          
      };
      
  
      // 서울이면 기존 DB 조회
      if (city === "서울") {
        if (!district || !subdistrict) {
          return res.status(400).json({ message: "서울은 구/동 입력이 필요합니다." });
        }
  
        const location = await prisma.regions.findFirst({
          where: { district, subdistrict },
          select: { lat: true, lng: true },
        });
  
        return res.json(location);
      }
  
      // 서울 외 지역 처리
      if (fixedCenters[city]) {
        return res.json(fixedCenters[city]);
      }
  
      return res.status(400).json({ message: "지원되지 않는 지역입니다." });
  
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ message: "창업 위치 중심좌표 가져오기 오류", error });
    }
  };
  