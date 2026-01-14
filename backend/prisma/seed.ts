/**
 * Database Seeder
 * Populates the database with sample data for development
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
  await prisma.alertRule.deleteMany();

  console.log('✓ Cleared existing data');

  // Create sources
  const sources = await Promise.all([
    prisma.source.create({
      data: {
        name: 'Miami PD',
        type: 'official',
        url: 'https://www.miamigov.com/police',
        apiEndpoint: 'https://data.miamidade.gov/resource/crimes.json',
        isActive: true,
        fetchInterval: 30,
      },
    }),
    prisma.source.create({
      data: {
        name: 'Miami-Dade Transit',
        type: 'official',
        url: 'http://www.miamidade.gov/transit/',
        apiEndpoint: 'http://www.miamidade.gov/transit/mobile/',
        isActive: true,
        fetchInterval: 15,
      },
    }),
    prisma.source.create({
      data: {
        name: 'Emergency Services',
        type: 'emergency',
        isActive: true,
        fetchInterval: 30,
      },
    }),
  ]);

  console.log(`✓ Created ${sources.length} sources`);

  // Miami locations
  const locations = [
    { name: 'Downtown Miami', lat: 25.7617, lng: -80.1918 },
    { name: 'Little Havana', lat: 25.7655, lng: -80.2201 },
    { name: 'Brickell', lat: 25.7617, lng: -80.1918 },
    { name: 'Wynwood', lat: 25.8010, lng: -80.1994 },
    { name: 'Coconut Grove', lat: 25.7109, lng: -80.2535 },
    { name: 'Coral Gables', lat: 25.7215, lng: -80.2684 },
    { name: 'Miami Beach', lat: 25.7907, lng: -80.1300 },
    { name: 'South Beach', lat: 25.7825, lng: -80.1340 },
    { name: 'Aventura', lat: 25.9565, lng: -80.1395 },
    { name: 'Kendall', lat: 25.6795, lng: -80.3174 },
  ];

  // Incident templates
  const incidentTemplates = [
    { type: 'crime', category: 'theft', severity: 'low', title: 'Vehicle Theft Reported' },
    { type: 'crime', category: 'theft', severity: 'medium', title: 'Shoplifting Incident' },
    { type: 'crime', category: 'burglary', severity: 'medium', title: 'Residential Burglary' },
    { type: 'crime', category: 'burglary', severity: 'high', title: 'Commercial Break-In' },
    { type: 'crime', category: 'assault', severity: 'high', title: 'Assault Reported' },
    { type: 'crime', category: 'robbery', severity: 'high', title: 'Armed Robbery' },
    { type: 'crime', category: 'robbery', severity: 'critical', title: 'Armed Robbery with Injuries' },
    { type: 'accident', category: 'traffic', severity: 'low', title: 'Minor Fender Bender' },
    { type: 'accident', category: 'traffic', severity: 'medium', title: 'Traffic Accident' },
    { type: 'accident', category: 'traffic', severity: 'high', title: 'Multi-Vehicle Collision' },
    { type: 'fire', category: 'building', severity: 'high', title: 'Building Fire' },
    { type: 'fire', category: 'vehicle', severity: 'medium', title: 'Vehicle Fire' },
    { type: 'emergency', category: 'medical', severity: 'critical', title: 'Medical Emergency' },
    { type: 'emergency', category: 'hazmat', severity: 'high', title: 'Hazmat Situation' },
  ];

  // Generate incidents over last 72 hours
  const now = new Date();
  const incidents = [];

  for (let i = 0; i < 150; i++) {
    const template = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];

    // Random time within last 72 hours
    const hoursAgo = Math.floor(Math.random() * 72);
    const reportedAt = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

    const status = Math.random() > 0.4 ? 'active' : 'resolved';

    incidents.push({
      externalId: `EXT-${Date.now()}-${i}`,
      type: template.type,
      category: template.category,
      severity: template.severity,
      status,
      title: template.title,
      description: generateDescription(template),
      location: location.name,
      latitude: location.lat + (Math.random() - 0.5) * 0.02,
      longitude: location.lng + (Math.random() - 0.5) * 0.02,
      address: `${Math.floor(Math.random() * 9999)} ${location.name} St`,
      reportedAt,
      resolvedAt: status === 'resolved' ? new Date(reportedAt.getTime() + 2 * 60 * 60 * 1000) : null,
      sourceId: source.id,
      tags: generateTags(template),
    });
  }

  await prisma.incident.createMany({ data: incidents });
  console.log(`✓ Created ${incidents.length} incidents`);

  // Create transit vehicles
  const routes = [
    { id: '95', name: '95 - Biscayne Express', type: 'bus' },
    { id: '120', name: '120 - Downtown Loop', type: 'bus' },
    { id: '150', name: '150 - Miami Beach', type: 'bus' },
    { id: 'S', name: 'S - South Miami-Dade Express', type: 'bus' },
    { id: 'RAIL-1', name: 'Orange Line', type: 'metrorail' },
    { id: 'RAIL-2', name: 'Green Line', type: 'metrorail' },
    { id: 'MOVER-1', name: 'Downtown Loop', type: 'metromover' },
    { id: 'MOVER-2', name: 'Brickell Loop', type: 'metromover' },
  ];

  const vehicles = [];
  for (let i = 0; i < 80; i++) {
    const route = routes[Math.floor(Math.random() * routes.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];

    vehicles.push({
      vehicleId: `${route.type.toUpperCase()}-${i + 1000}`,
      routeId: route.id,
      routeName: route.name,
      vehicleType: route.type,
      latitude: location.lat + (Math.random() - 0.5) * 0.05,
      longitude: location.lng + (Math.random() - 0.5) * 0.05,
      heading: Math.floor(Math.random() * 360),
      speed: route.type === 'bus' ? Math.floor(Math.random() * 40) + 10 : Math.floor(Math.random() * 60) + 20,
      status: Math.random() > 0.1 ? 'active' : 'delayed',
      occupancy: ['empty', 'low', 'medium', 'high', 'full'][Math.floor(Math.random() * 5)],
      lastUpdate: new Date(now.getTime() - Math.random() * 5 * 60 * 1000),
    });
  }

  await prisma.transitVehicle.createMany({ data: vehicles });
  console.log(`✓ Created ${vehicles.length} transit vehicles`);

  // Create sample alert rules
  const alertRules = [
    {
      name: 'Critical Incidents Alert',
      isActive: true,
      conditions: { severity: 'critical' },
      severity: 'critical',
      notifyChannels: ['email', 'sms'],
    },
    {
      name: 'High Severity in Downtown',
      isActive: true,
      conditions: { severity: 'high', location: 'Downtown Miami' },
      severity: 'high',
      notifyChannels: ['email'],
    },
  ];

  await prisma.alertRule.createMany({ data: alertRules });
  console.log(`✓ Created ${alertRules.length} alert rules`);

  console.log('✅ Database seeding completed successfully!');
}

function generateDescription(template: any): string {
  const descriptions: Record<string, string> = {
    theft: 'Officers responded to a theft report. Investigation ongoing.',
    burglary: 'Break-in reported at the location. Property taken, investigation in progress.',
    assault: 'Altercation between individuals. Officers on scene, victims receiving medical attention.',
    robbery: 'Robbery reported. Suspects fled scene, investigation ongoing.',
    traffic: 'Traffic collision reported. Emergency services on scene.',
    building: 'Fire department responding to structure fire. Situation under control.',
    vehicle: 'Vehicle fire reported. Fire department en route.',
    medical: 'Medical emergency call received. Paramedics dispatched.',
    hazmat: 'Hazardous materials situation. Area secured, specialist team responding.',
  };

  return descriptions[template.category] || 'Incident reported and under investigation.';
}

function generateTags(template: any): string[] {
  const tags: string[] = [];

  if (template.severity === 'critical') tags.push('urgent');
  if (template.severity === 'high') tags.push('priority');
  if (template.category === 'robbery' && Math.random() > 0.5) tags.push('weapon');
  if (Math.random() > 0.9) tags.push('officer-involved');
  if (template.type === 'crime' && Math.random() > 0.8) tags.push('suspects-at-large');

  return tags;
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
