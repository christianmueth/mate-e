import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.matee.muonapp",
  appName: "Mate-E",
  webDir: "public",
  server: {
    url: "https://mate-e.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;