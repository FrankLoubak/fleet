import { Journey, RefuelingRecord, MaintenanceRecord, MaintenanceRequest, User, Vehicle, MaintenanceType } from '../types';
import { MOCK_VEHICLES, MOCK_USERS, MOCK_PROVIDERS } from '../utils';

export function generateSeedData() {
  const journeys: Journey[] = [];
  const refuelings: RefuelingRecord[] = [];
  const maintenances: MaintenanceRecord[] = [];
  const maintenanceRequests: MaintenanceRequest[] = [];
  
  const drivers = MOCK_USERS.filter(u => u.role === 'Operador');
  const vehicles = [...MOCK_VEHICLES];
  
  // Track odometer for each vehicle
  const vehicleOdometers: Record<string, number> = {};
  vehicles.forEach(v => {
    vehicleOdometers[v.id] = Math.max(1000, v.lastOdometer - 30000); 
  });

  const observationsOptions = [
    "Veículo em perfeitas condições.",
    "Check-up de rotina ok.",
    "Pneus calibrados.",
    "Nível de fluídos verificado.",
    "Nenhuma observação.",
    "Limpeza realizada.",
    "Pronto para viagem.",
    "Freios revisados."
  ];

  // Current date is March 7, 2026
  // Generate data for the last 12 months (Mar 2025 - Mar 2026)
  const now = new Date(2026, 2, 7); // March 7, 2026
  
  // We want approx 200 records total.
  // Let's generate 100 journeys, 70 refuelings, 30 maintenances.
  
  // 1. Journeys (100)
  for (let i = 0; i < 100; i++) {
    const vehicle = vehicles[i % vehicles.length];
    const driver = drivers[i % drivers.length];
    
    // Random date in the last 12 months
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const dateStr = date.toISOString().split('T')[0];
    
    const startOdometer = vehicleOdometers[vehicle.id];
    const distance = Math.floor(Math.random() * 200) + 50;
    const endOdometer = startOdometer + distance;
    
    journeys.push({
      id: `J-${i}`,
      userId: driver.id,
      vehicleId: vehicle.id,
      startTime: `${dateStr}T08:00:00.000Z`,
      endTime: `${dateStr}T18:00:00.000Z`,
      startOdometer,
      endOdometer,
      distanceTraveled: distance,
      status: 'encerrada',
      observations: observationsOptions[i % observationsOptions.length]
    });
    
    vehicleOdometers[vehicle.id] = endOdometer;
  }

  // 2. Refuelings (70)
  for (let i = 0; i < 70; i++) {
    const vehicle = vehicles[i % vehicles.length];
    
    // Random date in the last 12 months
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const dateStr = date.toISOString().split('T')[0];
    
    const locationOptions = ["Posto Central", "Posto Ipiranga", "Posto Shell", "Posto Petrobras", "Posto BR", "Posto da Cidade", "Auto Posto 24h"];
    const location = locationOptions[Math.floor(Math.random() * locationOptions.length)];

    refuelings.push({
      id: `R-${i}`,
      date: dateStr,
      odometer: vehicleOdometers[vehicle.id] - Math.floor(Math.random() * 100),
      quantity: Math.floor(Math.random() * 40) + 20,
      fuelType: vehicle.model.includes('Cargo') || vehicle.model.includes('Accelo') || vehicle.model.includes('Scania') || vehicle.model.includes('Volvo') ? 'Diesel' : 'Gasolina',
      vehicleId: vehicle.id,
      location: location
    });
  }

  // 3. Maintenances (30)
  for (let i = 0; i < 30; i++) {
    const vehicle = vehicles[i % vehicles.length];
    
    // Random date in the last 12 months
    const daysAgo = Math.floor(Math.random() * 365);
    const date = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const dateStr = date.toISOString().split('T')[0];
    
    const type: MaintenanceType[] = ['Mecanica', 'Eletrica', 'Acessórios', 'Borracharia', 'Ar de serviço'];
    const selectedType = type[i % type.length];
    const providers = MOCK_PROVIDERS.filter(p => p.type === selectedType);
    
    maintenances.push({
      id: `M-${i}`,
      date: dateStr,
      type: selectedType,
      provider: providers[0].name,
      mileage: vehicleOdometers[vehicle.id] - Math.floor(Math.random() * 500),
      description: `Manutenção preventiva de ${selectedType.toLowerCase()}.`,
      vehicleId: vehicle.id,
      status: 'executada'
    });
  }

  // Save to localStorage
  localStorage.setItem('all_journeys', JSON.stringify(journeys));
  localStorage.setItem('all_refuelings', JSON.stringify(refuelings));
  localStorage.setItem('all_maintenances', JSON.stringify(maintenances));
  localStorage.setItem('all_maintenance_requests', JSON.stringify(maintenanceRequests));
  localStorage.setItem('vehicles_odometers', JSON.stringify(vehicleOdometers));
  
  return {
    journeysCount: journeys.length,
    refuelingsCount: refuelings.length,
    maintenancesCount: maintenances.length
  };
}
