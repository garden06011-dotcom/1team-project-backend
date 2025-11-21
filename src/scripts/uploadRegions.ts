import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import * as XLSX from "xlsx";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

async function getCoordsFromKakao(query: string) {
  try {
    const response = await axios.get(
      `https://dapi.kakao.com/v2/local/search/address.json`,
      { 
        params: { query },
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
      }
    );

    if (response.data.documents.length > 0) {
      const { y, x } = response.data.documents[0];
      return { lat: parseFloat(y), lng: parseFloat(x) };
    }
  } catch (error) {
    console.warn(`📌 카카오 API 호출 실패: ${query}`, error);
  }

  return { lat: null, lng: null };
}

async function uploadRegions() {
  try {
    console.log("🌍 지역 정보 업로드 시작...");

    const filePath = "src/res/data/행정동_행정구역추가.xlsx";
    const workbook = XLSX.readFile(filePath);
    const jsonData: any[] = XLSX.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]]
    );

    for (const row of jsonData) {
      const code = row["코드"]?.toString();
      const city = row["시도"] || "서울시";
      const district = row["구"] || "";
      const subdistrict = row["행정동"]?.trim();

      if (!subdistrict) continue;

      const fullAddress = `${city} ${district} ${subdistrict}`; 
      const coords = await getCoordsFromKakao(fullAddress);

      const exists = await prisma.regions.findFirst({
        where: { subdistrict },
      });

      if (exists) {
        await prisma.regions.update({
          where: { idx: exists.idx },
          data: {
            code,
            city,
            district,
            lat: coords.lat,
            lng: coords.lng,
            updated_at: new Date(),
          },
        });
        console.log(`🔁 UPDATE: ${fullAddress} → ${coords.lat}, ${coords.lng}`);
      } else {
        await prisma.regions.create({
          data: {
            code,
            city,
            district,
            subdistrict,
            lat: coords.lat,
            lng: coords.lng,
            created_at: new Date(),
            updated_at: new Date(),
          },
        });
        console.log(`✨ INSERT: ${fullAddress} → ${coords.lat}, ${coords.lng}`);
      }
    }

    console.log("위경도 업데이트 완료!");
  } catch (error) {
    console.error("업데이트 실패 😢:", error);
  } finally {
    await prisma.$disconnect();
  }
}

uploadRegions();
