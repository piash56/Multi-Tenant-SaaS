const baseUrl = process.env.API_URL ?? "http://localhost:3001";

for (const path of ["/health/live", "/health/ready"]) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.text();
  console.log(`${path}: ${response.status} ${body}`);
  if (!response.ok) process.exitCode = 1;
}
