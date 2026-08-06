import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { randomUUID } from "crypto";

/**
 * POST /api/work-orders/[id]/attachements
 * Upload un attachement (photo, PDF, document) pour un WorkOrder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    // Seuls EDITOR, ADMIN et SUPER_ADMIN peuvent uploader
    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Permission refusée" },
        { status: 403 }
      );
    }

    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { id } = await params;

    // Vérifier que le WorkOrder existe et appartient à l'organisation
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id,
        quote: {
          organizationId: effectiveOrgId,
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: "WorkOrder introuvable" },
        { status: 404 }
      );
    }

    // Ne pas permettre l'upload si WorkOrder clôturé
    if (workOrder.status === "CLOTURE") {
      return NextResponse.json(
        { error: "Impossible d'ajouter des attachements à un WorkOrder clôturé" },
        { status: 400 }
      );
    }

    // Parser le form-data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const description = formData.get("description") as string;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Valider la taille du fichier (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 10MB)" },
        { status: 400 }
      );
    }

    // Déterminer le type d'attachement selon l'extension
    let attachementType = type || "DOCUMENT";
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") || fileName.endsWith(".png") || fileName.endsWith(".gif")) {
      attachementType = "PHOTO";
    } else if (fileName.endsWith(".pdf")) {
      attachementType = "PDF";
    }

    // Le système de fichiers est en lecture seule sur Vercel : le stockage passe
    // par R2, comme /api/upload.
    if (!process.env.R2_ACCOUNT_ID) {
      return NextResponse.json(
        { error: "Le stockage de fichiers n'est pas configuré" },
        { status: 503 }
      );
    }

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `work-attachements/${effectiveOrgId}/${id}/${randomUUID()}-${sanitizedFileName}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    const fileUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${key}`
      : `https://${R2_BUCKET_NAME}.r2.dev/${key}`;

    // Créer l'enregistrement dans la DB
    const attachement = await prisma.workAttachement.create({
      data: {
        workOrderId: id,
        type: attachementType as any,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        description: description || null,
        uploadedBy: user.id,
      },
    });

    // Créer un événement dans l'historique
    await prisma.workEvent.create({
      data: {
        workOrderId: id,
        eventType: "ATTACHEMENT_ADDED",
        newValue: JSON.stringify({ fileName: file.name, type: attachementType }),
        performedBy: user.id,
        notes: `Attachement ajouté: ${file.name}`,
      },
    });

    // Si le WorkOrder est TERMINE et c'est le premier attachement,
    // passer automatiquement à ATTENTE_ATTACHEMENT
    if (workOrder.status === "TERMINE") {
      const attachementCount = await prisma.workAttachement.count({
        where: { workOrderId: id },
      });

      if (attachementCount === 1) {
        // C'est le premier attachement
        await prisma.workOrder.update({
          where: { id: id },
          data: { status: "ATTENTE_ATTACHEMENT" },
        });

        await prisma.workEvent.create({
          data: {
            workOrderId: id,
            eventType: "STATUS_CHANGE",
            oldValue: "TERMINE",
            newValue: "ATTENTE_ATTACHEMENT",
            performedBy: "system",
            notes: "Transition automatique après upload du premier attachement",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      attachement,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/work-orders/[id]/attachements error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de l'attachement" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/work-orders/[id]/attachements
 * Supprime un attachement
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    // Seuls ADMIN et SUPER_ADMIN peuvent supprimer des attachements
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Permission refusée. Seuls les ADMIN peuvent supprimer des attachements." },
        { status: 403 }
      );
    }

    const effectiveOrgId = await getEffectiveOrganizationId(
      user.id,
      user.organizationId
    );

    const { searchParams } = new URL(request.url);
    const attachementId = searchParams.get("attachementId");

    if (!attachementId) {
      return NextResponse.json(
        { error: "attachementId requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'attachement existe et appartient à ce WorkOrder
    const attachement = await prisma.workAttachement.findFirst({
      where: {
        id: attachementId,
        workOrderId: id,
        workOrder: {
          quote: {
            organizationId: effectiveOrgId,
          },
        },
      },
    });

    if (!attachement) {
      return NextResponse.json(
        { error: "Attachement introuvable" },
        { status: 404 }
      );
    }

    // Supprimer l'enregistrement DB (le fichier physique peut rester pour archivage)
    await prisma.workAttachement.delete({
      where: { id: attachementId },
    });

    // Créer un événement
    await prisma.workEvent.create({
      data: {
        workOrderId: id,
        eventType: "ATTACHEMENT_REMOVED",
        oldValue: JSON.stringify({ fileName: attachement.fileName }),
        performedBy: user.id,
        notes: `Attachement supprimé: ${attachement.fileName}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Attachement supprimé",
    });
  } catch (error) {
    console.error("DELETE /api/work-orders/[id]/attachements error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'attachement" },
      { status: 500 }
    );
  }
}
