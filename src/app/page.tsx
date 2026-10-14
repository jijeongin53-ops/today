"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
  MapPin,
  LocateFixed,
  Droplets,
  Umbrella,
  Sparkles,
  Bell,
  BellOff,
  Send,
  RefreshCw,
  ShieldCheck,
  Copy,
  Check,
  ChevronDown,
  Wind,
  Thermometer,
} from "lucide-react";
import {
  KOREA_CITIES,
  fetchWeatherData,
  formatMorningPushMessage,
  type CityOption,
  type WeatherData,
  type WeatherIconType,
} from "@/lib/weather";

// 클라이언트 초기 렌더링 시 사용할 기본 VAPID 공개키 폴백 (서버 /api/subscribe와 동기화됨)
const FALLBACK_VAPID_PUBLIC_KEY =
  "BG04J-2QB6-FzE8I6Bwa1zlqoUUMc3A53trl-fnrH6BeDdWZGz4_V1hYTuEdoeSi9WjSiD2nZjyznCB9RSpInqM";

/**
 * Base64 URL 문자열을 PushManager.subscribe의 applicationServerKey용 Uint8Array로 변환
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 두 좌표 사이의 대략적인 거리 계산 (가장 가까운 도시 매칭용)
 */
function getDistanceScore(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.hypot(lat1 - lat2, lon1 - lon2);
}

/**
 * 날씨 아이콘 타입에 맞는 대형 Lucide 아이콘 렌더링 컴포넌트
 */
function LargeWeatherIcon({ iconType }: { iconType: WeatherIconType }) {
  const baseClass = "w-20 h-20 drop-shadow-[0_8px_24px_rgba(255,255,255,0.35)]";

  switch (iconType) {
    case "sun":
      return <Sun className={`${baseClass} text-amber-300 animate-float-slow`} strokeWidth={1.75} />;
    case "cloud-sun":
      return <CloudSun className={`${baseClass} text-amber-200 animate-float-slow`} strokeWidth={1.75} />;
    case "cloud":
      return <Cloud className={`${baseClass} text-slate-100 animate-float-slow`} strokeWidth={1.75} />;
    case "fog":
      return <CloudFog className={`${baseClass} text-teal-100 animate-float-slow`} strokeWidth={1.75} />;
    case "drizzle":
      return <CloudDrizzle className={`${baseClass} text-sky-200 animate-float-slow`} strokeWidth={1.75} />;
    case "rain":
      return <CloudRain className={`${baseClass} text-sky-300 animate-float-slow`} strokeWidth={1.75} />;
    case "snow":
      return <Snowflake className={`${baseClass} text-cyan-100 animate-float-slow`} strokeWidth={1.75} />;
    case "thunderstorm":
      return <CloudLightning className={`${baseClass} text-amber-300 animate-float-slow`} strokeWidth={1.75} />;
    default:
      return <Sun className={`${baseClass} text-amber-300 animate-float-slow`} strokeWidth={1.75} />;
  }
}

export default function MorningWeatherPage() {
  // 선택된 도시/좌표 상태 (기본값: 서울)
  const [selectedCity, setSelectedCity] = useState<CityOption>(KOREA_CITIES[0]);
  const [isCustomGps, setIsCustomGps] = useState<boolean>(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(true);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);

  // Web Push 및 Service Worker 상태
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [subscriptionObj, setSubscriptionObj] = useState<PushSubscription | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || FALLBACK_VAPID_PUBLIC_KEY
  );
  const [pushLoading, setPushLoading] = useState<boolean>(false);
  const [testPushLoading, setTestPushLoading] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "info" | "error";
    text: string;
  } | null>(null);

  // 서버리스 환경변수 백업용 JSON 문자열
  const [envBackupString, setEnvBackupString] = useState<string>("");
  const [copiedEnv, setCopiedEnv] = useState<boolean>(false);

  // 날씨 데이터 로드 함수
  const loadWeather = useCallback(
    async (lat: number, lon: number, cityName: string) => {
      setLoadingWeather(true);
      try {
        const data = await fetchWeatherData(lat, lon, cityName);
        setWeather(data);
      } catch (err) {
        console.error("날씨 조회 오류:", err);
        setStatusBanner({
          type: "error",
          text: "날씨 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        });
      } finally {
        setLoadingWeather(false);
      }
    },
    []
  );

  // 초기 마운트: 저장된 도시 복원, 날씨 조회, Service Worker 등록 및 구독 상태 점검
  useEffect(() => {
    let initialCity = KOREA_CITIES[0];
    try {
      const savedCityStr = localStorage.getItem("morning_weather_city");
      if (savedCityStr) {
        const parsed = JSON.parse(savedCityStr) as CityOption;
        if (parsed?.latitude && parsed?.longitude && parsed?.name) {
          initialCity = parsed;
          setSelectedCity(parsed);
          setIsCustomGps(parsed.id === "gps");
        }
      }
    } catch {
      // localStorage 접근 불가 시 기본값(서울) 유지
    }

    loadWeather(
      initialCity.latitude,
      initialCity.longitude,
      initialCity.name
    );

    // 서버 VAPID 공개키 확인 및 서비스 워커 초기화
    async function initServiceWorkerAndPush() {
      try {
        const res = await fetch("/api/subscribe");
        if (res.ok) {
          const info = await res.json();
          if (info?.vapidPublicKey) {
            setVapidPublicKey(info.vapidPublicKey);
          }
        }
      } catch {
        // 네트워크 오류 시 기본 VAPID 공개키 유지
      }

      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });
          const existingSub = await registration.pushManager.getSubscription();
          if (existingSub) {
            setSubscriptionObj(existingSub);
            setIsSubscribed(true);
          }
        } catch (swError) {
          console.warn("Service Worker 등록 실패:", swError);
        }
      }
    }

    initServiceWorkerAndPush();
  }, [loadWeather]);

  // 드롭다운에서 도시 변경 핸들러
  const handleCitySelect = async (cityId: string) => {
    const found = KOREA_CITIES.find((c) => c.id === cityId);
    if (!found) return;

    setSelectedCity(found);
    setIsCustomGps(false);
    try {
      localStorage.setItem("morning_weather_city", JSON.stringify(found));
    } catch {
      // ignore
    }

    await loadWeather(found.latitude, found.longitude, found.name);

    // 이미 알림 구독 중이라면 변경된 도시 좌표를 서버 구독 정보에도 즉시 동기화
    if (isSubscribed && subscriptionObj) {
      try {
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "subscribe",
            subscription: subscriptionObj.toJSON(),
            city: found.name,
            latitude: found.latitude,
            longitude: found.longitude,
          }),
        });
        const data = await res.json();
        if (data?.envBackupJson) {
          setEnvBackupString(data.envBackupJson);
        }
        setStatusBanner({
          type: "info",
          text: `아침 8시 알림 지역이 '${found.name}'(으)로 변경되었습니다.`,
        });
      } catch {
        // ignore
      }
    }
  };

  // Geolocation API 연동: 현재 GPS 위치로 날씨 조회
  const handleLocateGps = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatusBanner({
        type: "error",
        text: "현재 브라우저에서 위치 정보(Geolocation) 기능을 지원하지 않습니다.",
      });
      return;
    }

    setLocatingGps(true);
    setStatusBanner(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));

        // 가장 가까운 주요 도시 이름 찾기
        let nearest = KOREA_CITIES[0];
        let minDistance = Infinity;
        for (const city of KOREA_CITIES) {
          const dist = getDistanceScore(lat, lon, city.latitude, city.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            nearest = city;
          }
        }

        const gpsCityLabel =
          minDistance < 0.35 ? `${nearest.name} (현위치)` : "현위치 (GPS)";

        const customOption: CityOption = {
          id: "gps",
          name: gpsCityLabel,
          region: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`,
          latitude: lat,
          longitude: lon,
        };

        setSelectedCity(customOption);
        setIsCustomGps(true);
        setLocatingGps(false);

        try {
          localStorage.setItem(
            "morning_weather_city",
            JSON.stringify(customOption)
          );
        } catch {
          // ignore
        }

        await loadWeather(lat, lon, gpsCityLabel);
        setStatusBanner({
          type: "success",
          text: `현재 위치(${gpsCityLabel}) 날씨를 업데이트했습니다.`,
        });
      },
      (err) => {
        setLocatingGps(false);
        setStatusBanner({
          type: "error",
          text:
            err.code === err.PERMISSION_DENIED
              ? "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용하거나 도시를 직접 선택해주세요."
              : "현재 위치를 가져오지 못했습니다. 도시 선택 드롭다운을 이용해주세요.",
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  };

  // 브라우저 PushSubscription 획득 헬퍼 (구독 토글 및 즉시 테스트 공용)
  const ensureBrowserSubscription =
    async (): Promise<PushSubscription | null> => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("Notification" in window)
      ) {
        setStatusBanner({
          type: "error",
          text: "이 브라우저는 Web Push 알림을 지원하지 않습니다. (iOS는 홈 화면에 추가 후 이용 가능)",
        });
        return null;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatusBanner({
          type: "error",
          text: "알림 권한이 거부되었습니다. 브라우저 주소창 옆 설정에서 알림 권한을 '허용'으로 변경해주세요.",
        });
        return null;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as unknown as BufferSource,
        });
      }

      setSubscriptionObj(sub);
      setIsSubscribed(true);
      return sub;
    };

  // "매일 아침 8시 날씨 알림 받기 (구독 On/Off)" 토글 핸들러
  const handleToggleSubscription = async () => {
    setPushLoading(true);
    setStatusBanner(null);

    try {
      if (isSubscribed && subscriptionObj) {
        // 구독 해지(Off) 처리
        const endpoint = subscriptionObj.endpoint;
        await subscriptionObj.unsubscribe().catch(() => null);

        await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unsubscribe",
            endpoint,
          }),
        });

        setSubscriptionObj(null);
        setIsSubscribed(false);
        setEnvBackupString("");
        setStatusBanner({
          type: "info",
          text: "매일 아침 8시 날씨 푸시 알림 구독이 해제되었습니다.",
        });
      } else {
        // 신규 구독(On) 처리
        const sub = await ensureBrowserSubscription();
        if (!sub) {
          setPushLoading(false);
          return;
        }

        const response = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "subscribe",
            subscription: sub.toJSON(),
            city: selectedCity.name,
            latitude: selectedCity.latitude,
            longitude: selectedCity.longitude,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.message || "구독 서버 등록에 실패했습니다.");
        }

        if (data.envBackupJson) {
          setEnvBackupString(data.envBackupJson);
        }

        setStatusBanner({
          type: "success",
          text: `🔔 매일 아침 8시(KST) '${selectedCity.name}' 날씨 알림 구독이 켜졌습니다!`,
        });
      }
    } catch (error: unknown) {
      console.error("구독 토글 오류:", error);
      setStatusBanner({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "푸시 알림 설정 중 오류가 발생했습니다.",
      });
    } finally {
      setPushLoading(false);
    }
  };

  // "푸시 알림 즉시 테스트" 버튼 핸들러
  const handleInstantTestPush = async () => {
    setTestPushLoading(true);
    setStatusBanner(null);

    try {
      const sub = subscriptionObj || (await ensureBrowserSubscription());
      if (!sub) {
        setTestPushLoading(false);
        return;
      }

      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          subscription: sub.toJSON(),
          city: selectedCity.name,
          latitude: selectedCity.latitude,
          longitude: selectedCity.longitude,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.message || "테스트 푸시 발송에 실패했습니다.");
      }

      if (data.envBackupJson) {
        setEnvBackupString(data.envBackupJson);
      }

      // 만약 OS 집중 모드 등으로 백그라운드 푸시가 늦게 뜰 경우를 대비해
      // 서비스 워커 로컬 알림도 함께 보장
      if ("serviceWorker" in navigator && data.briefing) {
        const reg = await navigator.serviceWorker.ready;
        await reg
          .showNotification(`[즉시 테스트] ${data.briefing.title}`, {
            body: data.briefing.body,
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: "morning-weather-test",
          })
          .catch(() => null);
      }

      setStatusBanner({
        type: "success",
        text: `🚀 발송 완료: "${data.briefing?.body}"`,
      });
    } catch (error: unknown) {
      console.error("테스트 푸시 오류:", error);
      setStatusBanner({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "테스트 푸시 발송 중 오류가 발생했습니다.",
      });
    } finally {
      setTestPushLoading(false);
    }
  };

  // SUBSCRIPTION_DATA 환경변수 문자열 복사 핸들러
  const handleCopyEnvBackup = async () => {
    if (!envBackupString) return;
    try {
      await navigator.clipboard.writeText(envBackupString);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2500);
    } catch {
      // ignore
    }
  };

  const bgGradientClass =
    weather?.current.weatherInfo.bgGradient ||
    "from-sky-500 via-blue-600 to-indigo-900";
  const ambientGlowClass =
    weather?.current.weatherInfo.ambientGlow || "bg-amber-300/30";
  const morningPreview = weather ? formatMorningPushMessage(weather) : null;

  return (
    <main className="relative flex items-center justify-center min-h-screen w-full bg-slate-950 sm:p-4 select-none overflow-hidden">
      {/* 데스크톱 배경 장식 블러 광원 */}
      <div className="pointer-events-none hidden sm:block absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-500/15 blur-3xl" />
      <div className="pointer-events-none hidden sm:block absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />

      {/* ====================================================================
          9:16 모바일 고정 뷰포트 컨테이너 (필수 규격 준수)
          aspect-[9/16] max-w-[400px] w-full h-screen max-h-[850px]
          ==================================================================== */}
      <section
        className={`relative aspect-[9/16] max-w-[400px] w-full h-screen max-h-[850px] flex flex-col justify-between overflow-y-auto no-scrollbar bg-gradient-to-b ${bgGradientClass} text-white sm:rounded-[38px] sm:border sm:border-white/25 sm:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] transition-colors duration-700 p-4 sm:p-5`}
      >
        {/* 컨테이너 내부 은은한 글래스 광원 */}
        <div
          className={`pointer-events-none absolute -top-12 right-4 w-52 h-52 rounded-full blur-3xl ${ambientGlowClass} animate-pulse-glow`}
        />

        {/* 1. 상단 바: 도시 선택 드롭다운 + GPS 버튼 + 새로고침 */}
        <header className="relative z-10 flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* 도시 선택 글래스 드롭다운 */}
            <div className="relative flex items-center bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-1.5 transition">
              <MapPin className="w-4 h-4 text-sky-200 mr-1.5 shrink-0" />
              <select
                aria-label="도시 선택"
                value={isCustomGps ? "gps" : selectedCity.id}
                onChange={(e) => handleCitySelect(e.target.value)}
                className="appearance-none bg-transparent text-sm font-semibold text-white pr-5 focus:outline-none cursor-pointer truncate"
              >
                {isCustomGps && (
                  <option value="gps" className="bg-slate-900 text-white">
                    {selectedCity.name}
                  </option>
                )}
                {KOREA_CITIES.map((city) => (
                  <option
                    key={city.id}
                    value={city.id}
                    className="bg-slate-900 text-white"
                  >
                    {city.name} ({city.region})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/80 pointer-events-none absolute right-2.5" />
            </div>

            {/* GPS 현재 위치 찾기 버튼 */}
            <button
              type="button"
              onClick={handleLocateGps}
              disabled={locatingGps}
              title="내 현재 위치(GPS) 날씨 조회"
              className="flex items-center justify-center bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md border border-white/20 rounded-2xl p-2 transition disabled:opacity-50"
            >
              <LocateFixed
                className={`w-4 h-4 text-white ${locatingGps ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* 업데이트 시각 & 새로고침 버튼 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {weather && (
              <span className="text-[11px] text-white/75 font-medium">
                {weather.updatedAt} 기준
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                loadWeather(
                  selectedCity.latitude,
                  selectedCity.longitude,
                  selectedCity.name
                )
              }
              disabled={loadingWeather}
              title="날씨 새로고침"
              className="bg-white/15 hover:bg-white/25 active:scale-95 backdrop-blur-md border border-white/20 rounded-2xl p-2 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-white ${loadingWeather ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </header>

        {/* 2. 메인 날씨 히어로 섹션 (현재 기온, 체감 온도, 최고/최저, 대형 아이콘) */}
        <div className="relative z-10 flex flex-col items-center text-center my-auto py-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-md text-[11px] font-medium text-sky-100 mb-2">
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>매일 아침 08:00 KST 스마트 웨더 브리핑</span>
          </div>

          {loadingWeather && !weather ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              <p className="text-xs text-white/80">
                Open-Meteo 실시간 기상 데이터를 불러오는 중...
              </p>
            </div>
          ) : weather ? (
            <>
              {/* 직관적인 대형 날씨 아이콘 */}
              <div className="my-1.5">
                <LargeWeatherIcon
                  iconType={weather.current.weatherInfo.iconType}
                />
              </div>

              {/* 날씨 상태 텍스트 */}
              <p className="text-base font-semibold tracking-wide text-white/95">
                {weather.current.weatherInfo.emoji}{" "}
                {weather.current.weatherInfo.label}
              </p>

              {/* 현재 기온 */}
              <div className="flex items-start justify-center mt-0.5">
                <span className="text-6xl font-extrabold tracking-tighter leading-none drop-shadow-md">
                  {weather.current.temperature}
                </span>
                <span className="text-2xl font-bold mt-1 ml-0.5">°C</span>
              </div>

              {/* 체감 온도 & 오늘 최고/최저 기온 */}
              <div className="flex items-center justify-center gap-2.5 mt-2 text-xs font-medium text-white/90 bg-black/15 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
                <span className="flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-300" />
                  체감 {weather.current.apparentTemperature}°C
                </span>
                <span className="text-white/30">|</span>
                <span>
                  최고{" "}
                  <strong className="text-rose-200 font-semibold">
                    {weather.daily.tempMax}°
                  </strong>
                </span>
                <span className="text-white/40">/</span>
                <span>
                  최저{" "}
                  <strong className="text-sky-200 font-semibold">
                    {weather.daily.tempMin}°
                  </strong>
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* 3. 상세 기상 지표 그리드 (강수확률, 습도, 자외선 지수, 미세먼지/우산) */}
        {weather && (
          <div className="relative z-10 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              {/* 강수 확률 & 우산 여부 */}
              <div className="bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-400/20 text-sky-200">
                  <Umbrella className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-white/70">강수확률 · 우산</p>
                  <p className="text-xs font-bold text-white truncate">
                    {weather.daily.precipitationProbabilityMax}% ·{" "}
                    <span
                      className={
                        weather.needsUmbrella
                          ? "text-amber-300"
                          : "text-emerald-200"
                      }
                    >
                      {weather.needsUmbrella ? "우산 필수" : "우산 불필요"}
                    </span>
                  </p>
                </div>
              </div>

              {/* 현재 습도 */}
              <div className="bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-400/20 text-blue-200">
                  <Droplets className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-white/70">현재 상대습도</p>
                  <p className="text-xs font-bold text-white">
                    {weather.current.humidity}%{" "}
                    <span className="text-[11px] font-normal text-white/75">
                      ({weather.current.humidity >= 70 ? "다소 습함" : weather.current.humidity <= 35 ? "건조" : "쾌적"})
                    </span>
                  </p>
                </div>
              </div>

              {/* 자외선 지수 */}
              <div className="bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400/20 text-amber-200">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-white/70">자외선 지수(UV)</p>
                  <p className="text-xs font-bold text-white">
                    {weather.daily.uvIndexMax}{" "}
                    <span className="text-[11px] font-medium text-amber-200">
                      ({weather.daily.uvLabel})
                    </span>
                  </p>
                </div>
              </div>

              {/* 미세먼지 등급 */}
              <div className="bg-white/12 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-400/20 text-emerald-200">
                  <Wind className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-white/70">미세먼지 (PM10)</p>
                  <p className="text-xs font-bold text-white truncate">
                    <span className={weather.airQuality.gradeColor}>
                      {weather.airQuality.gradeLabel}
                    </span>{" "}
                    <span className="text-[11px] font-normal text-white/75">
                      ({weather.airQuality.pm10}㎍/㎥)
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* 한줄 팁 & 아침 8시 브리핑 메시지 미리보기 카드 */}
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> 오늘의 외출 & 우산 한줄 팁
                </span>
                <span className="text-[10px] text-white/70 bg-black/20 px-2 py-0.5 rounded-full">
                  KST 08:00 발송 포맷
                </span>
              </div>
              <p className="text-xs text-white/95 leading-relaxed font-medium">
                {weather.oneLineTip}
              </p>
              {morningPreview && (
                <div className="pt-1.5 mt-1 border-t border-white/15 text-[11px] text-sky-100/90 truncate">
                  💬 {morningPreview.body}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. 하단 푸시 알림 구독 On/Off 토글 및 즉시 테스트 컨트롤 영역 */}
        <footer className="relative z-10 mt-2.5 pt-2.5 border-t border-white/15 space-y-2">
          {/* 상태 피드백 토스트 배너 */}
          {statusBanner && (
            <div
              className={`rounded-xl px-3 py-2 text-[11px] font-medium leading-snug border backdrop-blur-md transition-all ${
                statusBanner.type === "error"
                  ? "bg-rose-500/25 border-rose-300/40 text-rose-100"
                  : statusBanner.type === "success"
                    ? "bg-emerald-500/25 border-emerald-300/40 text-emerald-50"
                    : "bg-sky-500/25 border-sky-300/40 text-sky-100"
              }`}
            >
              {statusBanner.text}
            </div>
          )}

          {/* 매일 아침 8시 날씨 알림 받기 (구독 On/Off) 토글 버튼 */}
          <button
            type="button"
            onClick={handleToggleSubscription}
            disabled={pushLoading}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-xs border backdrop-blur-md transition-all active:scale-[0.99] ${
              isSubscribed
                ? "bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-300/50 text-white shadow-lg shadow-emerald-950/30"
                : "bg-white/20 hover:bg-white/25 border-white/30 text-white"
            }`}
          >
            <span className="flex items-center gap-2 text-left">
              {isSubscribed ? (
                <Bell className="w-4 h-4 text-emerald-300 shrink-0" />
              ) : (
                <BellOff className="w-4 h-4 text-white/75 shrink-0" />
              )}
              <span>
                매일 아침 8시 날씨 알림 받기{" "}
                <span className="text-[11px] opacity-85">
                  ({isSubscribed ? "구독 ON" : "구독 OFF"})
                </span>
              </span>
            </span>

            {/* 스위치 UI */}
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                isSubscribed ? "bg-emerald-400" : "bg-black/35"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isSubscribed ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </button>

          {/* 푸시 알림 즉시 테스트 버튼 + 서버리스 환경변수 복사 버튼 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstantTestPush}
              disabled={testPushLoading}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-900 hover:bg-sky-50 active:scale-[0.99] font-bold text-xs py-2.5 px-4 rounded-2xl shadow-md transition disabled:opacity-60"
            >
              <Send
                className={`w-3.5 h-3.5 text-blue-600 ${
                  testPushLoading ? "animate-ping" : ""
                }`}
              />
              <span>
                {testPushLoading
                  ? "테스트 푸시 발송 중..."
                  : "푸시 알림 즉시 테스트"}
              </span>
            </button>

            {envBackupString && (
              <button
                type="button"
                onClick={handleCopyEnvBackup}
                title="Vercel SUBSCRIPTION_DATA 환경변수용 구독 JSON 복사"
                className="flex items-center gap-1 bg-black/25 hover:bg-black/35 border border-white/25 text-[11px] font-medium text-white/90 py-2.5 px-3 rounded-2xl transition shrink-0"
              >
                {copiedEnv ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>복사됨</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-sky-200" />
                    <span>구독키 복사</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/65 px-1 pt-0.5">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-sky-300" />
              Open-Meteo 기상청 모델 연동
            </span>
            <span>Vercel Cron (UTC 23:00 / KST 08:00)</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
