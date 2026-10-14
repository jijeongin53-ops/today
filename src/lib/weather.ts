// ============================================================================
// src/lib/weather.ts
// Open-Meteo API 연동, WMO 날씨 코드 한국어 변환, 테마/아이콘/우산/브리핑 유틸리티
// ============================================================================

export interface CityOption {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

// 대한민국 주요 도시 프리셋 목록
export const KOREA_CITIES: CityOption[] = [
  { id: "seoul", name: "서울", region: "서울특별시", latitude: 37.5665, longitude: 126.978 },
  { id: "busan", name: "부산", region: "부산광역시", latitude: 35.1796, longitude: 129.0756 },
  { id: "incheon", name: "인천", region: "인천광역시", latitude: 37.4563, longitude: 126.7052 },
  { id: "daegu", name: "대구", region: "대구광역시", latitude: 35.8714, longitude: 128.6014 },
  { id: "daejeon", name: "대전", region: "대전광역시", latitude: 36.3504, longitude: 127.3845 },
  { id: "gwangju", name: "광주", region: "광주광역시", latitude: 35.1595, longitude: 126.8526 },
  { id: "ulsan", name: "울산", region: "울산광역시", latitude: 35.5384, longitude: 129.3114 },
  { id: "suwon", name: "수원", region: "경기도 수원시", latitude: 37.2636, longitude: 127.0286 },
  { id: "sejong", name: "세종", region: "세종특별자치시", latitude: 36.4801, longitude: 127.289 },
  { id: "jeju", name: "제주", region: "제주특별자치도", latitude: 33.4996, longitude: 126.5312 },
];

export type WeatherIconType =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm";

export interface WmoWeatherInfo {
  code: number;
  label: string; // 한국어 날씨 설명 (예: "맑음", "흐림", "비", "눈")
  emoji: string; // 푸시 알림 및 배지용 이모지
  iconType: WeatherIconType; // Lucide 아이콘 매핑용 식별자
  needsUmbrella: boolean; // 우산 필요 여부
  bgGradient: string; // 9:16 컨테이너 배경 그라데이션 클래스
  ambientGlow: string; // 배경 글로우 포인트 컬러
  shortGreeting: string; // 푸시 알림 끝맺음 인사말
}

export interface WeatherData {
  city: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    precipitation: number;
    weatherCode: number;
    weatherInfo: WmoWeatherInfo;
  };
  daily: {
    weatherCode: number;
    weatherInfo: WmoWeatherInfo;
    tempMax: number;
    tempMin: number;
    precipitationProbabilityMax: number;
    uvIndexMax: number;
    uvLabel: string;
  };
  airQuality: {
    pm10: number;
    pm25: number;
    gradeLabel: string; // "좋음" | "보통" | "나쁨" | "매우 나쁨"
    gradeColor: string;
  };
  needsUmbrella: boolean;
  oneLineTip: string;
}

/**
 * WMO Weather interpretation codes (WW) 한국어 변환 및 테마 매핑 함수
 * https://open-meteo.com/en/docs
 */
export function parseWmoWeatherCode(code: number): WmoWeatherInfo {
  switch (code) {
    case 0:
      return {
        code,
        label: "맑음",
        emoji: "☀️",
        iconType: "sun",
        needsUmbrella: false,
        bgGradient: "from-sky-500 via-blue-600 to-indigo-800",
        ambientGlow: "bg-amber-300/30",
        shortGreeting: "쾌청하고 기분 좋은 하루 보내세요!",
      };
    case 1:
      return {
        code,
        label: "대체로 맑음",
        emoji: "🌤️",
        iconType: "cloud-sun",
        needsUmbrella: false,
        bgGradient: "from-sky-500 via-blue-600 to-slate-800",
        ambientGlow: "bg-amber-200/25",
        shortGreeting: "산뜻하고 맑은 하루 보내세요!",
      };
    case 2:
      return {
        code,
        label: "구름 조금",
        emoji: "⛅",
        iconType: "cloud-sun",
        needsUmbrella: false,
        bgGradient: "from-blue-600 via-indigo-700 to-slate-900",
        ambientGlow: "bg-sky-300/25",
        shortGreeting: "구름 사이로 햇살이 비치는 하루예요!",
      };
    case 3:
      return {
        code,
        label: "흐림",
        emoji: "☁️",
        iconType: "cloud",
        needsUmbrella: false,
        bgGradient: "from-slate-600 via-slate-700 to-zinc-900",
        ambientGlow: "bg-slate-400/20",
        shortGreeting: "차분한 하늘빛과 함께 활기찬 하루 되세요!",
      };
    case 45:
    case 48:
      return {
        code,
        label: "안개",
        emoji: "🌫️",
        iconType: "fog",
        needsUmbrella: false,
        bgGradient: "from-slate-600 via-gray-700 to-slate-900",
        ambientGlow: "bg-teal-300/20",
        shortGreeting: "안개가 짙으니 출근길 안전운전하세요!",
      };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return {
        code,
        label: "이슬비",
        emoji: "🌦️",
        iconType: "drizzle",
        needsUmbrella: true,
        bgGradient: "from-slate-700 via-blue-900 to-slate-950",
        ambientGlow: "bg-cyan-400/25",
        shortGreeting: "가벼운 우산 하나 꼭 챙겨 나오세요!",
      };
    case 61:
    case 63:
    case 66:
    case 80:
    case 81:
      return {
        code,
        label: "비",
        emoji: "🌧️",
        iconType: "rain",
        needsUmbrella: true,
        bgGradient: "from-blue-900 via-slate-800 to-gray-950",
        ambientGlow: "bg-blue-400/25",
        shortGreeting: "외출 시 우산을 반드시 챙기세요!",
      };
    case 65:
    case 67:
    case 82:
      return {
        code,
        label: "강한 비",
        emoji: "🌧️",
        iconType: "rain",
        needsUmbrella: true,
        bgGradient: "from-indigo-950 via-slate-900 to-black",
        ambientGlow: "bg-indigo-400/25",
        shortGreeting: "비가 많이 오니 튼튼한 장우산을 챙기세요!",
      };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        code,
        label: "눈",
        emoji: "❄️",
        iconType: "snow",
        needsUmbrella: true,
        bgGradient: "from-indigo-800 via-slate-800 to-slate-950",
        ambientGlow: "bg-sky-200/30",
        shortGreeting: "빙판길 조심하시고 따뜻하게 입으세요!",
      };
    case 95:
    case 96:
    case 99:
      return {
        code,
        label: "뇌우",
        emoji: "⛈️",
        iconType: "thunderstorm",
        needsUmbrella: true,
        bgGradient: "from-purple-950 via-slate-900 to-neutral-950",
        ambientGlow: "bg-purple-500/25",
        shortGreeting: "천둥번개를 동반한 비가 예상되니 우산을 꼭 챙기세요!",
      };
    default:
      return {
        code,
        label: "맑음",
        emoji: "🌤️",
        iconType: "cloud-sun",
        needsUmbrella: false,
        bgGradient: "from-sky-500 via-blue-700 to-indigo-950",
        ambientGlow: "bg-sky-300/25",
        shortGreeting: "오늘도 기분 좋은 하루 보내세요!",
      };
  }
}

/**
 * 자외선 지수(UV Index) 등급 텍스트 변환
 */
export function getUvGradeLabel(uvIndex: number): string {
  if (uvIndex >= 8) return "매우 높음";
  if (uvIndex >= 6) return "높음";
  if (uvIndex >= 3) return "보통";
  return "낮음";
}

/**
 * 미세먼지(PM10/PM2.5) 기준 한국형 대기질 등급 판별
 */
export function evaluateAirQuality(pm10: number, pm25: number): {
  gradeLabel: string;
  gradeColor: string;
} {
  if (pm10 > 150 || pm25 > 75) {
    return { gradeLabel: "매우 나쁨", gradeColor: "text-rose-300" };
  }
  if (pm10 > 80 || pm25 > 35) {
    return { gradeLabel: "나쁨", gradeColor: "text-amber-300" };
  }
  if (pm10 > 30 || pm25 > 15) {
    return { gradeLabel: "보통", gradeColor: "text-emerald-200" };
  }
  return { gradeLabel: "좋음", gradeColor: "text-sky-200" };
}

/**
 * 날씨, 강수확률, 기온차, 미세먼지 상태를 종합하여 한줄 브리핑 팁 생성
 */
export function buildOneLineTip(params: {
  needsUmbrella: boolean;
  precipProb: number;
  tempMax: number;
  tempMin: number;
  airGrade: string;
  uvIndex: number;
}): string {
  const { needsUmbrella, precipProb, tempMax, tempMin, airGrade, uvIndex } = params;
  const tips: string[] = [];

  if (needsUmbrella || precipProb >= 50) {
    tips.push(`☔ 강수확률 ${precipProb}%! 가방에 우산을 꼭 챙기세요`);
  } else if (precipProb >= 30) {
    tips.push(`🌂 오후에 비 소식 가능성(${precipProb}%)이 있어 작은 접이식 우산을 추천해요`);
  } else {
    tips.push(`✨ 우산 없이 가볍게 외출하기 좋은 날씨예요`);
  }

  if (airGrade === "나쁨" || airGrade === "매우 나쁨") {
    tips.push(`😷 미세먼지 '${airGrade}' 수준으로 KF94 마스크 착용을 권장해요`);
  } else if (tempMax - tempMin >= 10) {
    tips.push(`🧥 일교차가 ${Math.round(tempMax - tempMin)}°C로 크니 얇은 겉옷을 챙기세요`);
  } else if (uvIndex >= 6) {
    tips.push(`🕶️ 자외선 지수가 높으니 선크림을 꼭 바르세요`);
  } else {
    tips.push(`🌿 대기질 '${airGrade}'으로 상쾌한 바깥 공기를 마시기 좋아요`);
  }

  return tips.join(" · ");
}

/**
 * Open-Meteo API를 호출하여 현재 날씨, 일간 최고/최저/강수확률, 대기질을 가져옵니다.
 */
export async function fetchWeatherData(
  latitude: number,
  longitude: number,
  cityName = "서울"
): Promise<WeatherData> {
  // 필수 요구사항 파라미터 포함
  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(latitude));
  forecastUrl.searchParams.set("longitude", String(longitude));
  forecastUrl.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code"
  );
  forecastUrl.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max"
  );
  forecastUrl.searchParams.set("timezone", "Asia/Seoul");

  // 미세먼지(PM10, PM2.5) 조회를 위한 Open-Meteo Air Quality API (무료/무인증)
  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.searchParams.set("latitude", String(latitude));
  airUrl.searchParams.set("longitude", String(longitude));
  airUrl.searchParams.set("current", "pm10,pm2_5");
  airUrl.searchParams.set("timezone", "Asia/Seoul");

  const [forecastRes, airRes] = await Promise.all([
    fetch(forecastUrl.toString(), { cache: "no-store" }),
    fetch(airUrl.toString(), { cache: "no-store" }).catch(() => null),
  ]);

  if (!forecastRes.ok) {
    throw new Error(`Open-Meteo API 호출 실패 (HTTP ${forecastRes.status})`);
  }

  const forecastJson = await forecastRes.json();

  let pm10 = 24;
  let pm25 = 12;
  if (airRes && airRes.ok) {
    try {
      const airJson = await airRes.json();
      if (typeof airJson?.current?.pm10 === "number") {
        pm10 = Math.round(airJson.current.pm10);
      }
      if (typeof airJson?.current?.pm2_5 === "number") {
        pm25 = Math.round(airJson.current.pm2_5);
      }
    } catch {
      // 대기질 API 파싱 실패 시 기본 양호 값 유지
    }
  }

  const currentCode = Number(forecastJson?.current?.weather_code ?? 0);
  const dailyCode = Number(forecastJson?.daily?.weather_code?.[0] ?? currentCode);

  const currentInfo = parseWmoWeatherCode(currentCode);
  const dailyInfo = parseWmoWeatherCode(dailyCode);

  const tempCurrent = Math.round(Number(forecastJson?.current?.temperature_2m ?? 18));
  const apparentTemp = Math.round(Number(forecastJson?.current?.apparent_temperature ?? tempCurrent));
  const humidity = Math.round(Number(forecastJson?.current?.relative_humidity_2m ?? 55));
  const precipitation = Number(forecastJson?.current?.precipitation ?? 0);

  const tempMax = Math.round(Number(forecastJson?.daily?.temperature_2m_max?.[0] ?? tempCurrent + 4));
  const tempMin = Math.round(Number(forecastJson?.daily?.temperature_2m_min?.[0] ?? tempCurrent - 4));
  const precipProbMax = Math.round(
    Number(forecastJson?.daily?.precipitation_probability_max?.[0] ?? 10)
  );
  const uvIndexMax = Number(
    Number(forecastJson?.daily?.uv_index_max?.[0] ?? 4.5).toFixed(1)
  );

  const needsUmbrella =
    currentInfo.needsUmbrella ||
    dailyInfo.needsUmbrella ||
    precipProbMax >= 50 ||
    precipitation > 0;

  const airQualityEval = evaluateAirQuality(pm10, pm25);

  const oneLineTip = buildOneLineTip({
    needsUmbrella,
    precipProb: precipProbMax,
    tempMax,
    tempMin,
    airGrade: airQualityEval.gradeLabel,
    uvIndex: uvIndexMax,
  });

  return {
    city: cityName,
    latitude,
    longitude,
    updatedAt: new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul",
    }),
    current: {
      temperature: tempCurrent,
      apparentTemperature: apparentTemp,
      humidity,
      precipitation,
      weatherCode: currentCode,
      weatherInfo: currentInfo,
    },
    daily: {
      weatherCode: dailyCode,
      weatherInfo: dailyInfo,
      tempMax,
      tempMin,
      precipitationProbabilityMax: precipProbMax,
      uvIndexMax,
      uvLabel: getUvGradeLabel(uvIndexMax),
    },
    airQuality: {
      pm10,
      pm25,
      gradeLabel: airQualityEval.gradeLabel,
      gradeColor: airQualityEval.gradeColor,
    },
    needsUmbrella,
    oneLineTip,
  };
}

/**
 * 매일 아침 8시(KST) 크론 및 테스트 발송용 푸시 메시지 포맷터
 * 예: "☀️ 오늘 서울 최고 22°C / 최저 12°C, 강수확률 10%. 쾌청한 하루 보내세요!"
 */
export function formatMorningPushMessage(weather: WeatherData): {
  title: string;
  body: string;
} {
  const { city, daily, current, needsUmbrella } = weather;
  const emoji = daily.weatherInfo.emoji || current.weatherInfo.emoji;
  const umbrellaNotice = needsUmbrella
    ? "☔ 우산을 꼭 챙기세요!"
    : daily.weatherInfo.shortGreeting;

  const title = `${emoji} 오늘 ${city} 아침 날씨 브리핑 (${daily.weatherInfo.label})`;
  const body = `${emoji} 오늘 ${city} 최고 ${daily.tempMax}°C / 최저 ${daily.tempMin}°C, 강수확률 ${daily.precipitationProbabilityMax}%. ${umbrellaNotice}`;

  return { title, body };
}
