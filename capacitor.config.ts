import type { CapacitorConfig } from '@capacitor/cli';

// Configuração do Capacitor para build Android e iOS
const config: CapacitorConfig = {
  appId: 'com.fleetmanager.app',
  appName: 'FleetManager',
  webDir: 'dist',
  server: {
    url: 'https://frota-swart.vercel.app',
  }
};

export default config;
