import * as XLSX from "xlsx";
import * as path from "path";

// 파일 경로 설정
const filePath = path.join(__dirname, "../res/data/행정동_시간대_요일평균_최종본.xlsx");

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  
  // JSON으로 변환
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
  
  
  // 첫 번째 행의 컬럼명 확인
  if (jsonData.length > 0) {
    const firstRow = jsonData[0];
    const columns = Object.keys(firstRow);
    columns.forEach((col, index) => {
      console.log(`  ${index + 1}. ${col}`);
    });
    
    // 첫 3개 행의 샘플 데이터 출력
    jsonData.slice(0, 3).forEach((row, index) => {
      Object.keys(row).forEach((key) => {
        const value = row[key];
        // 값이 너무 길면 잘라서 표시
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`  ${key}: ${displayValue}`);
      });
    });
    
    // 행정동 컬럼 확인
    const dongColumns = columns.filter(col => col.includes('행정동') || col.includes('동'));
    if (dongColumns.length > 0) {
      console.log(`  발견된 행정동 관련 컬럼: ${dongColumns.join(', ')}`);
      const sampleDongs = jsonData.slice(0, 5).map(row => row[dongColumns[0]]).filter(Boolean);
      console.log(`  샘플 행정동 값: ${sampleDongs.join(', ')}`);
    } else {
      console.log("행정동 컬럼을 찾을 수 없습니다.");
    }
    
    // 시간대 관련 컬럼 확인
    console.log("시간대 관련 컬럼 확인:");
    const timeColumns = columns.filter(col => 
      col.match(/^\d{2}-\d{2}$/) || 
      col.includes('시간') || 
      col.includes('시') ||
      col.match(/^\d{2}:\d{2}/)
    );
    if (timeColumns.length > 0) {
      console.log(`  발견된 시간대 관련 컬럼 (최대 10개): ${timeColumns.slice(0, 10).join(', ')}`);
      if (timeColumns.length > 10) {
        console.log(`  ... 외 ${timeColumns.length - 10}개`);
      }
    } else {
      console.log("시간대 관련 컬럼을 찾을 수 없습니다.");
    }
    
    // 요일 관련 컬럼 확인
    console.log("요일 관련 컬럼 확인:");
    const dayColumns = columns.filter(col => 
      col.includes('월') || 
      col.includes('화') || 
      col.includes('수') || 
      col.includes('목') || 
      col.includes('금') || 
      col.includes('토') || 
      col.includes('일') ||
      col.includes('요일')
    );
    if (dayColumns.length > 0) {
      console.log(`  발견된 요일 관련 컬럼: ${dayColumns.join(', ')}`);
    } else {
      console.log("요일 관련 컬럼을 찾을 수 없습니다.");
    }
    
    // 숫자 데이터 컬럼 확인
    console.log("숫자 데이터 컬럼 확인:");
    const numericColumns = columns.filter(col => {
      if (col.includes('행정동') || col.includes('동')) return false;
      const sampleValue = jsonData[0][col];
      return typeof sampleValue === 'number' || (typeof sampleValue === 'string' && !isNaN(Number(sampleValue)));
    });
    console.log(`  숫자 데이터로 보이는 컬럼 수: ${numericColumns.length}개`);
    if (numericColumns.length > 0 && numericColumns.length <= 20) {
      console.log(`  컬럼 목록: ${numericColumns.join(', ')}`);
    }
    
  } else {
    console.log("데이터가 없습니다.");
  }
  
} catch (error: any) {
  console.error(error.stack);
}

