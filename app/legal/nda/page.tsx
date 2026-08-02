import type { Metadata } from "next";
import Link from "next/link";
import { NDA_VERSION } from "@/lib/constants";
import s from "../../landing.module.css";

// Text ported verbatim from the Scout Quest Education NDA (nda.html, v1).

export const metadata: Metadata = {
  title: "Non-Disclosure Agreement — Scout Quest Inc",
  robots: { index: false, follow: false },
};

export default function NdaPage() {
  return (
    <div className={s.legal}>
      <div className={s.legalWrap}>
        <Link href="/signup" className={s.legalBack}>
          ← Back to sign-up
        </Link>

        <h1>One-Way Non-Disclosure Agreement</h1>
        <div className={s.legalCo}>Scout Quest Education</div>
        <div className={s.legalMeta}>
          Version {NDA_VERSION} · Private preview · accepted electronically at
          sign-up
        </div>

        <p>
          This Non-Disclosure Agreement (the &ldquo;Agreement&rdquo;) is entered
          into as of the date you accept it below, by and between Scout Quest
          Education (&ldquo;Company&rdquo;), and you, the individual accepting
          it (&ldquo;Recipient&rdquo;). Company and Recipient are each a
          &ldquo;Party&rdquo; and together the &ldquo;Parties.&rdquo;
        </p>

        <p>
          <b>Purpose.</b> Recipient wishes to receive certain confidential
          information from Company in connection with evaluating a potential
          investment in, advisory relationship with, or product demonstration
          of Company&rsquo;s Scout Quest education platform (the
          &ldquo;Purpose&rdquo;).
        </p>

        <h3>1. Confidential Information</h3>
        <p>
          &ldquo;Confidential Information&rdquo; means any non-public
          information disclosed by or on behalf of Company to Recipient, in any
          form, relating to the Scout Quest Education platform, including the
          software, source code, features, user experience, designs, product
          roadmap, curriculum and educational content, business plans,
          financial information, metrics, pricing, customer and user data, and
          any information marked or identified as confidential or that a
          reasonable person would understand to be confidential given its
          nature or the circumstances of disclosure.
        </p>

        <h3>2. Obligations</h3>
        <p>
          Recipient shall: (a) hold all Confidential Information in strict
          confidence; (b) use it solely for the Purpose; (c) not copy, record,
          screenshot, screen-share, or otherwise reproduce any part of the
          platform or Confidential Information without Company&rsquo;s prior
          written consent; (d) not disclose it to any third party without
          Company&rsquo;s prior written consent; and (e) protect it using at
          least the same degree of care Recipient uses for its own confidential
          information, and no less than reasonable care.
        </p>

        <h3>3. Exclusions</h3>
        <p>
          Confidential Information does not include information that: (a) is or
          becomes publicly available through no breach by Recipient; (b) was
          rightfully known to Recipient before disclosure; (c) is rightfully
          received from a third party without a duty of confidentiality; or (d)
          is independently developed by Recipient without use of or reference
          to the Confidential Information.
        </p>

        <h3>4. Compelled Disclosure</h3>
        <p>
          If the Recipient is required by law or court order to disclose
          Confidential Information, the Recipient may do so only to the extent
          required, and shall, where legally permitted, give the Company prompt
          prior notice so the Company may seek a protective order.
        </p>

        <h3>5. No License or Ownership</h3>
        <p>
          All Confidential Information and all intellectual property rights in
          the Scout Quest platform remain the sole property of Company. Nothing
          in this Agreement grants Recipient any license or ownership right, by
          implication or otherwise.
        </p>

        <h3>6. No Obligation</h3>
        <p>
          Nothing in this Agreement obligates either Party to enter into any
          investment, advisory, business, or other transaction. Each Party may
          terminate discussions at any time.
        </p>

        <h3>7. No Warranty</h3>
        <p>
          All Confidential Information is provided &ldquo;AS IS&rdquo; for
          evaluation. The Company makes no warranties, express or implied,
          regarding its accuracy, completeness, or fitness for any purpose.
        </p>

        <h3>8. Term and Survival</h3>
        <p>
          This Agreement begins on the date above and continues while
          Confidential Information is disclosed. Recipient&rsquo;s
          confidentiality obligations survive for two (2) years after the last
          disclosure, except that Confidential Information constituting a trade
          secret remains protected for as long as it qualifies as a trade
          secret under applicable law.
        </p>

        <h3>9. Return or Destruction</h3>
        <p>
          Upon the Company&rsquo;s written request, the Recipient shall
          promptly return or destroy all Confidential Information in its
          possession and, if requested, certify such destruction in writing.
        </p>

        <h3>10. Remedies</h3>
        <p>
          Recipient acknowledges that unauthorized use or disclosure may cause
          irreparable harm for which monetary damages are inadequate. The
          Company is therefore entitled to seek injunctive relief, in addition
          to any other remedies available at law or in equity, without the
          requirement of posting a bond.
        </p>

        <h3>11. General</h3>
        <p>
          This Agreement is governed by the laws of the State of California,
          without regard to its conflict-of-laws rules. It constitutes the
          entire agreement between the Parties regarding its subject matter and
          supersedes all prior discussions. It may be amended only in writing
          signed by both Parties. If any provision is held unenforceable, the
          remaining provisions remain in effect. This Agreement may be signed
          in counterparts, including electronically.
        </p>

        <div className={s.legalAccept}>
          <h3>Electronic acceptance</h3>
          <p style={{ marginBottom: 0 }}>
            This Agreement is accepted electronically. By checking &ldquo;I
            have read and agree to the Non-Disclosure Agreement,&rdquo;
            confirming that the name you entered is your legal name, and
            creating your account, you sign this Agreement as the Recipient.
            Your first and last name, email address, this version number, and
            the date and time of acceptance are recorded as your electronic
            signature, which the Parties agree has the same legal effect as a
            handwritten signature and may be signed in counterparts.
          </p>
          <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "#8fa2b8" }}>
            <b style={{ color: "#dbe6f2" }}>Company:</b> Scout Quest Education
          </p>
        </div>

        <div className={s.legalFoot}>
          © 2026 Scout Quest Education. Questions:{" "}
          <a href="mailto:info@scoutquest.education">
            info@scoutquest.education
          </a>
          .
        </div>
      </div>
    </div>
  );
}
