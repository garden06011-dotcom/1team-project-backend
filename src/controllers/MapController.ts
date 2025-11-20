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
         orderBy: [{ city: 'asc' }, { district: 'asc' }, { subdistrict: 'asc' }]
        });

        const formatted: any = {};
        regions.forEach((region: any) => {
            if(!formatted[region.city]) formatted[region.city] = {};
            if(!formatted[region.city][region.district]) formatted[region.city][region.district] = [];
             formatted[region.city][region.district].push(region.neighborhood);
        });
           
        res.json(formatted);
    } catch (error:any) {
        console.log(error);
        res.status(500).json({ message: '창업 위치 데이터 가져오기 오류:', error })
    }
 }