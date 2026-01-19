import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "./prisma";

export async function getCurrentUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { organization: true },
  });

  return user;
}

export async function getOrCreateUser() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // 1. Chercher par clerkId (utilisateur déjà connecté)
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { organization: true },
  });

  if (user) {
    return user;
  }

  // 2. Obtenir les infos de Clerk
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return null;
  }

  // 3. Chercher par email (invitation en attente - sans clerkId)
  const pendingUser = await prisma.user.findFirst({
    where: { email },
    include: { organization: true },
  });

  if (pendingUser) {
    // Lier le compte Clerk à l'utilisateur pré-créé
    user = await prisma.user.update({
      where: { id: pendingUser.id },
      data: {
        clerkId: userId,
        firstName: clerkUser.firstName || pendingUser.firstName,
        lastName: clerkUser.lastName || pendingUser.lastName,
      },
      include: { organization: true },
    });
    return user;
  }

  // 4. Nouvel utilisateur: créer organisation + compte
  const org = await prisma.organization.create({
    data: {
      name: `${clerkUser.firstName || "Mon"} Organisation`,
      slug: `org-${userId.slice(0, 8)}`,
    },
  });

  user = await prisma.user.create({
    data: {
      clerkId: userId,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      role: "ADMIN",
      organizationId: org.id,
    },
    include: { organization: true },
  });

  return user;
}

export async function requireAuth() {
  const user = await getOrCreateUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
