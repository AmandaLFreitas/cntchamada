import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function client(ctx: ToolContext) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_attendance",
  title: "Get attendance for a date",
  description:
    "Return attendance records for a specific date (YYYY-MM-DD). Optionally filter by student_id. Defaults to today.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("ISO date (YYYY-MM-DD). Defaults to today."),
    student_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, student_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const target = date ?? new Date().toISOString().slice(0, 10);
    let q = client(ctx)
      .from("attendance")
      .select("id, date, status, student_id, time_slot_id, is_justified, absence_note, students(name), time_slots(day_of_week, start_time, end_time)")
      .eq("date", target)
      .order("date", { ascending: false })
      .limit(500);
    if (student_id) q = q.eq("student_id", student_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { date: target, records: data ?? [] },
    };
  },
});
