import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// 파일 경로 설정 (상대 경로로 수정)
const filePath = path.join(__dirname, "../res/data/행정동_시간대_요일평균_최종본.xlsx");
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

  // 시간대별 데이터 (예: "00-01", "01-02", ... "23-24")
  const timeSlots: string[] = [];
  const timeData: Record<string, number> = {};
  
  // 요일별 데이터 (월, 화, 수, 목, 금, 토, 일)
  const dayData: Record<string, number> = {};
  
  // Excel 파일의 컬럼명을 확인하여 시간대와 요일 데이터 추출
  // 먼저 첫 번째 행의 컬럼명을 확인하고 디버깅 정보 출력
  if (dong_data.length > 0) {
    const firstRow = dong_data[0];
    const columns = Object.keys(firstRow);
    
    // 디버깅: 첫 번째 행정동의 컬럼명 출력
    if (dong === dong_list[0]) {
      console.log(`첫 번째 행정동(${dong})의 컬럼 목록:`);
      columns.forEach((col, idx) => {
        const value = firstRow[col];
        const displayValue = typeof value === 'string' && value.length > 30 
          ? value.substring(0, 30) + '...' 
          : value;
        console.log(`  ${idx + 1}. "${col}": ${displayValue}`);
      });
    }
    
    // 시간대 컬럼 찾기 (다양한 패턴 지원)
    columns.forEach((key) => {
      // 패턴 1: "시간대_0시", "시간대_1시" 형식
      const timeMatch1 = key.match(/^시간대_(\d+)시$/);
      if (timeMatch1) {
        const hour = parseInt(timeMatch1[1]);
        const hourStr = String(hour).padStart(2, '0');
        const nextHour = String((hour + 1) % 24).padStart(2, '0');
        const timeSlot = `${hourStr}-${nextHour}`;
        if (!timeSlots.includes(timeSlot)) {
          timeSlots.push(timeSlot);
        }
      }
      
      // 패턴 2: "00-01", "01-02" 형식
      const timeMatch2 = key.match(/^(\d{2})-(\d{2})$/);
      if (timeMatch2) {
        const timeSlot = key;
        if (!timeSlots.includes(timeSlot)) {
          timeSlots.push(timeSlot);
        }
      }
      
      // 패턴 3: "00시", "01시" 형식
      const timeMatch3 = key.match(/^(\d{2})시$/);
      if (timeMatch3) {
        const hour = timeMatch3[1];
        const nextHour = String(parseInt(hour) + 1).padStart(2, '0');
        const timeSlot = `${hour}-${nextHour}`;
        if (!timeSlots.includes(timeSlot)) {
          timeSlots.push(timeSlot);
        }
      }
    });
    
    // 요일 컬럼 찾기
    columns.forEach((key) => {
      // 패턴 1: "요일_월", "요일_화" 형식
      const dayMatch1 = key.match(/^요일_(월|화|수|목|금|토|일)$/);
      if (dayMatch1) {
        const day = dayMatch1[1];
        if (!dayData[day]) {
          dayData[day] = 0;
        }
      }
      
      // 패턴 2: 기타 요일 패턴
      const dayPatterns = ['월', '화', '수', '목', '금', '토', '일'];
      dayPatterns.forEach((day) => {
        // 정확히 일치하거나, 요일이 포함된 경우
        if (key === day || key === `${day}요일` || key === `${day}평균` || 
            key.includes(`${day}요일`) || key.includes(`${day}평균`)) {
          if (!dayData[day]) {
            dayData[day] = 0;
          }
        }
      });
    });
  }
  
  // 실제 데이터 집계
  dong_data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      // 시간대 데이터 집계 - 패턴 1: "시간대_0시", "시간대_1시" 형식
      const timeMatch1 = key.match(/^시간대_(\d+)시$/);
      if (timeMatch1) {
        const hour = parseInt(timeMatch1[1]);
        const hourStr = String(hour).padStart(2, '0');
        const nextHour = String((hour + 1) % 24).padStart(2, '0');
        const timeSlot = `${hourStr}-${nextHour}`;
        if (!timeData[timeSlot]) {
          timeData[timeSlot] = 0;
        }
        timeData[timeSlot] += Number(row[key]) || 0;
      }
      
      // 시간대 데이터 집계 - 패턴 2: "00-01" 형식
      const timeMatch2 = key.match(/^(\d{2})-(\d{2})$/);
      if (timeMatch2) {
        const timeSlot = key;
        if (!timeData[timeSlot]) {
          timeData[timeSlot] = 0;
        }
        timeData[timeSlot] += Number(row[key]) || 0;
      }
      
      // 시간대 데이터 집계 - 패턴 3: "00시" 형식
      const timeMatch3 = key.match(/^(\d{2})시$/);
      if (timeMatch3) {
        const hour = timeMatch3[1];
        const nextHour = String(parseInt(hour) + 1).padStart(2, '0');
        const timeSlot = `${hour}-${nextHour}`;
        if (!timeData[timeSlot]) {
          timeData[timeSlot] = 0;
        }
        timeData[timeSlot] += Number(row[key]) || 0;
      }
      
      // 요일 데이터 집계 - 패턴 1: "요일_월", "요일_화" 형식
      const dayMatch1 = key.match(/^요일_(월|화|수|목|금|토|일)$/);
      if (dayMatch1) {
        const day = dayMatch1[1];
        if (!dayData[day]) {
          dayData[day] = 0;
        }
        dayData[day] += Number(row[key]) || 0;
      }
      
      // 요일 데이터 집계 - 패턴 2: 기타 요일 패턴
      const dayPatterns = ['월', '화', '수', '목', '금', '토', '일'];
      dayPatterns.forEach((day) => {
        if (key === day || key === `${day}요일` || key === `${day}평균` || 
            key.includes(`${day}요일`) || key.includes(`${day}평균`)) {
          if (!dayData[day]) {
            dayData[day] = 0;
          }
          dayData[day] += Number(row[key]) || 0;
        }
      });
    });
  });


  // 시간대별 데이터 정렬 (00-01부터 23-24까지)
  const sortedTimeData = timeSlots
    .sort((a, b) => {
      const hourA = parseInt(a.split('-')[0]);
      const hourB = parseInt(b.split('-')[0]);
      return hourA - hourB;
    })
    .map((timeSlot) => ({
      시간대: timeSlot,
      유동인구: Math.round(timeData[timeSlot] || 0),
    }));

  // 요일별 데이터 정렬 (월~일 순서)
  const dayOrder = ['월', '화', '수', '목', '금', '토', '일'];
  const sortedDayData = dayOrder
    .filter((day) => dayData[day] !== undefined)
    .map((day) => ({
      요일: day,
      유동인구: Math.round(dayData[day] || 0),
    }));

  data_by_dong[dong] = {
    time: sortedTimeData,
    day: sortedDayData,
  };
}

// JSON 파일로 저장
const output_data = {
  dong_list: dong_list,
  data: data_by_dong,
};

const outputPath = path.join(__dirname, "../res/data/time_day_data.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output_data, null, 2), "utf-8");


// 샘플 출력
const sample_dong = dong_list[0];
console.log(
  JSON.stringify(data_by_dong[sample_dong], null, 2).substring(0, 500)
);

