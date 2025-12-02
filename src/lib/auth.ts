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

  // Check if user exists
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { organization: true },
  });

  if (!user) {
    // Get user info from Clerk
    const clerkUser = await currentUser();

    if (!clerkUser) {
      return null;
    }

    // Create default organization for new user
    const org = await prisma.organization.create({
      data: {
        name: `${clerkUser.firstName || "Mon"} Organisation`,
        slug: `org-${userId.slice(0, 8)}`,
      },
    });

    // Create user linked to organization
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        role: "ADMIN",
        organizationId: org.id,
      },
      include: { organization: true },
    });
  }

  return user;
}

export async function requireAuth() {
  const user = await getOrCreateUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
