// ============================================================================
// src/app/api/cron/weather/route.ts
// Vercel Cron Job 엔드포인트 (매일 아침 8시 KST = 전날 23:00 UTC 자동 실행)
// vercel.json -> "schedule": "0 23 * * *"
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getAllSubscriptions, removeSubscription } from "@/lib/storage";
import { sendWebPushNotification } from "@/lib/push";
import {
  fetchWeatherData,
  formatMorningPushMessage,
  type WeatherData,
} from "@/lib/weather";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron 인증 검증 헬퍼
 * - 프로덕션에서 CRON_SECRET 환경변수가 설정된 경우 Authorization 헤더 또는 ?secret 쿼리 확인
 * - 로컬 개발 환경(development)이거나 CRON_SECRET 미설정 시에는 즉시 허용
 */
function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || process.env.NODE_ENV === "development") {
    return true;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const querySecret = request.nextUrl.searchParams.get("secret");
  if (querySecret === cronSecret) {
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Unauthorized: 유효한 CRON_SECRET 인증이 필요합니다.",
      },
      { status: 401 }
    );
  }

  try {
    const { subscribers, sources } = await getAllSubscriptions();

    // 기본 위치(서울) 기준 대표 날씨 요약 생성 (구독자가 0명일 때도 크론 응답 확인 가능)
    const defaultCity = process.env.DEFAULT_CITY_NAME || "서울";
    const defaultLat = Number(process.env.DEFAULT_LATITUDE ?? 37.5665);
    const defaultLon = Number(process.env.DEFAULT_LONGITUDE ?? 126.978);

    // 좌표별 날씨 데이터 캐시 (동일 도시 구독자가 여러 명일 때 API 중복 호출 방지)
    const weatherCache = new Map<string, WeatherData>();

    const getCachedWeather = async (
      lat: number,
      lon: number,
      city: string
    ): Promise<WeatherData> => {
      const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
      const cached = weatherCache.get(cacheKey);
      if (cached) return { ...cached, city };

      const fresh = await fetchWeatherData(lat, lon, city);
      weatherCache.set(cacheKey, fresh);
      return fresh;
    };

    const defaultWeather = await getCachedWeather(
      defaultLat,
      defaultLon,
      defaultCity
    );
    const defaultBriefing = formatMorningPushMessage(defaultWeather);

    if (subscribers.length === 0) {
      return NextResponse.json({
        ok: true,
        executedAtKST: new Date().toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        }),
        message:
          "현재 등록된 푸시 구독자가 없습니다. 웹앱에서 '매일 아침 8시 날씨 알림 받기'를 켜거나 SUBSCRIPTION_DATA 환경변수를 등록하세요.",
        sampleBriefing: defaultBriefing,
        storageSources: sources,
        stats: {
          totalSubscribers: 0,
          sent: 0,
          failed: 0,
          expiredRemoved: 0,
        },
      });
    }

    let sent = 0;
    let failed = 0;
    let expiredRemoved = 0;
    const deliveryLogs: Array<{
      id: string;
      city: string;
      status: "sent" | "failed" | "expired_removed";
      summary: string;
      error?: string;
    }> = [];

    // 모든 구독자에게 병렬 발송
    await Promise.all(
      subscribers.map(async (sub) => {
        try {
          const weather = await getCachedWeather(
            sub.latitude,
            sub.longitude,
            sub.city
          );
          const briefing = formatMorningPushMessage(weather);

          const result = await sendWebPushNotification(sub.subscription, {
            title: briefing.title,
            body: briefing.body,
            icon: "/icon.svg",
            badge: "/icon.svg",
            tag: "morning-weather-8am-cron",
            url: "/",
          });

          if (result.success) {
            sent += 1;
            deliveryLogs.push({
              id: sub.id,
              city: sub.city,
              status: "sent",
              summary: briefing.body,
            });
          } else if (result.expired) {
            expiredRemoved += 1;
            await removeSubscription(sub.subscription.endpoint);
            deliveryLogs.push({
              id: sub.id,
              city: sub.city,
              status: "expired_removed",
              summary: briefing.body,
              error: "만료된 구독이 자동 삭제되었습니다.",
            });
          } else {
            failed += 1;
            deliveryLogs.push({
              id: sub.id,
              city: sub.city,
              status: "failed",
              summary: briefing.body,
              error: result.error,
            });
          }
        } catch (err: unknown) {
          failed += 1;
          deliveryLogs.push({
            id: sub.id,
            city: sub.city,
            status: "failed",
            summary: defaultBriefing.body,
            error: err instanceof Error ? err.message : "발송 중 예외 발생",
          });
        }
      })
    );

    return NextResponse.json({
      ok: true,
      executedAtKST: new Date().toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      }),
      storageSources: sources,
      stats: {
        totalSubscribers: subscribers.length,
        sent,
        failed,
        expiredRemoved,
      },
      sampleBriefing: defaultBriefing,
      deliveries: deliveryLogs,
    });
  } catch (error: unknown) {
    console.error("[GET /api/cron/weather] 크론 실행 오류:", error);
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "날씨 크론 작업 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
