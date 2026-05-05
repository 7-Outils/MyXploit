import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { BillingPrefix, BillingFrequency } from "@/generated/prisma/client";

const PREFIXES: BillingPrefix[] = ["P1", "P2", "P3"];
const FREQUENCIES: BillingFrequency[] = ["MENSUEL", "TRIMESTRIEL", "SEMESTRIEL", "ANNUEL"];

async function assertContractAccess(contractId: string, effectiveOrgId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId: effectiveOrgId },
    select: { id: true },
  });
  return !!contract;
}

// GET /api/contracts/[id]/billing-schedules
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    if (!(await assertContractAccess(contractId, effectiveOrgId))) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const schedules = await prisma.billingSchedule.findMany({
      where: { contractId },
      include: { installments: { orderBy: { order: "asc" } } },
      orderBy: { prefix: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error("Error fetching billing schedules:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PUT /api/contracts/[id]/billing-schedules
// body: { prefix, frequency, startMonth, enabled, installments: [{ order, percentage }] }
// Upsert atomique (delete-then-create des installments pour rester simple).
// Si enabled=false, on persiste le schedule désactivé sans installments.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role === "READER") {
      return NextResponse.json({ error: "Lecture seule" }, { status: 403 });
    }
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);
    const { id: contractId } = await params;

    if (!(await assertContractAccess(contractId, effectiveOrgId))) {
      return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const prefix = body.prefix as BillingPrefix;
    const frequency = body.frequency as BillingFrequency;
    const startMonth = Number(body.startMonth);
    const enabled = body.enabled !== false;
    const installments = Array.isArray(body.installments) ? body.installments : [];

    if (!PREFIXES.includes(prefix)) {
      return NextResponse.json({ error: "Préfixe invalide" }, { status: 400 });
    }
    if (!FREQUENCIES.includes(frequency)) {
      return NextResponse.json({ error: "Fréquence invalide" }, { status: 400 });
    }
    if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
      return NextResponse.json({ error: "Mois de début invalide" }, { status: 400 });
    }

    if (enabled) {
      if (installments.length === 0) {
        return NextResponse.json({ error: "Au moins une échéance requise" }, { status: 400 });
      }
      const sum = installments.reduce(
        (s: number, it: { percentage: number }) => s + Number(it.percentage),
        0
      );
      if (Math.abs(sum - 100) > 0.01) {
        return NextResponse.json(
          { error: `Total des % = ${sum.toFixed(2)} (doit être 100)` },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const schedule = await tx.billingSchedule.upsert({
        where: { contractId_prefix: { contractId, prefix } },
        update: { frequency, startMonth, enabled },
        create: { contractId, prefix, frequency, startMonth, enabled },
      });
      await tx.billingInstallment.deleteMany({ where: { scheduleId: schedule.id } });
      if (enabled && installments.length > 0) {
        await tx.billingInstallment.createMany({
          data: installments.map(
            (it: { order: number; percentage: number }, idx: number) => ({
              scheduleId: schedule.id,
              order: Number(it.order ?? idx + 1),
              percentage: Number(it.percentage),
            })
          ),
        });
      }
      return tx.billingSchedule.findUnique({
        where: { id: schedule.id },
        include: { installments: { orderBy: { order: "asc" } } },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating billing schedule:", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
