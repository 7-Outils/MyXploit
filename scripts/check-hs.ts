import prisma from "../src/lib/prisma";

async function main() {
  const hs = await prisma.heatingSeason.findMany({
    include: { site: { select: { name: true } } },
  });
  for (const h of hs) {
    console.log(`${h.site.name} | season=${h.season} | start=${h.startDate?.toISOString() ?? "NULL"} | end=${h.endDate?.toISOString() ?? "NULL"} | nb=${h.nb}`);
  }
  console.log(`\nTotal: ${hs.length} records`);
  await prisma.$disconnect();
}
main().catch(console.error);
