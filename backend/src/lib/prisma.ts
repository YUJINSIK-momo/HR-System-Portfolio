import { PrismaClient, Prisma } from '../../../node_modules/.prisma/client/index';

const prisma: PrismaClient = new PrismaClient();

export default prisma;
export { Prisma };
