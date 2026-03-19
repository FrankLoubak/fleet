import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fleetmanager.app',
  appName: 'fleetManager',
  webDir: 'dist',
  server: {
    url: 'https://frota-swart.vercel.app/login',
    cleartext: true
  }
};

export default config;
