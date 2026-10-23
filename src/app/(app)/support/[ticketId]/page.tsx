"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Frame, Page } from "@/components/ui/frame";
import { TicketConversation } from "@/components/support/ticket-conversation";

export default function TicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  return (
    <Page>
      <div className="mb-3">
        <Link
          href="/support"
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink hover:underline"
        >
          <ArrowLeft size={13} /> Tickets
        </Link>
      </div>
      <Frame>
        <TicketConversation ticketId={ticketId} />
      </Frame>
    </Page>
  );
}
