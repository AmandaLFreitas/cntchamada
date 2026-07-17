import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listStudents from "./tools/list-students";
import getAttendance from "./tools/get-attendance";
import listBirthdays from "./tools/list-birthdays";

// Direct Supabase issuer required by mcp-js — never the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cnt-informatica-mcp",
  title: "CNT Informática",
  version: "0.1.0",
  instructions:
    "Read-only tools for the CNT Informática school management system. Use list_students to look up students, get_attendance to inspect attendance for a given day, and list_birthdays for a monthly birthday list. All access respects the caller's school and role permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listStudents, getAttendance, listBirthdays],
});
