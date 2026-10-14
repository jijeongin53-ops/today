// ============================================================================
// src/app/api/subscribe/route.ts
// 푸시 알림 구독 등록(subscribe), 해지(unsubscribe), 즉시 테스트 발송(test) API
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import {
  saveSubscription,
  removeSubscription,
  getAllSubscriptions,
} from "@/lib/storage";
import { getVapidPublicKey, sendWebPushNotification } from "@/lib/push";
import { fetchWeatherData, formatMorningPushMessage } from "@/lib/weather";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscribe
 * 프론트엔드 초기화 시 사용할 VAPID 공개키 및 현재 서버 구독 상태 요약 반환
 */
export async function GET() {
  const { subscribers, sources } = await getAllSubscriptions();

  return NextResponse.json({
    ok: true,
    vapidPublicKey: getVapidPublicKey(),
    subscriberCount: subscribers.length,
    storageSources: sources,
  });
}

/**
 * POST /api/subscribe
 * Body:
 *  - action: "subscribe" | "unsubscribe" | "test"
 *  - subscription: PushSubscription
 *  - city?: string
 *  - latitude?: number
 *  - longitude?: number
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action: "subscribe" | "unsubscribe" | "test" =
      body?.action || "subscribe";
    const subscription = body?.subscription as PushSubscription | undefined;
    const city: string = body?.city || "서울";
    const latitude = Number(body?.latitude ?? 37.5665);
    const longitude = Number(body?.longitude ?? 126.978);

    // 1. 구독 해지 요청 처리
    if (action === "unsubscribe") {
      const endpoint: string | undefined =
        subscription?.endpoint || body?.endpoint;
      if (!endpoint) {
        return NextResponse.json(
          { ok: false, message: "해지할 구독 endpoint가 없습니다." },
          { status: 400 }
        );
      }

      await removeSubscription(endpoint);
      return NextResponse.json({
        ok: true,
        action: "unsubscribe",
        message: "매일 아침 8시 날씨 알림 구독이 해지되었습니다.",
      });
    }

    // subscription 유효성 검사
    if (
      !subscription ||
      typeof subscription.endpoint !== "string" ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "유효하지 않은 PushSubscription 객체입니다. 브라우저 알림 권한과 서비스 워커 상태를 확인해주세요.",
        },
        { status: 400 }
      );
    }

    // 2. 즉시 테스트 푸시 알림 발송 요청 처리
    if (action === "test") {
      // 구독 정보도 최신 위치로 함께 갱신 저장
      const saved = await saveSubscription({
        subscription,
        city,
        latitude,
        longitude,
      });

      // Open-Meteo에서 실시간 날씨 조회 후 아침 브리핑 포맷 생성
      const weather = await fetchWeatherData(latitude, longitude, city);
      const briefing = formatMorningPushMessage(weather);

      const pushResult = await sendWebPushNotification(subscription, {
        title: `[즉시 테스트] ${briefing.title}`,
        body: briefing.body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: "morning-weather-test",
        url: "/",
      });

      if (!pushResult.success) {
        return NextResponse.json(
          {
            ok: false,
            action: "test",
            message: `테스트 푸시 발송 실패: ${pushResult.error || "알 수 없는 오류"}`,
            briefing,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        action: "test",
        message: `${city} 날씨 브리핑 테스트 푸시를 발송했습니다!`,
        briefing,
        storageMode: saved.storageMode,
        envBackupJson: saved.envBackupJson,
      });
    }

    // 3. 기본 구독 등록 (action === "subscribe")
    const saved = await saveSubscription({
      subscription,
      city,
      latitude,
      longitude,
    });

    // 구독 완료 확인용 웰컴 푸시 발송
    const weather = await fetchWeatherData(latitude, longitude, city);
    const briefing = formatMorningPushMessage(weather);

    const welcomePush = await sendWebPushNotification(subscription, {
      title: `🔔 매일 아침 8시 ${city} 날씨 알림 등록 완료!`,
      body: briefing.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "morning-weather-welcome",
      url: "/",
    });

    return NextResponse.json({
      ok: true,
      action: "subscribe",
      message: `매일 아침 8시(KST) ${city} 날씨 알림 구독이 완료되었습니다.`,
      welcomePushSent: welcomePush.success,
      storageMode: saved.storageMode,
      envBackupJson: saved.envBackupJson,
      subscriber: {
        id: saved.subscriber.id,
        city: saved.subscriber.city,
        latitude: saved.subscriber.latitude,
        longitude: saved.subscriber.longitude,
      },
    });
  } catch (error: unknown) {
    console.error("[POST /api/subscribe] 오류:", error);
    const message =
      error instanceof Error
        ? error.message
        : "구독 처리 중 서버 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
