/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.incident.deleteMany();
  await prisma.transitVehicle.deleteMany();
  await prisma.source.deleteMany();
  await prisma.dashboardStats.deleteMany();

  console.log('✓ Cleared existing data');

  // Create sources
  const miamiPD = await prisma.source.create({
    data: {
      name: 'Miami PD',
      type: 'official',
      url: 'https://www.miamigov.com/police',
      apiEndpoint: 'https://data.miamidade.gov/resource/crimes.json',
      isActive: true,
      fetchInterval: 30,
    },
  });

  const transitSource = await prisma.source.create({
    data: {
      name: 'Miami-Dade Transit',
      type: 'official',
      url: 'http://www.miamidade.gov/transit/',
      apiEndpoint: 'http://www.miamidade.gov/transit/mobile/',
      isActive: true,
      fetchInterval: 15,
    },
  });

  const emergencyFeed = await prisma.source.create({
    data: {
      name: 'Emergency Services',
      type: 'emergency',
      isActive: true,
      fetchInterval: 30,
    },
  });

  console.log('✓ Created sources');

  // Create sample incidents
  const locations = [
    { name: 'Downtown Miami', lat: 25.7617, lng: -80.1918 },
    { name: 'Little Havana', lat: 25.7655, lng: -80.2201 },
    { name: 'Brickell', lat: 25.7617, lng: -80.1918 },
    { name: 'Wynwood', lat: 25.8010, lng: -80.1994 },
    { name: 'Coconut Grove', lat: 25.7109, lng: -80.2535 },
    { name: 'Coral Gables', lat: 25.7215, lng: -80.2684 },
    { name: 'Miami Beach', lat: 25.7907, lng: -80.1300 },
  ];

  const incidentTypes = [
    { type: 'crime', category: 'theft', severity: 'low' },
    { type: 'crime', category: 'burglary', severity: 'medium' },
    { type: 'crime', category: 'assault', severity: 'high' },
    { type: 'crime', category: 'robbery', severity: 'high' },
    { type: 'accident', category: 'traffic', severity: 'medium' },
    { type: 'fire', category: 'building', severity: 'high' },
    { type: 'emergency', category: 'medical', severity: 'critical' },
  ];

  const now = new Date();
  const incidents = [];

  for (let i = 0; i < 50; i++) {
    const location = locations[Math.floor(Math.random() * locations.length)];
    const incidentType =
      incidentTypes[Math.floor(Math.random() * incidentTypes.length)];

    // Random time within last 24 hours
    const hoursAgo = Math.floor(Math.random() * 24);
    const reportedAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    const status = Math.random() > 0.3 ? 'active' : 'resolved';

    incidents.push({
      externalId: `EXT-${i + 1000}`,
      type: incidentType.type,
      category: incidentType.category,
      severity: incidentType.severity,
      status,
      title: generateIncidentTitle(incidentType),
      description: generateIncidentDescription(incidentType),
      location: location.name,
      latitude: location.lat + (Math.random() - 0.5) * 0.02,
      longitude: location.lng + (Math.random() - 0.5) * 0.02,
      address: `${Math.floor(Math.random() * 9999)} ${location.name} St`,
      reportedAt,
      resolvedAt: status === 'resolved' ? new Date(reportedAt.getTime() + 2 * 60 * 60 * 1000) : null,
      sourceId: Math.random() > 0.5 ? miamiPD.id : emergencyFeed.id,
      tags: generateTags(incidentType),
    });
  }

  await prisma.incident.createMany({ data: incidents });
  console.log(`✓ Created ${incidents.length} sample incidents`);

  // Create sample transit vehicles
  const transitVehicles = [];
  const routes = [
    { id: '95', name: 'Biscayne Express', type: 'bus' },
    { id: '120', name: 'Downtown Loop', type: 'bus' },
    { id: 'RAIL-1', name: 'Orange Line', type: 'metrorail' },
    { id: 'RAIL-2', name: 'Green Line', type: 'metrorail' },
    { id: 'MOVER-1', name: 'Downtown Mover', type: 'metromover' },
  ];

  for (let i = 0; i < 25; i++) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];

    transitVehicles.push({
      vehicleId: `${route.type.toUpperCase()}-${i + 100}`,
      routeId: route.id,
      routeName: route.name,
      vehicleType: route.type,
      latitude: location.lat + (Math.random() - 0.5) * 0.05,
      longitude: location.lng + (Math.random() - 0.5) * 0.05,
      heading: Math.floor(Math.random() * 360),
      speed: Math.floor(Math.random() * 40) + 10,
      status: 'active',
      occupancy: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
      lastUpdate: new Date(now.getTime() - Math.random() * 5 * 60 * 1000),
    });
  }

  await prisma.transitVehicle.createMany({ data: transitVehicles });
  console.log(`✓ Created ${transitVehicles.length} sample transit vehicles`);

  console.log('✅ Database seeding completed!');
}

function generateIncidentTitle(type: any): string {
  const titles: Record<string, string[]> = {
    theft: ['Vehicle Theft Reported', 'Shoplifting Incident', 'Bicycle Stolen'],
    burglary: ['Residential Burglary', 'Commercial Break-In', 'Home Invasion'],
    assault: ['Assault Reported', 'Domestic Disturbance', 'Physical Altercation'],
    robbery: ['Armed Robbery', 'Store Robbery', 'Street Robbery'],
    traffic: ['Traffic Accident', 'Multi-Vehicle Collision', 'Hit and Run'],
    building: ['Building Fire', 'Fire Alarm', 'Smoke Investigation'],
    medical: ['Medical Emergency', 'Ambulance Dispatched', 'Emergency Response'],
  };

  const categoryTitles = titles[type.category] || ['Incident Reported'];
  return categoryTitles[Math.floor(Math.random() * categoryTitles.length)];
}

function generateIncidentDescription(type: any): string {
  const descriptions: Record<string, string> = {
    theft: 'Officers responded to a theft report. Investigation ongoing.',
    burglary: 'Break-in reported at the location. Property taken, investigation in progress.',
    assault: 'Altercation between individuals. Officers on scene, victims receiving medical attention.',
    robbery: 'Robbery in progress call received. Suspects fled scene, investigation ongoing.',
    traffic: 'Traffic collision reported with injuries. Emergency services responding.',
    building: 'Fire department responding to fire call. Situation under control.',
    medical: 'Medical emergency call received. Paramedics en route.',
  };

  return descriptions[type.category] || 'Incident reported and under investigation.';
}

function generateTags(type: any): string[] {
  const baseTags: string[] = [];

  if (type.severity === 'critical') baseTags.push('urgent');
  if (type.type === 'crime' && Math.random() > 0.7) baseTags.push('weapon');
  if (Math.random() > 0.9) baseTags.push('officer-involved');

  return baseTags;
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
