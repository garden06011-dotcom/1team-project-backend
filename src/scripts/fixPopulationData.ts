import * as fs from "fs";
import * as path from "path";

// 동 이름 정규화 함수 (제1동 -> 1동, 제2동 -> 2동)
const normalizeDongName = (dong: string): string => {
  return dong.replace(/제(\d+동)/g, '$1');
};

const filePath = path.join(__dirname, "../res/data/population_data.json");
const populationData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

// dong_list 정규화
const normalizedDongList = populationData.dong_list.map((dong: string) => normalizeDongName(dong));

// data 객체의 키 정규화
const normalizedData: Record<string, any> = {};
Object.keys(populationData.data).forEach((key) => {
  const normalizedKey = normalizeDongName(key);
  normalizedData[normalizedKey] = populationData.data[key];
});

// 정규화된 데이터로 업데이트
const outputData = {
  dong_list: normalizedDongList.sort(),
  data: normalizedData,
};

// 파일 저장
fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2), "utf-8");


