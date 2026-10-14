// ============================================================================
// src/lib/push.ts
// web-push 기반 VAPID 인증 설정 및 푸시 알림 발송 헬퍼
// ============================================================================

import webpush, { type PushSubscription } from "web-push";

// 환경변수가 설정되지 않은 로컬 즉시 실행 환경을 위한 유효한 기본 VAPID 키 쌍 폴백
// 프로덕션(Vercel) 배포 시에는 반드시 .env / Vercel 환경변수에 고유 키를 등록하세요.
export const FALLBACK_VAPID_PUBLIC_KEY =
  "BG04J-2QB6-FzE8I6Bwa1zlqoUUMc3A53trl-fnrH6BeDdWZGz4_V1hYTuEdoeSi9WjSiD2nZjyznCB9RSpInqM";
const FALLBACK_VAPID_PRIVATE_KEY =
  "WS6F6RhkOyNCJ_8n5Zt4t7p0J3VLaE2mvH-4xSM9om0";

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
}

/**
 * 현재 활성화된 VAPID 공개키 반환 (프론트엔드/백엔드 공용)
 */
export function getVapidPublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    FALLBACK_VAPID_PUBLIC_KEY
  );
}

/**
 * web-push 라이브러리에 VAPID 세부 정보 등록
 */
export function configureWebPush(): {
  configured: boolean;
  usingFallbackKeys: boolean;
} {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    FALLBACK_VAPID_PUBLIC_KEY;
  const privateKey =
    process.env.VAPID_PRIVATE_KEY?.trim() || FALLBACK_VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:weather-alert@example.com";

  const usingFallbackKeys =
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY;

  webpush.setVapidDetails(subject, publicKey, privateKey);

  return {
    configured: true,
    usingFallbackKeys,
  };
}

/**
 * 단일 구독자에게 Web Push 알림 발송
 */
export async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: PushNotificationPayload
): Promise<{
  success: boolean;
  statusCode?: number;
  expired?: boolean;
  error?: string;
}> {
  try {
    configureWebPush();

    const messageString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icon.svg",
      badge: payload.badge || "/icon.svg",
      tag: payload.tag || "morning-weather-briefing",
      url: payload.url || "/",
    });

    const result = await webpush.sendNotification(subscription, messageString, {
      TTL: 60 * 60 * 12, // 12시간 유효
      urgency: "high",
    });

    return {
      success: true,
      statusCode: result.statusCode,
    };
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : undefined;

    const message =
      err instanceof Error ? err.message : "알 수 없는 푸시 발송 오류";

    // 404 또는 410 응답은 만료/해지된 브라우저 구독
    const expired = statusCode === 404 || statusCode === 410;

    return {
      success: false,
      statusCode,
      expired,
      error: message,
    };
  }
}
