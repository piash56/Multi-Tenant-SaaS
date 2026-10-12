export const serviceDefaults = {
  apiPort: 3001,
  webPort: 3000,
  apiUrl: "http://localhost:3001",
} as const;

export const apiPaths = {
  live: "/health/live",
  ready: "/health/ready",
} as const;
