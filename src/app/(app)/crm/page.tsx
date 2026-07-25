import type { Metadata } from "next";

import { CrmBoard } from "@/components/crm/crm-board";

export const metadata: Metadata = { title: "CRM" };

export default function CrmPage() {
  return <CrmBoard />;
}
