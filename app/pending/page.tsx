import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import s from "../landing.module.css";

export const metadata = {
  title: "Awaiting access — Scout Quest Inc",
};

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <div className={s.page}>
      <section className={s.login} style={{ minHeight: "100vh" }}>
        <div className={s.wrap}>
          <h2>You&apos;re in — a role is on its way</h2>
          <p>
            A role will be assigned to your account soon so you can access the
            platform.
          </p>
          <div className={s.loginBox} style={{ textAlign: "center" }}>
            <p style={{ margin: 0, color: "#dbe6f2", fontSize: 14 }}>
              Signed in as <b>{user.email}</b>. Once a role is assigned,{" "}
              <Link href="/dashboard" style={{ color: "var(--teal)" }}>
                try again
              </Link>
              .
            </p>
            <form action="/auth/signout" method="post" style={{ marginTop: 14 }}>
              <button
                type="submit"
                className={s.note}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
