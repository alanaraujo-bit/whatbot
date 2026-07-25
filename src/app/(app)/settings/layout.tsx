import type { Metadata } from "next";

import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsNav />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl p-3 md:p-4">{children}</div>
      </div>
    </div>
  );
}
