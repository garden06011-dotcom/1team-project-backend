import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const filePath = "/mnt/user-data/uploads/24년_행정동_성별_연령대_통합.xlsx";
const workbook = XLSX.readFile(filePath);
const jsonData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

// 동 이름 정규화 함수 (제1동 -> 1동, 제2동 -> 2동)
const normalizeDongName = (dong: string): string => {
  return dong.replace(/제(\d+동)/g, '$1');
};

// 동 목록
const dongSet = new Set<string>();
jsonData.forEach((row) => {
  if (row["행정동"]) {
    const normalized = normalizeDongName(row["행정동"]);
    dongSet.add(normalized);
  }
});
const dong_list = Array.from(dongSet).sort();

// 데이터 구조 변환
const data_by_dong: Record<string, any> = {};

for (const dong of dong_list) {
  // 원본 데이터에서 찾기 위해 정규화된 이름과 원본 이름 모두 확인
  const dong_data = jsonData.filter((row) => {
    const originalDong = row["행정동"];
    const normalizedOriginal = normalizeDongName(originalDong || "");
    return normalizedOriginal === dong;
  });

  // 성별 데이터
  const genderMap = new Map<string, any>();
  dong_data.forEach((row) => {
    const gender = row["성별"];
    if (gender && !genderMap.has(gender)) {
      genderMap.set(gender, {
        성별: gender,
        성별총합: row["성별총합"],
        "성별비율(%)": row["성별비율(%)"],
      });
    }
  });

  // 연령대별 데이터
  const age_data = dong_data
    .map((row) => ({
      연령대: row["연령대"],
      합계: row["합계"],
      연령대_정렬: parseInt((row["연령대"]?.toString().match(/\d+/) || ["0"])[0]),
    }))
    .sort((a, b) => a.연령대_정렬 - b.연령대_정렬);

  data_by_dong[dong] = {
    gender: Array.from(genderMap.values()),
    age: age_data.map((item) => ({
      연령대: item.연령대,
      합계: item.합계,
    })),
  };
}

// JSON 파일로 저장
const output_data = {
  dong_list: dong_list,
  data: data_by_dong,
};

const outputPath = "/mnt/user-data/outputs/population_data.json";
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output_data, null, 2), "utf-8");

console.log(
  `📦 파일 크기: ${(JSON.stringify(output_data).length / 1024).toFixed(1)} KB`
);

// 샘플 출력
const sample_dong = dong_list[0];
console.log(
  JSON.stringify(data_by_dong[sample_dong], null, 2).substring(0, 500)
);