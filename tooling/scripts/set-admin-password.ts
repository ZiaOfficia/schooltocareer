#!/usr/bin/env tsx
/**
 * Sets a real password on an existing staff account.
 *
 *   pnpm admin:set-password                 # list accounts, then prompt
 *   pnpm admin:set-password <email>         # prompt for that account
 *
 * WHY A SCRIPT AND NOT A SEED VALUE. The seeded admin carries
 * `SEED_PLACEHOLDER_NOT_A_VALID_HASH` on purpose — its own comment says the row
 * exists so authored content has an author, "not so anyone can sign in with
 * it". Putting a real password in the seed would commit a credential to git and
 * ship the same one to every environment. That placeholder stays invalid; this
 * writes a proper hash beside it.
 *
 * HOW THE PASSWORD IS READ, and why it matters:
 *
 *   - NOT from argv. `pnpm admin:set-password hunter2` would sit in shell
 *     history, in `ps` output for every user on the box, and in any CI log.
 *   - NOT from an environment variable, for the same reason plus `/proc`.
 *   - From the TTY with echo OFF, so it never appears on screen either.
 *
 * Only the scrypt hash is written. The plaintext exists in one string in this
 * process and is never logged, returned or stored.
 *
 * This creates no HTTP surface. There is no password-reset route, by design —
 * see apps/api/src/modules/auth/auth.service.ts.
 */
import { createInterface } from 'node:readline';

import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../../apps/api/src/modules/auth/auth.password.js';
import { AuthRepository } from '../../apps/api/src/modules/auth/auth.repository.js';

import { readSecret } from './lib/read-secret.js';

const prisma = new PrismaClient();

/** Minimum length, matching `passwordSchema` in @stc/validation. */
const MIN_LENGTH = 12;


function ask(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const repository = new AuthRepository(prisma);
  const staff = await repository.listStaff();

  if (staff.length === 0) {
    console.error('\nNo user rows exist. Run `pnpm db:seed` first.\n');
    process.exitCode = 1;
    return;
  }

  console.log('\nStaff accounts:\n');
  for (const person of staff) {
    console.log(
      `  ${person.email.padEnd(34)} ${person.role.padEnd(7)} ${person.status.padEnd(12)} ` +
        `${person.hasPassword ? 'password set' : 'NO USABLE PASSWORD'}`,
    );
  }
  console.log('');

  const email = (process.argv[2] ?? (await ask('Account email: '))).trim().toLowerCase();
  if (!email) {
    console.error('No email given.\n');
    process.exitCode = 1;
    return;
  }

  const target = staff.find((person) => person.email.toLowerCase() === email);
  if (!target) {
    console.error(`No account with email "${email}".\n`);
    process.exitCode = 1;
    return;
  }

  // Loud, because this is how an approval gets attributed to a real person.
  console.log(
    `\nSetting the password for ${target.name} <${target.email}> (${target.role}).\n` +
      'Approvals made with this account are recorded against it permanently.\n',
  );

  const password = await readSecret(`New password (min ${MIN_LENGTH} chars, not shown): `);
  if (password.length < MIN_LENGTH) {
    console.error(`\nToo short — ${MIN_LENGTH} characters minimum.\n`);
    process.exitCode = 1;
    return;
  }
  if (password !== password.trim()) {
    console.error('\nCannot start or end with a space.\n');
    process.exitCode = 1;
    return;
  }

  const confirm = await readSecret('Confirm password (not shown):                  ');
  if (password !== confirm) {
    console.error('\nPasswords do not match. Nothing was changed.\n');
    process.exitCode = 1;
    return;
  }

  const updated = await repository.setPasswordHash(email, await hashPassword(password));
  if (!updated) {
    console.error('\nAccount disappeared between listing and update. Nothing was changed.\n');
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nPassword set for ${updated.email}.\n\n` +
      'Sign in:\n' +
      '  curl -s -X POST http://localhost:4000/api/v1/auth/login \\\n' +
      "    -H 'Content-Type: application/json' \\\n" +
      `    -d '{"email":"${updated.email}","password":"<the password>"}'\n\n` +
      'Confirm the token carries fact:approve BEFORE using it:\n' +
      "  curl -s http://localhost:4000/api/v1/auth/me -H 'Authorization: Bearer <token>'\n",
  );
}

main()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
