import prisma from "../src/lib/prisma";

async function check() {
  try {
    const count = await prisma.consumption.count();
    console.log("Total consumptions:", count);

    if (count > 0) {
      const consumptions = await prisma.consumption.findMany({
        take: 10,
        orderBy: { period: "desc" },
        include: { site: { select: { name: true } } }
      });

      for (const c of consumptions) {
        const date = c.period.toISOString().slice(0, 10);
        console.log(`${c.site.name} | ${c.energyType} | ${c.usage} | ${date} | ${c.quantity} ${c.unit}`);
      }
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
