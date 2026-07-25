import { cn } from "@/lib/utils";

/**
 * Cabeçalho padrão das páginas internas (Contatos, CRM, Automações...).
 * Altura fixa de 56px para alinhar com o header do chat.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2 md:px-4",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  );
}
