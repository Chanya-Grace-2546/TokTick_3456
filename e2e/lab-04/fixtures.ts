export async function prepareFixtures(database: any) {
  await database.verify();
  const prisma=database.prisma;
  for(const name of ['Account and Access','Hardware','Software','Network'])await prisma.category.create({data:{name}});
  for(const name of ['Email','Campus Wi-Fi','VPN','LEB2 App','Grade Submission App','Printer','Corporate Laptop'])await prisma.relatedSystem.create({data:{name}});
  const requester=await prisma.user.create({data:{name:'Isolated baseline Requester',email:'baseline@e2e.test',role:'REQUESTER',passwordHash:'not-a-login-password',mustChangePassword:false}});
  const category=await prisma.category.findFirstOrThrow(),system=await prisma.relatedSystem.findFirstOrThrow();
  const statuses=['NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','RESOLVED','CLOSED','REOPENED','CANCELLED'];
  await database.verify();
  await prisma.ticket.createMany({data:Array.from({length:16},(_,i)=>({ticketNumber:`BASE-${i}`,requesterId:requester.id,categoryId:category.id,relatedSystemId:system.id,summary:`Baseline ${i}`,description:'Isolated regression fixture',requestedPriority:'MEDIUM',itPriority:i%2?'HIGH':'LOW',status:statuses[i%8]}))});
}
