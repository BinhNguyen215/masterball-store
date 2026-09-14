import { z } from "zod";
import { closeDb } from "../src/db";
import { createAuth } from "../src/modules/auth/auth-factory";

const inputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(14).max(128),
  name: z.string().trim().min(2).max(120),
});

async function main() {
  const input = inputSchema.parse({
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
    name: process.env.OWNER_NAME,
  });

  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET || !process.env.BETTER_AUTH_URL) {
    throw new Error("DATABASE_URL, BETTER_AUTH_SECRET, and BETTER_AUTH_URL are required.");
  }

  const bootstrapAuth = createAuth({
    bootstrap: true,
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
  });
  await bootstrapAuth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });

  process.stdout.write("Owner account created. Remove OWNER_* values from the environment now.\n");
}

main()
  .catch(() => {
    process.stderr.write("Owner bootstrap failed. No credentials were logged.\n");
    process.exitCode = 1;
  })
  .finally(closeDb);
