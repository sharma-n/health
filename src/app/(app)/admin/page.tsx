import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { UserAdminCard } from "@/components/admin/user-admin-card";
import { formatDateOnly } from "@/lib/dates";

export const metadata: Metadata = { title: "Admin — Health" };

export default async function AdminPage() {
  // Defense in depth: the proxy route-guard already gates /admin on the JWT, but
  // re-check here against the live session (and the server actions re-check the
  // DB). Non-admins are bounced rather than shown an empty shell.
  const session = await auth();
  if (!session?.user?.isAdmin) {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      isAdmin: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Manage the user accounts on this server."
      />
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id}>
            <UserAdminCard
              user={{
                id: u.id,
                email: u.email,
                displayName: u.displayName,
                isAdmin: u.isAdmin,
                createdAtLabel: formatDateOnly(u.createdAt),
              }}
              isSelf={u.id === session.user.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
