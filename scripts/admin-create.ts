/**
 * npm run admin:create -- --email owner@example.com --name "Dr. Ratan Raghav" [--role owner|staff]
 *
 * Creates an admin account. The password is typed interactively (not echoed);
 * when no terminal is attached, a strong random password is generated and
 * printed once. No password is ever stored in the repository.
 */
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";

import { loadEnvConfig } from "@next/env";

import { createAdminUser, createAdminUserSchema } from "@/features/admin-users/service";
import { disconnectFromDatabase } from "@/lib/db/connection";
import { AppError } from "@/lib/errors";

loadEnvConfig(process.cwd());

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let prompted = false;
    output._writeToOutput = (s: string) => {
      if (!prompted) {
        output.output.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, role: { type: "string", default: "owner" } } });
  const input = createAdminUserSchema.parse({ email: values.email, name: values.name, role: values.role });

  let password: string | undefined;
  if (process.stdin.isTTY) {
    password = await askHidden("Password (12-128 characters): ");
    const confirm = await askHidden("Repeat password: ");
    if (password !== confirm) throw new Error("Passwords do not match.");
  }

  const { user, temporaryPassword } = await createAdminUser({ ...input, password, actor: "system" });
  console.log(`Created ${user.role} account for ${user.email}.`);
  if (temporaryPassword) console.log(`Generated password (shown once, store it safely): ${temporaryPassword}`);
}

main()
  .catch((error: unknown) => {
    const fields = error instanceof AppError && error.fields ? Object.entries(error.fields).map(([field, message]) => `\n  ${field}: ${message}`).join("") : "";
    console.error("Could not create the admin account:", error instanceof Error ? error.message : error, fields);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());
