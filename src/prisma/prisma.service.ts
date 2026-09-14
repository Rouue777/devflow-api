import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString =
      process.env.NODE_ENV === 'test'
        ? process.env.DATABASE_URL_TEST
        : process.env.DATABASE_URL;

    const adapter = new PrismaPg({
      connectionString: connectionString!,
    });

    super({
      adapter,
    });
  }
}