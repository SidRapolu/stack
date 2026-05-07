import type { ServiceDef } from '@/types'

export const SERVICES: ServiceDef[] = [
  // Compute
  { name: 'AWS Lambda',     icon: 'λ',  bg: '#d4edda', fg: '#155724', category: 'Compute' },
  { name: 'EC2',            icon: '□',  bg: '#d0e8ff', fg: '#0c4a8a', category: 'Compute' },
  { name: 'ECS',            icon: '⬡',  bg: '#cfe2ff', fg: '#084298', category: 'Compute' },
  { name: 'Cloud Run',      icon: '▶',  bg: '#d3d3f7', fg: '#3730a3', category: 'Compute' },
  // Data
  { name: 'DynamoDB',       icon: 'Δ',  bg: '#d0e8ff', fg: '#0c4a8a', category: 'Data' },
  { name: 'PostgreSQL',     icon: 'Pg', bg: '#cfe2ff', fg: '#084298', category: 'Data' },
  { name: 'Redis',          icon: 'R',  bg: '#ffd6d6', fg: '#7f1d1d', category: 'Data' },
  { name: 'S3',             icon: '◉',  bg: '#fde8cc', fg: '#7c2d12', category: 'Data' },
  { name: 'Snowflake',      icon: '❄',  bg: '#d0f0ff', fg: '#0c4a6e', category: 'Data' },
  // Messaging
  { name: 'SQS',            icon: '⟶',  bg: '#fef9c3', fg: '#713f12', category: 'Messaging' },
  { name: 'Kafka',          icon: 'K',  bg: '#ede9fe', fg: '#4c1d95', category: 'Messaging' },
  { name: 'Pub/Sub',        icon: '◎',  bg: '#d1fae5', fg: '#064e3b', category: 'Messaging' },
  // Networking
  { name: 'API Gateway',    icon: '⊕',  bg: '#d1fae5', fg: '#064e3b', category: 'Networking' },
  { name: 'CloudFront',     icon: '◈',  bg: '#fef9c3', fg: '#713f12', category: 'Networking' },
  { name: 'Load Balancer',  icon: '⇌',  bg: '#d0e8ff', fg: '#0c4a8a', category: 'Networking' },
  { name: 'Route 53',       icon: '⊞',  bg: '#d1fae5', fg: '#064e3b', category: 'Networking' },
  // Auth
  { name: 'Cognito',        icon: 'C',  bg: '#fce7f3', fg: '#831843', category: 'Auth' },
  { name: 'Auth0',          icon: 'A',  bg: '#ede9fe', fg: '#4c1d95', category: 'Auth' },
  { name: 'Clerk',          icon: 'cl', bg: '#dbeafe', fg: '#1e3a5f', category: 'Auth' },
  // Observability
  { name: 'Datadog',        icon: '◈',  bg: '#ffd6d6', fg: '#7f1d1d', category: 'Observability' },
  { name: 'CloudWatch',     icon: '◉',  bg: '#fef9c3', fg: '#713f12', category: 'Observability' },
  { name: 'Sentry',         icon: '⊗',  bg: '#ffd6d6', fg: '#7f1d1d', category: 'Observability' },
]

export const SERVICE_CATEGORIES = [
  'Compute',
  'Data',
  'Messaging',
  'Networking',
  'Auth',
  'Observability',
] as const

export const DID_YOU_MEAN: Record<string, string> = {
  auth: 'Cognito',
  authentication: 'Auth0',
  queue: 'SQS',
  cache: 'Redis',
  storage: 'S3',
  database: 'PostgreSQL',
  db: 'DynamoDB',
  function: 'AWS Lambda',
  lambda: 'AWS Lambda',
  cdn: 'CloudFront',
  monitoring: 'Datadog',
  logs: 'CloudWatch',
  gateway: 'API Gateway',
  balancer: 'Load Balancer',
  kafka: 'Kafka',
}

export const VALID_SERVICE_NAMES = SERVICES.map((s) => s.name).join(',')

export function findService(name: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.name === name)
}

export function servicesByCategory(category: string): ServiceDef[] {
  return SERVICES.filter((s) => s.category === category)
}
