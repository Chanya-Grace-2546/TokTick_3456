import { PrismaClient } from '@prisma/client';
export function verifyE2ETarget(prisma: Pick<PrismaClient, "$queryRaw">, env?: NodeJS.ProcessEnv): Promise<{database:string;schema:string|null;role:string}>;
