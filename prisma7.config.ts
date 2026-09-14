import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const isTest = process.env.NODE_ENV === 'test';

config({
  path: isTest ? '.env.test' : '.env',
});

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
  },

  datasource: {
    url: isTest
      ? process.env['DATABASE_URL_TEST']
      : process.env['DATABASE_URL'],
  },
});