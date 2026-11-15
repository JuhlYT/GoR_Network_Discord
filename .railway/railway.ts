import { defineRailway, github, preserve, project, service, volume } from "railway/iac";

export const partial = "gor-discord-bot";

export default defineRailway(() => {
  const data = volume("gor-bot-data", { sizeMB: 500 });
  const bot = service("gor-community-bot", {
    source: github("JuhlYT/GoR_Network_Discord", { branch: "main" }),
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas: 1,
    volumeMounts: { "/data": data },
    env: {
      GOR_DATA_DIR: "/data",
      GOR_SUPPORT_ENABLED: "true",
      GOR_DISCORD_BOT_TOKEN: preserve(),
    },
    deploy: {
      sleepApplication: false,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
      overlapSeconds: 0,
      drainingSeconds: 15,
    },
  });
  return project("GoR Network", { resources: [bot, data] });
});
