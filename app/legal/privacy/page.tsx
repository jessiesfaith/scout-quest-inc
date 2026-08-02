import type { Metadata } from "next";
import Link from "next/link";
import s from "../../landing.module.css";

// Text ported verbatim from the Scout Quest Education privacy preview
// (privacy-preview.html).

export const metadata: Metadata = {
  title: "Privacy Preview — Scout Quest Inc",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className={s.legal}>
      <div className={s.legalWrap}>
        <Link href="/signup" className={s.legalBack}>
          ← Back to sign-up
        </Link>

        <h1>🪐 Privacy preview</h1>
        <div className={s.legalCo}>Scout Quest Education</div>
        <div className={s.legalMeta}>Private preview</div>

        <p>
          A short, plain-language note about how information is handled while
          Scout Quest Education is in private preview. This is not a final
          privacy policy.
        </p>

        <h3>What this is</h3>
        <ul>
          <li>
            Scout Quest Education is a <b>private-preview prototype</b> shown
            for feedback and demonstration only.
          </li>
          <li>
            The dashboards and learning activities use{" "}
            <b>fictional, simulated sample data</b> — not real students.
          </li>
          <li>
            <b>Please do not submit real student information</b> anywhere in
            this preview.
          </li>
        </ul>

        <h3>What a real pilot would require</h3>
        <p>
          If and when Scout Quest Education runs a real classroom or school
          pilot, that would be set up separately and would require, at minimum:
        </p>
        <ul>
          <li>Parent and/or school consent appropriate to the setting.</li>
          <li>A privacy and data-handling review.</li>
          <li>Written data-processing terms with the school or district.</li>
          <li>Appropriate protections for student information.</li>
        </ul>
        <p>None of those are claimed or in place during this private preview.</p>

        <div className={s.legalNote}>
          <b>Reminder:</b> this is a prototype for feedback. It is not
          certified or approved for use with real student records, and it makes
          no formal compliance promises yet.
        </div>

        <h3>Contact</h3>
        <p>
          Questions about the preview? Email{" "}
          <a href="mailto:info@scoutquest.education">
            info@scoutquest.education
          </a>
          .
        </p>

        <div className={s.legalFoot}>
          © 2026 Scout Quest Education. All rights reserved. Scout Quest
          Education, demo content, characters, UI, workflows, curriculum
          concepts, and prototype materials are owned by Scout Quest Education
          unless otherwise noted.
        </div>
      </div>
    </div>
  );
}
