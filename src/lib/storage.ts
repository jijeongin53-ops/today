// ============================================================================
// src/lib/storage.ts
// 서버리스(Vercel) 환경을 위한 추상화된 푸시 구독 데이터 스토리지 헬퍼
// 지원 계층:
//   1. Upstash Redis / Vercel KV (REST API 연동 - 다중 사용자 영구 저장)
//   2. SUBSCRIPTION_DATA 환경변수 폴백 (무DB 단일/소수 사용자 영구 설정)
//   3. 로컬 파일(/tmp 또는 .subscriptions.json) & 글로벌 인메모리 폴백
// ============================================================================

import fs from "fs";
import path from "path";
import os from "os";
import type { PushSubscription } from "web-push";

export interface StoredSubscriber {
  id: string; // endpoint 해시 또는 고유 키
  subscription: PushSubscription;
  city: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

const REDIS_HASH_KEY = "morning_weather:subscribers";

// 글로벌 인메모리 저장소 (서버리스 Warm 인스턴스 및 로컬 개발 유지용)
declare global {
  // eslint-disable-next-line no-var
  var __WEATHER_SUBSCRIBERS_MAP__: Map<string, StoredSubscriber> | undefined;
}

function getMemoryStore(): Map<string, StoredSubscriber> {
  if (!globalThis.__WEATHER_SUBSCRIBERS_MAP__) {
    globalThis.__WEATHER_SUBSCRIBERS_MAP__ = new Map<string, StoredSubscriber>();
  }
  return globalThis.__WEATHER_SUBSCRIBERS_MAP__;
}

/**
 * 로컬/서버리스 임시 파일 경로 반환
 * Vercel 서버리스 환경에서는 /tmp 디렉토리만 쓰기 가능하므로 자동 분기
 */
function getFallbackFilePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "morning-weather-subscriptions.json");
  }
  return path.join(process.cwd(), ".subscriptions.json");
}

/**
 * endpoint 문자열로부터 고유 ID 생성
 */
export function getSubscriberId(endpoint: string): string {
  return Buffer.from(endpoint).toString("base64url").slice(-48);
}

/**
 * Upstash Redis 또는 Vercel KV REST 환경변수 확인
 */
function getRedisConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

  if (url && token) {
    return { url: url.replace(/\/$/, ""), token };
  }
  return null;
}

/**
 * Upstash Redis REST API 명령 실행 헬퍼
 */
async function executeRedisCommand<T = unknown>(
  command: (string | number)[]
): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) return null;

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(`[Storage] Redis REST 응답 오류: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { result: T };
    return data.result;
  } catch (error) {
    console.warn("[Storage] Redis REST 호출 실패 (폴백 사용):", error);
    return null;
  }
}

/**
 * 환경변수 SUBSCRIPTION_DATA에서 구독 정보 파싱
 * 단일 객체 JSON 또는 배열 JSON 모두 호환
 */
function loadFromEnvVariable(): StoredSubscriber[] {
  const raw = process.env.SUBSCRIPTION_DATA?.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const validSubscribers: StoredSubscriber[] = [];

    for (const item of list) {
      // item 자체가 PushSubscription이거나 { subscription, city, latitude, longitude } 형태 모두 지원
      const sub: PushSubscription | undefined = item?.endpoint
        ? item
        : item?.subscription;

      if (sub && typeof sub.endpoint === "string" && sub.keys?.p256dh && sub.keys?.auth) {
        validSubscribers.push({
          id: getSubscriberId(sub.endpoint),
          subscription: sub,
          city: item?.city || process.env.DEFAULT_CITY_NAME || "서울",
          latitude: Number(item?.latitude ?? process.env.DEFAULT_LATITUDE ?? 37.5665),
          longitude: Number(item?.longitude ?? process.env.DEFAULT_LONGITUDE ?? 126.978),
          createdAt: item?.createdAt || new Date().toISOString(),
          updatedAt: item?.updatedAt || new Date().toISOString(),
        });
      }
    }

    return validSubscribers;
  } catch (error) {
    console.warn("[Storage] SUBSCRIPTION_DATA 환경변수 JSON 파싱 실패:", error);
    return [];
  }
}

/**
 * 로컬/임시 파일에서 구독 목록 읽기
 */
function loadFromFileFallback(): StoredSubscriber[] {
  try {
    const filePath = getFallbackFilePath();
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 로컬/임시 파일에 구독 목록 저장
 */
function saveToFileFallback(subscribers: StoredSubscriber[]): void {
  try {
    const filePath = getFallbackFilePath();
    fs.writeFileSync(filePath, JSON.stringify(subscribers, null, 2), "utf-8");
  } catch {
    // 읽기 전용 파일시스템인 경우 무시 (메모리 및 환경변수/Redis로 동작)
  }
}

/**
 * 구독 정보 저장 (생성 또는 위치 업데이트)
 */
export async function saveSubscription(params: {
  subscription: PushSubscription;
  city: string;
  latitude: number;
  longitude: number;
}): Promise<{
  subscriber: StoredSubscriber;
  storageMode: "redis" | "memory-and-file";
  envBackupJson: string;
}> {
  const id = getSubscriberId(params.subscription.endpoint);
  const now = new Date().toISOString();

  const subscriber: StoredSubscriber = {
    id,
    subscription: params.subscription,
    city: params.city || "서울",
    latitude: Number(params.latitude || 37.5665),
    longitude: Number(params.longitude || 126.978),
    createdAt: now,
    updatedAt: now,
  };

  // 1. 인메모리 저장
  const memoryStore = getMemoryStore();
  memoryStore.set(id, subscriber);

  // 2. 로컬/임시 파일 폴백 저장
  const existingFileList = loadFromFileFallback();
  const mergedMap = new Map<string, StoredSubscriber>();
  for (const item of existingFileList) {
    mergedMap.set(item.id, item);
  }
  for (const [key, val] of Array.from(memoryStore.entries())) {
    mergedMap.set(key, val);
  }
  mergedMap.set(id, subscriber);
  saveToFileFallback(Array.from(mergedMap.values()));

  // 3. Upstash Redis / Vercel KV 설정 시 영구 저장
  let storageMode: "redis" | "memory-and-file" = "memory-and-file";
  if (getRedisConfig()) {
    const redisResult = await executeRedisCommand([
      "HSET",
      REDIS_HASH_KEY,
      id,
      JSON.stringify(subscriber),
    ]);
    if (redisResult !== null) {
      storageMode = "redis";
    }
  }

  // Vercel 환경변수(SUBSCRIPTION_DATA)에 복사해 넣을 수 있는 직렬화 문자열 생성
  const envBackupJson = JSON.stringify({
    subscription: subscriber.subscription,
    city: subscriber.city,
    latitude: subscriber.latitude,
    longitude: subscriber.longitude,
  });

  return {
    subscriber,
    storageMode,
    envBackupJson,
  };
}

/**
 * 구독 해지 (삭제)
 */
export async function removeSubscription(endpoint: string): Promise<boolean> {
  const id = getSubscriberId(endpoint);

  // 1. 메모리에서 제거
  const memoryStore = getMemoryStore();
  memoryStore.delete(id);

  // 2. 파일 폴백에서 제거
  const fileList = loadFromFileFallback().filter((item) => item.id !== id);
  saveToFileFallback(fileList);

  // 3. Redis에서 제거
  if (getRedisConfig()) {
    await executeRedisCommand(["HDEL", REDIS_HASH_KEY, id]);
  }

  return true;
}

/**
 * 전체 활성 구독자 조회 (Redis + SUBSCRIPTION_DATA 환경변수 + 파일 + 메모리 병합)
 */
export async function getAllSubscriptions(): Promise<{
  subscribers: StoredSubscriber[];
  sources: string[];
}> {
  const combined = new Map<string, StoredSubscriber>();
  const sources: string[] = [];

  // 1. 환경변수 SUBSCRIPTION_DATA 로드
  const envSubs = loadFromEnvVariable();
  if (envSubs.length > 0) {
    sources.push("env:SUBSCRIPTION_DATA");
    for (const sub of envSubs) {
      combined.set(sub.id, sub);
    }
  }

  // 2. 파일 폴백 로드
  const fileSubs = loadFromFileFallback();
  if (fileSubs.length > 0) {
    sources.push("local-file");
    for (const sub of fileSubs) {
      combined.set(sub.id, sub);
    }
  }

  // 3. 인메모리 로드
  const memoryStore = getMemoryStore();
  if (memoryStore.size > 0) {
    sources.push("in-memory");
    for (const [id, sub] of Array.from(memoryStore.entries())) {
      combined.set(id, sub);
    }
  }

  // 4. Upstash Redis / Vercel KV 로드
  if (getRedisConfig()) {
    const rawValues = await executeRedisCommand<string[]>([
      "HVALS",
      REDIS_HASH_KEY,
    ]);
    if (Array.isArray(rawValues) && rawValues.length > 0) {
      sources.push("upstash-redis");
      for (const raw of rawValues) {
        try {
          const parsed = JSON.parse(raw) as StoredSubscriber;
          if (parsed && parsed.subscription?.endpoint) {
            combined.set(parsed.id || getSubscriberId(parsed.subscription.endpoint), parsed);
          }
        } catch {
          // 잘못된 레코드 무시
        }
      }
    }
  }

  return {
    subscribers: Array.from(combined.values()),
    sources: sources.length > 0 ? sources : ["empty"],
  };
}
