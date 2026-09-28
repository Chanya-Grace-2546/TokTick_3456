import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { getPrisma } from "../src/prisma";

const E2E_PASSWORD = "E2eStrong!456";
const INITIAL_PASSWORD = "ChangeMe1!";

const accounts = [
  {
    name: "E2E Requester",
    email: "e2e.requester@toktickit.test",
    role: Role.REQUESTER,
    password: E2E_PASSWORD,
    mustChangePassword: false,
  },
  {
    name: "E2E Other Requester",
    email: "e2e.requester.other@toktickit.test",
    role: Role.REQUESTER,
    password: E2E_PASSWORD,
    mustChangePassword: false,
  },
  {
    name: "E2E IT Staff",
    email: "e2e.staff@toktickit.test",
    role: Role.IT_STAFF,
    password: E2E_PASSWORD,
    mustChangePassword: false,
  },
  {
    name: "E2E Administrator",
    email: "e2e.admin@toktickit.test",
    role: Role.ADMINISTRATOR,
    password: E2E_PASSWORD,
    mustChangePassword: false,
  },
  {
    name: "E2E Mandatory Change",
    email: "e2e.must-change@toktickit.test",
    role: Role.IT_STAFF,
    password: INITIAL_PASSWORD,
    mustChangePassword: true,
  },
] as const;

async function prepareAccount(
  account: (typeof accounts)[number]
) {
  const prisma = getPrisma();

  const passwordHash =
    await bcrypt.hash(
      account.password,
      12
    );

  const user =
    await prisma.user.upsert({
      where: {
        email: account.email,
      },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        isActive: true,
        mustChangePassword:
          account.mustChangePassword,
      },
      create: {
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
        isActive: true,
        mustChangePassword:
          account.mustChangePassword,
      },
      select: {
        id: true,
        email: true,
      },
    });

  await prisma.session.deleteMany({
    where: {
      userId: user.id,
    },
  });
}

async function main() {
  const resetMandatoryOnly =
    process.argv.includes(
      "--mandatory-only"
    );

  if (resetMandatoryOnly) {
    const mandatoryAccount =
      accounts.find(
        (account) =>
          account.email ===
          "e2e.must-change@toktickit.test"
      );

    if (!mandatoryAccount) {
      throw new Error(
        "Mandatory-change E2E account is not configured."
      );
    }

    await prepareAccount(
      mandatoryAccount
    );

    console.log(
      "Reset dedicated mandatory-change E2E user."
    );

    return;
  }

  for (const account of accounts) {
    await prepareAccount(account);
  }

  console.log(
    "Prepared dedicated Lab 3 E2E users."
  );
}

main()
  .catch((error) => {
    console.error(
      "Failed to prepare Lab 3 E2E users."
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });