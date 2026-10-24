import { Prisma, PrismaClient } from '@prisma/client';
export const TEST_DATABASE: string;
export function explicitTestUrl(source?: string): URL;
export function testRunId(value?: string): string;
export function databaseIdentity(prisma: PrismaClient | Prisma.TransactionClient): Promise<{ database: string; schema: string | null; role: string }>;
export function inspectTestRole(prisma: PrismaClient): Promise<{ database: string; superuser: boolean; limitations: string[] }>;
export class DisposableDatabase {
  constructor(prefix: string, source?: string);
  readonly schema: string;
  readonly runId: string;
  readonly marker: string;
  readonly url: URL;
  readonly prisma: PrismaClient;
  create(): Promise<unknown>;
  verify(prisma?: PrismaClient | Prisma.TransactionClient): Promise<unknown>;
  drop(): Promise<void>;
  dispose(): Promise<void>;
  dropForRecovery(): Promise<void>;
  registerRestored(): Promise<void>;
}
export function verifyCurrentTestDatabase(prisma: PrismaClient): Promise<unknown>;
export function subprocessEnvironment(handle: DisposableDatabase): NodeJS.ProcessEnv;
export function postgresEnvironment(handle: DisposableDatabase): NodeJS.ProcessEnv & { PGDATABASE: string };
export function verifyArchiveEntries(entries: string[], schema: string): void;
export function verifiedSqlObject(prisma: PrismaClient, name: string): Promise<string>;
