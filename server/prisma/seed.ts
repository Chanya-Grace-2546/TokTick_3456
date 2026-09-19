import bcrypt from "bcryptjs";
import {
  Priority,
  Role,
  TicketStatus,
} from "@prisma/client";
import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  // -------------------------------------------------------------------------
  // Lab 3 local-development initial password
  //
  // This plaintext value exists only in seed source for local testing.
  // Only the bcrypt hash is persisted in PostgreSQL.
  // -------------------------------------------------------------------------

  const initialPassword = "ChangeMe1!";
  const passwordHash = await bcrypt.hash(initialPassword, 12);

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  const categoryNames = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: {
        name,
        isActive: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Related Systems
  // -------------------------------------------------------------------------

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
      update: { isActive: true },
      create: {
        name,
        isActive: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Users
  //
  // Lab 3 handout seed requirements:
  // - at least 4 active Requesters
  // - at least 1 inactive Requester
  // - at least 3 active IT Staff
  // - at least 1 inactive IT Staff
  // - at least 1 active Administrator
  //
  // Existing Lab 2 Requester emails are intentionally preserved.
  // -------------------------------------------------------------------------

  const users = [
    // Existing Lab 2 Requesters
    {
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: Role.REQUESTER,
      isActive: true,
    },
    {
      name: "Michael Brown",
      email: "michael.brown@example.com",
      role: Role.REQUESTER,
      isActive: true,
    },
    {
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      role: Role.REQUESTER,
      isActive: true,
    },
    {
      name: "David Lee",
      email: "david.lee@example.com",
      role: Role.REQUESTER,
      isActive: true,
    },
    {
      name: "Retired Requester",
      email: "retired.requester@example.com",
      role: Role.REQUESTER,
      isActive: false,
    },

    // IT Staff
    {
      name: "Alex Morgan",
      email: "alex.morgan@toktickit.local",
      role: Role.IT_STAFF,
      isActive: true,
    },
    {
      name: "Priya Shah",
      email: "priya.shah@toktickit.local",
      role: Role.IT_STAFF,
      isActive: true,
    },
    {
      name: "Daniel Kim",
      email: "daniel.kim@toktickit.local",
      role: Role.IT_STAFF,
      isActive: true,
    },
    {
      name: "Inactive IT Staff",
      email: "inactive.staff@toktickit.local",
      role: Role.IT_STAFF,
      isActive: false,
    },

    // Administrator
    {
      name: "System Administrator",
      email: "admin@toktickit.local",
      role: Role.ADMINISTRATOR,
      isActive: true,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: true,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Load seeded reference records
  // -------------------------------------------------------------------------

  const jennifer = await prisma.user.findUniqueOrThrow({
    where: { email: "jennifer.anderson@example.com" },
  });

  const michael = await prisma.user.findUniqueOrThrow({
    where: { email: "michael.brown@example.com" },
  });

  const sarah = await prisma.user.findUniqueOrThrow({
    where: { email: "sarah.johnson@example.com" },
  });

  const david = await prisma.user.findUniqueOrThrow({
    where: { email: "david.lee@example.com" },
  });

  const alex = await prisma.user.findUniqueOrThrow({
    where: { email: "alex.morgan@toktickit.local" },
  });

  const priya = await prisma.user.findUniqueOrThrow({
    where: { email: "priya.shah@toktickit.local" },
  });

  const daniel = await prisma.user.findUniqueOrThrow({
    where: { email: "daniel.kim@toktickit.local" },
  });

  const accountCategory = await prisma.category.findUniqueOrThrow({
    where: { name: "Account and Access" },
  });

  const hardwareCategory = await prisma.category.findUniqueOrThrow({
    where: { name: "Hardware" },
  });

  const softwareCategory = await prisma.category.findUniqueOrThrow({
    where: { name: "Software" },
  });

  const networkCategory = await prisma.category.findUniqueOrThrow({
    where: { name: "Network" },
  });

  const emailSystem = await prisma.relatedSystem.findUniqueOrThrow({
    where: { name: "Email" },
  });

  const wifiSystem = await prisma.relatedSystem.findUniqueOrThrow({
    where: { name: "Campus Wi-Fi" },
  });

  const vpnSystem = await prisma.relatedSystem.findUniqueOrThrow({
    where: { name: "VPN" },
  });

  const laptopSystem = await prisma.relatedSystem.findUniqueOrThrow({
    where: { name: "Corporate Laptop" },
  });

  // -------------------------------------------------------------------------
  // Representative Lab 3 Tickets
  //
  // Upsert by ticketNumber so seed remains idempotent.
  //
  // These four initial development tickets use the same official
  // TKT-YYYY-NNNNNN format as application-created tickets. On a clean
  // seeded database they occupy sequences 000001 through 000004, so the
  // existing COUNT-based generator continues with 000005.
  // -------------------------------------------------------------------------

  const ticket1 = await prisma.ticket.upsert({
    where: {
      ticketNumber: "TKT-2026-000001",
    },
    // Preserve any existing historical/submitted Ticket with this number.
    update: {},
    create: {
      ticketNumber: "TKT-2026-000001",
      requesterId: jennifer.id,
      ownerId: alex.id,
      categoryId: accountCategory.id,
      relatedSystemId: emailSystem.id,
      summary: "Unable to access university email",
      description:
        "Requester receives an authentication error when opening university email.",
      requestedPriority: Priority.HIGH,
      itPriority: Priority.HIGH,
      status: TicketStatus.IN_PROGRESS,
    },
  });

  const ticket2 = await prisma.ticket.upsert({
    where: {
      ticketNumber: "TKT-2026-000002",
    },
    // Preserve any existing historical/submitted Ticket with this number.
    update: {},
    create: {
      ticketNumber: "TKT-2026-000002",
      requesterId: michael.id,
      ownerId: null,
      categoryId: networkCategory.id,
      relatedSystemId: wifiSystem.id,
      summary: "Campus Wi-Fi disconnects frequently",
      description:
        "Wi-Fi disconnects several times while the requester is working on campus.",
      requestedPriority: Priority.MEDIUM,
      itPriority: Priority.MEDIUM,
      status: TicketStatus.NEW,
    },
  });

  const ticket3 = await prisma.ticket.upsert({
    where: {
      ticketNumber: "TKT-2026-000003",
    },
    // Preserve any existing historical/submitted Ticket with this number.
    update: {},
    create: {
      ticketNumber: "TKT-2026-000003",
      requesterId: sarah.id,
      ownerId: priya.id,
      categoryId: softwareCategory.id,
      relatedSystemId: vpnSystem.id,
      summary: "VPN connection fails off campus",
      description:
        "Requester cannot establish a VPN connection from an off-campus network.",
      requestedPriority: Priority.HIGH,
      itPriority: Priority.HIGH,
      status: TicketStatus.WAITING_FOR_REQUESTER,
    },
  });

  const ticket4 = await prisma.ticket.upsert({
    where: {
      ticketNumber: "TKT-2026-000004",
    },
    // Preserve any existing historical/submitted Ticket with this number.
    update: {},
    create: {
      ticketNumber: "TKT-2026-000004",
      requesterId: david.id,
      ownerId: daniel.id,
      categoryId: hardwareCategory.id,
      relatedSystemId: laptopSystem.id,
      summary: "Laptop battery drains quickly",
      description:
        "The assigned laptop loses most of its charge within a short period of normal use.",
      requestedPriority: Priority.LOW,
      itPriority: Priority.MEDIUM,
      status: TicketStatus.RESOLVED,
    },
  });

  // -------------------------------------------------------------------------
  // Public Comments
  //
  // PublicComment has no natural unique key. findFirst + create keeps the
  // seed idempotent without inventing a production uniqueness rule.
  // -------------------------------------------------------------------------

  const publicCommentSeeds = [
    {
      ticketId: ticket1.id,
      authorId: jennifer.id,
      content:
        "I still receive the same authentication error after restarting my browser.",
    },
    {
      ticketId: ticket1.id,
      authorId: alex.id,
      content:
        "Thanks. I am checking the account access configuration now.",
    },
    {
      ticketId: ticket3.id,
      authorId: priya.id,
      content:
        "Please try the VPN again and let us know whether the new configuration works.",
    },
  ];

  for (const comment of publicCommentSeeds) {
    const existing = await prisma.publicComment.findFirst({
      where: comment,
    });

    if (!existing) {
      await prisma.publicComment.create({
        data: comment,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Internal Notes
  // -------------------------------------------------------------------------

  const internalNoteSeeds = [
    {
      ticketId: ticket1.id,
      authorId: alex.id,
      content:
        "Checked the test account configuration. Continue troubleshooting authentication settings.",
    },
    {
      ticketId: ticket3.id,
      authorId: priya.id,
      content:
        "Waiting for requester confirmation after applying the test VPN configuration.",
    },
  ];

  for (const note of internalNoteSeeds) {
    const existing = await prisma.internalNote.findFirst({
      where: note,
    });

    if (!existing) {
      await prisma.internalNote.create({
        data: note,
      });
    }
  }

  console.log("Lab 3 seed complete.");
  console.log("");
  console.log("All seeded users require a password change at first login.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
