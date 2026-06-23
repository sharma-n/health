import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Menu } from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/app-shell/page-header";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const metadata: Metadata = { title: "Chat — Health" };

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <>
      <PageHeader
        title="AI Coach"
        description="Your personal fitness coach, powered by AI."
        action={
          <Link
            href="/more"
            aria-label="More"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" aria-hidden />
            More
          </Link>
        }
      />
      <ChatWindow userId={session.user.id} />
    </>
  );
}
