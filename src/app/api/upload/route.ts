import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { requireAuth, getEffectiveOrganizationId } from "@/lib/auth";
import { randomUUID } from "crypto";
import sharp from "sharp";

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Types redimensionnés à l'upload. Le GIF en est exclu : sharp ne garderait
// pas l'animation dans une conversion simple, on préfère l'original.
const RESIZABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Les vignettes du parc font 128 px et les visionneuses restent en pleine page :
// au-delà de 1600 px de large, on ne stocke que du poids inutile.
const MAX_WIDTH = 1600;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const effectiveOrgId = await getEffectiveOrganizationId(user.id, user.organizationId);

    if (user.role === "READER") {
      return NextResponse.json(
        { error: "Vous n'avez pas les droits pour uploader des images" },
        { status: 403 }
      );
    }

    // Check if R2 is configured
    if (!process.env.R2_ACCOUNT_ID) {
      return NextResponse.json(
        { error: "Le stockage d'images n'est pas configuré" },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "equipments";

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Utilisez JPEG, PNG, WebP ou GIF." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier est trop volumineux. Taille maximale: 10MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    let extension = file.name.split(".").pop() || "jpg";
    let contentType = file.type;

    // Redimensionnement + WebP : une photo de chaufferie sort du téléphone à
    // plusieurs Mo pour finir dans une vignette. On la ramène à une taille
    // raisonnable avant de payer le stockage et la bande passante.
    if (RESIZABLE_TYPES.includes(file.type)) {
      try {
        buffer = await sharp(buffer)
          .rotate() // respecte l'orientation EXIF, perdue à la conversion
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        extension = "webp";
        contentType = "image/webp";
      } catch (resizeError) {
        // Un échec de redimensionnement ne doit jamais coûter la photo :
        // on repart de l'original, tel qu'avant.
        console.error("Image resize failed, uploading original:", resizeError);
        buffer = Buffer.from(arrayBuffer);
      }
    }

    // Generate unique filename
    // Orga effective (et non celle du compte) : en session déléguée, le fichier
    // doit se ranger dans le dossier de l'orga consultée.
    const filename = `${folder}/${effectiveOrgId}/${randomUUID()}.${extension}`;

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        // Clés uniques (uuid) : cache navigateur immuable, fini les rechargements
        CacheControl: "public, max-age=31536000, immutable",
        ContentType: contentType,
      })
    );

    // Build public URL
    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${filename}`
      : `https://${R2_BUCKET_NAME}.r2.dev/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload du fichier" },
      { status: 500 }
    );
  }
}
