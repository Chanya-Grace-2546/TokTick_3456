import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  const categoryNames = ["Account and Access", "Hardware", "Software", "Network"];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Lab 2 Issue 2 — Development Requesters (BR-05: at least four active,
  // at least one inactive). Upsert by email so re-running is idempotent.
  const requesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
    { name: "David Lee", email: "david.lee@example.com", isActive: true },
    { name: "Retired Requester", email: "retired.requester@example.com", isActive: false },
  ];

  for (const requester of requesters) {
    await prisma.developmentRequester.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    });
  }
  // Lab 2 Issue 3 — Related Systems (handout §5.3: at least six).
  // Upsert by name so re-running is idempotent.
  const relatedSystemNames = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  

  console.log("Seed complete: categories and development requesters.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });