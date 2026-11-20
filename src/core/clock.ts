/**
 * Game Clock & Lighting Curve — Locked to 档位 B:
 * 1 real second = 1 game minute (24 real minutes = 1 game day).
 */

export type ClockSpeed = 0 | 1 | 2 | 3;

export interface SkyPalette {
  skyTop: string;
  skyBottom: string;
  cloudColor: string;
  starAlpha: number;
  ambientDarkness: number; // 0 (bright noon) -> 0.56 (night without lamps)
  weatherIcon: string;
  periodLabel: string;
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const;

export class GameClock {
  public day: number;
  /** Minutes since midnight: 0..1439 */
  public minuteOfDay: number;
  public speed: ClockSpeed = 1;
  private accumSec = 0;
  private lastSundayBillDay = 0;

  constructor(day = 1, minuteOfDay = 17 * 60 + 45, lastSundayBillDay = 0) {
    this.day = day;
    this.minuteOfDay = minuteOfDay;
    this.lastSundayBillDay = lastSundayBillDay;
  }

  public get weekdayIndex(): number {
    return (this.day - 1) % 7;
  }

  public get weekdayName(): string {
    return WEEKDAYS[this.weekdayIndex];
  }

  public get hour(): number {
    return Math.floor(this.minuteOfDay / 60);
  }

  public get minute(): number {
    return Math.floor(this.minuteOfDay % 60);
  }

  public get formattedTime(): string {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    return `${h}:${m}`;
  }

  public get isNightMarketOpen(): boolean {
    return this.hour >= 18 || this.hour < 2;
  }

  public advance(dtSeconds: number): {
    dayChanged: boolean;
    triggerSundayBill: boolean;
  } {
    if (this.speed === 0) {
      return { dayChanged: false, triggerSundayBill: false };
    }

    const speedMult = this.speed === 1 ? 1 : this.speed === 2 ? 3 : 8;
    this.accumSec += dtSeconds * speedMult;
    return this.drainMinutes();
  }

  public advanceMinutes(minutes: number): {
    dayChanged: boolean;
    triggerSundayBill: boolean;
  } {
    this.accumSec += Math.max(0, minutes);
    return this.drainMinutes();
  }

  private drainMinutes(): {
    dayChanged: boolean;
    triggerSundayBill: boolean;
  } {
    let dayChanged = false;
    let triggerSundayBill = false;

    while (this.accumSec >= 1) {
      this.accumSec -= 1;
      this.minuteOfDay += 1;
      if (this.minuteOfDay >= 1440) {
        this.minuteOfDay -= 1440;
        this.day += 1;
        dayChanged = true;
      }
      // Every Sunday at 20:00 settle utility & property bill once
      if (this.weekdayIndex === 6 && this.minuteOfDay === 20 * 60 && this.lastSundayBillDay !== this.day) {
        this.lastSundayBillDay = this.day;
        triggerSundayBill = true;
      }
    }

    return { dayChanged, triggerSundayBill };
  }

  public skipToNextEveningOrMorning(targetHour: number): boolean {
    const targetMin = targetHour * 60;
    const prevDay = this.day;
    if (this.minuteOfDay >= targetMin) {
      this.day += 1;
    }
    this.minuteOfDay = targetMin;
    return this.day !== prevDay;
  }

  public getLastSundayBillDay(): number {
    return this.lastSundayBillDay;
  }

  public getSkyPalette(): SkyPalette {
    const h = this.minuteOfDay / 60;

    if (h >= 7 && h < 16.5) {
      return {
        skyTop: '#6ec0f5',
        skyBottom: '#b9e7ff',
        cloudColor: '#ffffff',
        starAlpha: 0,
        ambientDarkness: 0,
        weatherIcon: '☀️',
        periodLabel: '晴朗白天',
      };
    }

    if (h >= 16.5 && h < 19.5) {
      const t = (h - 16.5) / 3.0;
      return {
        skyTop: lerpHex('#7d67a8', '#2a2759', t),
        skyBottom: lerpHex('#f7a26d', '#e47a74', t),
        cloudColor: lerpHex('#ffd89c', '#f5a988', t),
        starAlpha: Math.max(0, (t - 0.55) * 1.8),
        ambientDarkness: t * 0.24,
        weatherIcon: '🌇',
        periodLabel: '温柔黄昏',
      };
    }

    if (h >= 19.5 || h < 5.5) {
      return {
        skyTop: '#181c3a',
        skyBottom: '#2d3566',
        cloudColor: '#3f497d',
        starAlpha: 0.92,
        ambientDarkness: 0.52,
        weatherIcon: '🌙',
        periodLabel: '星夜时光',
      };
    }

    // Dawn 05:30 - 07:00
    const t = (h - 5.5) / 1.5;
    return {
      skyTop: lerpHex('#2b3266', '#6ec0f5', t),
      skyBottom: lerpHex('#e69a8d', '#b9e7ff', t),
      cloudColor: lerpHex('#ffdcc9', '#ffffff', t),
      starAlpha: Math.max(0, 1 - t * 1.5),
      ambientDarkness: (1 - t) * 0.35,
      weatherIcon: '🌅',
      periodLabel: '清晨微光',
    };
  }
}

function lerpHex(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - clamped) + ((b >> 16) & 255) * clamped);
  const g = Math.round(((a >> 8) & 255) * (1 - clamped) + ((b >> 8) & 255) * clamped);
  const bl = Math.round((a & 255) * (1 - clamped) + (b & 255) * clamped);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}
