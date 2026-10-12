export interface ServiceHealth {
  status: "ok" | "error";
  service: "api" | "worker";
  timestamp: string;
}

export interface ReadinessHealth extends ServiceHealth {
  dependencies: {
    postgres: "up" | "down";
    redis: "up" | "down";
  };
}

export const realtimeEventNames = {
  connected: "system:connected",
} as const;
