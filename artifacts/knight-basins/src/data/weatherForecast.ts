import { useQuery } from "@tanstack/react-query";

export interface DailyWeather {
  date: string;
  icon: string;
  description: string;
  tempMax: number;
  rainProb: number;
  isRainy: boolean;
  isThunderstorm: boolean;
}

const WMO_THAI: Record<number, { icon: string; description: string }> = {
  0: { icon: "☀️", description: "แดดจัด" },
  1: { icon: "🌤️", description: "ฟ้าโปร่ง/เมฆบางส่วน" },
  2: { icon: "⛅", description: "มีเมฆเป็นส่วนมาก" },
  3: { icon: "☁️", description: "เมฆครึ้ม" },
  45: { icon: "🌫️", description: "มีหมอก" },
  48: { icon: "🌫️", description: "มีหมอกหนา" },
  51: { icon: "🌦️", description: "ฝนปรอยๆ" },
  53: { icon: "🌦️", description: "ฝนตกเบาๆ" },
  55: { icon: "🌧️", description: "ฝนตกปานกลาง" },
  61: { icon: "🌧️", description: "ฝนตก" },
  63: { icon: "🌧️", description: "ฝนตกต่อเนื่อง" },
  65: { icon: "🌧️", description: "ฝนตกหนัก" },
  80: { icon: "🌧️", description: "ฝนซู่" },
  81: { icon: "🌧️", description: "ฝนตกหนัก" },
  82: { icon: "🌧️", description: "ฝนตกหนักมาก" },
  95: { icon: "⛈️", description: "พายุฝนฟ้าคะนอง" },
  96: { icon: "⛈️", description: "พายุฝนฟ้าคะนอง" },
  99: { icon: "⛈️", description: "พายุฝนรุนแรง" },
};

const FORECAST_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&daily=weathercode,temperature_2m_max,precipitation_probability_max&timezone=Asia%2FBangkok";

export function useWeatherForecast() {
  return useQuery<Record<string, DailyWeather>>({
    queryKey: ["open-meteo-weather-forecast"],
    queryFn: async () => {
      const res = await fetch(FORECAST_URL);
      if (!res.ok) throw new Error("Failed to fetch weather forecast");
      const data = await res.json();
      const daily = data?.daily;
      if (!daily?.time || !Array.isArray(daily.time)) return {};

      const map: Record<string, DailyWeather> = {};
      daily.time.forEach((dateStr: string, idx: number) => {
        const code = daily.weathercode?.[idx] ?? 0;
        const tempMax = Math.round(daily.temperature_2m_max?.[idx] ?? 30);
        const rainProb = Math.round(daily.precipitation_probability_max?.[idx] ?? 0);
        const info = WMO_THAI[code] ?? { icon: "🌦️", description: "สภาพอากาศแปรปรวน" };
        const isRainy = rainProb >= 50 || code >= 51;
        const isThunderstorm = code >= 95;

        map[dateStr] = {
          date: dateStr,
          icon: info.icon,
          description: info.description,
          tempMax,
          rainProb,
          isRainy,
          isThunderstorm,
        };
      });
      return map;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    gcTime: 1000 * 60 * 60 * 4,
  });
}
