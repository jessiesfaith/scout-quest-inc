"use client";

import { useState } from "react";
import { GUIDE_SECTIONS } from "@/lib/review-guide";

// Right-hand reviewer's manual. Collapsible on narrow screens so the
// report list keeps the room.
export function ReviewGuide() {
  const [open, setOpen] = useState(true);

  return (
    <aside className="zd-guide">
      <div className="card" style={{ padding: "15px 17px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <b style={{ fontSize: 13.5 }}>Reviewer&apos;s guide</b>
            <p className="note" style={{ margin: "3px 0 0", fontSize: 12 }}>
              How to read these reports, and what they do and don&apos;t
              cover.
            </p>
          </div>
          <button
            type="button"
            className="minibtn zd-toggle"
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>

        <div className={open ? "zd-guide-body" : "zd-guide-body zd-hidden"}>
          {GUIDE_SECTIONS.map((section) => (
            <section key={section.heading} style={{ marginTop: 18 }}>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  color: "var(--a)",
                }}
              >
                {section.heading}
              </h3>
              {section.intro && (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>
                  {section.intro}
                </p>
              )}
              {section.items && (
                <dl style={{ margin: 0 }}>
                  {section.items.map((item) => (
                    <div key={item.term} style={{ marginBottom: 9 }}>
                      <dt style={{ fontSize: 12, fontWeight: 700 }}>
                        {item.term}
                      </dt>
                      <dd
                        style={{
                          margin: "2px 0 0",
                          fontSize: 12,
                          color: "var(--muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        {item.text}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {section.body && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {section.body.map((line, i) => (
                    <li
                      key={i}
                      style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0" }}
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
