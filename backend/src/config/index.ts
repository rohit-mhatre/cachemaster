import * as dotenv from 'dotenv';

dotenv.config();

export type EvictionPolicy = 'LRU' | 'LFU' | 'FIFO';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  port: number;
  nodeEnv: string;
  evictionPolicy: EvictionPolicy;
  maxMemoryMB: number;
  maxKeys: number;
  cleanupIntervalMs: number;
  logLevel: LogLevel;
  enableCompression: boolean;
  rateLimitPerMinute: number;
  corsOrigins: string;
}

function getEnvAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEvictionPolicy(): EvictionPolicy {
  const policy = process.env.EVICTION_POLICY?.toUpperCase();
  if (policy === 'LRU' || policy === 'LFU' || policy === 'FIFO') {
    return policy;
  }
  return 'LRU';
}

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
    return level;
  }
  return 'info';
}

const config: Config = {
  port: getEnvAsNumber('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  evictionPolicy: getEvictionPolicy(),
  maxMemoryMB: getEnvAsNumber('MAX_MEMORY_MB', 512),
  maxKeys: getEnvAsNumber('MAX_KEYS', 100000),
  cleanupIntervalMs: getEnvAsNumber('CLEANUP_INTERVAL_MS', 60000),
  logLevel: getLogLevel(),
  enableCompression: getEnvAsBoolean('ENABLE_COMPRESSION', true),
  rateLimitPerMinute: getEnvAsNumber('RATE_LIMIT_PER_MINUTE', 100),
  corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:5173',
};

export default config;
