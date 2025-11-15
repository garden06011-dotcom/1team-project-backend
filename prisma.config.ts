import { defineConfig, env } from "prisma/config";

//아래의 2줄을 추가 하세요.
import dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
