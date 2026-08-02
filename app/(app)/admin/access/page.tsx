import { redirect } from "next/navigation";

// The Stage 1.5 admin page is superseded by IT › Identity & Access.
export default function LegacyAccessRedirect() {
  redirect("/it/identity-access");
}
