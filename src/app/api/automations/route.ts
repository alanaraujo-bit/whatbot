import { handle, parseBody, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { automationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const { workspaceId } = await requireAuth();

    const automations = await prisma.automation.findMany({
      where: { workspaceId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    return { automations };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const { workspaceId } = await requireAuth();
    const data = await parseBody(request, automationSchema);

    const automation = await prisma.automation.create({
      data: {
        workspaceId,
        name: data.name.trim(),
        trigger: data.trigger,
        keyword: data.trigger === "ANY_MESSAGE" ? null : (data.keyword?.trim() ?? null),
        response: data.response.trim(),
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        onlyFirstMessage: data.onlyFirstMessage ?? false,
      },
    });

    return { automation };
  });
}
