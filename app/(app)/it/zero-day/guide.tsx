"use client";

import { useState } from "react";
import { GUIDE_SECTIONS } from "@/lib/review-guide";

// Right-hand reviewer's manual. Collapsible on narrow screens so the
// report list keeps the room.
export function ReviewGuide() {
  const [open, setOpen] = useState(true);

  return (
    <aside className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Reviewer&apos;s guide</h2>
            <p className="mt-1 text-xs text-muted">
              How to read these reports, and what they do and don&apos;t
              cover.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="shrink-0 text-xs text-accent lg:hidden"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>

        <div className={`${open ? "block" : "hidden"} lg:block`}>
          {GUIDE_SECTIONS.map((section) => (
            <section key={section.heading} className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                {section.heading}
              </h3>
              {section.intro && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {section.intro}
                </p>
              )}
              {section.items && (
                <dl className="mt-3 space-y-3">
                  {section.items.map((item) => (
                    <div key={item.term}>
                      <dt className="text-xs font-semibold text-foreground">
                        {item.term}
                      </dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-muted">
                        {item.text}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {section.body && (
                <ul className="mt-2 space-y-1.5 pl-4">
                  {section.body.map((line, i) => (
                    <li
                      key={i}
                      className="list-disc text-xs leading-relaxed text-muted"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
