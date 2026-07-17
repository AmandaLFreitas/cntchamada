import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function client(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_birthdays",
  title: "List birthdays for a month",
  description: "List students whose birthday falls in the given month (1-12). Defaults to the current month.",
  inputSchema: {
    month: z.number().int().min(1).max(12).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const m = month ?? new Date().getMonth() + 1;
    const { data, error } = await client(ctx)
      .from("students")
      .select("id, name, birth_date, school_id")
      .not("birth_date", "is", null)
      .limit(1000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const filtered = (data ?? [])
      .filter((s: any) => {
        const bd = s.birth_date ? new Date(s.birth_date) : null;
        return bd && bd.getUTCMonth() + 1 === m;
      })
      .sort((a: any, b: any) => new Date(a.birth_date).getUTCDate() - new Date(b.birth_date).getUTCDate());
    return {
      content: [{ type: "text", text: JSON.stringify(filtered) }],
      structuredContent: { month: m, students: filtered },
    };
  },
});
