import { Suspense } from "react";
import type { Metadata } from "next";

import { ContactsView } from "@/components/contacts/contacts-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Contatos" };

export default function ContactsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-4 h-40" />}>
      <ContactsView />
    </Suspense>
  );
}
