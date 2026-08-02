// Scout Quest Inc — login wiring for the hand-built index.html.
// Served alongside the page by app/route.ts; the page itself is never
// modified. Contract: this script finds Jessica's existing elements by id —
//   sign in:  form #lg-signin, inputs #em, #pw
//   request:  form #lg-create, inputs #cname, #cemail, checkboxes #cnda, #cpriv
//   reset:    form #lg-reset, input #remail
// If those ids change in index.html, update this file to match.
(function () {
  "use strict";

  function note(form, msg, ok) {
    var id = form.id + "-wire-note";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("p");
      el.id = id;
      el.style.cssText =
        "font-size:12px;margin:12px 0 0;text-align:center;line-height:1.5";
      form.appendChild(el);
    }
    el.style.color = ok ? "#9fece0" : "#fca5a5";
    el.textContent = msg;
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, body: j || {} };
      });
    });
  }

  function busy(form, on, label) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (on) {
      btn.dataset.wireLabel = btn.textContent;
      btn.textContent = label;
      btn.disabled = true;
    } else {
      if (btn.dataset.wireLabel) btn.textContent = btn.dataset.wireLabel;
      btn.disabled = false;
    }
  }

  function ready() {
    var create = document.getElementById("lg-create");
    if (create) {
      // Point the legal links at the real documents (they are '#' in the
      // static page), and open them in a new tab.
      var links = Array.prototype.slice.call(create.querySelectorAll("a"));
      links.forEach(function (a) {
        var t = (a.textContent || "").toLowerCase();
        if (t.indexOf("non-disclosure") !== -1 || t.indexOf("nda") !== -1) {
          a.href = "/legal/nda";
          a.target = "_blank";
          a.rel = "noopener";
        } else if (t.indexOf("privacy") !== -1) {
          a.href = "/legal/privacy";
          a.target = "_blank";
          a.rel = "noopener";
        }
      });

      // Requesting an account never sets a password — the owner approves
      // first, then the person picks their own password. Hide the field so
      // nobody types one expecting it to be used.
      var cpw = document.getElementById("cpw");
      if (cpw) {
        var pwLabel = create.querySelector('label[for="cpw"]');
        if (pwLabel) pwLabel.style.display = "none";
        cpw.style.display = "none";
        cpw.disabled = true;
      }
    }

    // Sign in — real Supabase session (cookie-based, set server-side).
    var signin = document.getElementById("lg-signin");
    if (signin) {
      signin.addEventListener("submit", function () {
        if (signin.dataset.wireBusy === "1") return;
        var email = (document.getElementById("em") || {}).value || "";
        var pw = (document.getElementById("pw") || {}).value || "";
        if (!email || !pw) {
          note(signin, "Enter your email and password.", false);
          return;
        }
        signin.dataset.wireBusy = "1";
        busy(signin, true, "Signing in…");
        post("/auth/login", { email: email, password: pw }).then(
          function (res) {
            if (res.ok) {
              // Leave the button busy — we're navigating away.
              window.location.href = "/dashboard";
            } else {
              signin.dataset.wireBusy = "";
              busy(signin, false);
              note(signin, res.body.error || "Sign-in failed.", false);
            }
          },
          function () {
            signin.dataset.wireBusy = "";
            busy(signin, false);
            note(signin, "Network error — try again.", false);
          },
        );
      });
    }

    // Request an account — files a request for the owner to review.
    // No login (and no password) is created here.
    if (create) {
      create.addEventListener("submit", function () {
        if (create.dataset.wireDone === "1" || create.dataset.wireBusy === "1")
          return;
        var name = (document.getElementById("cname") || {}).value || "";
        var email = (document.getElementById("cemail") || {}).value || "";
        var nda = document.getElementById("cnda");
        var priv = document.getElementById("cpriv");
        if (!email) {
          note(create, "Enter your work email.", false);
          return;
        }
        if (!nda || !priv || !nda.checked || !priv.checked) {
          note(create, "Please agree to the NDA and the privacy policy.", false);
          return;
        }
        create.dataset.wireBusy = "1";
        busy(create, true, "Sending…");
        post("/auth/request-account", { name: name, email: email }).then(
          function (res) {
            create.dataset.wireBusy = "";
            if (res.ok) {
              // One request per visit — keep the button disabled so a second
              // click can't file a duplicate.
              create.dataset.wireDone = "1";
              busy(create, true, "Request sent");
              note(
                create,
                "Request received — the owner reviews it and you'll get access once approved.",
                true,
              );
            } else {
              busy(create, false);
              note(create, res.body.error || "Could not send the request.", false);
            }
          },
          function () {
            create.dataset.wireBusy = "";
            busy(create, false);
            note(create, "Network error — try again.", false);
          },
        );
      });
    }

    // Password reset — emails a link that lands on /reset-password.
    var reset = document.getElementById("lg-reset");
    if (reset) {
      reset.addEventListener("submit", function () {
        if (reset.dataset.wireBusy === "1") return;
        var email = (document.getElementById("remail") || {}).value || "";
        if (!email) {
          note(reset, "Enter the email on your account.", false);
          return;
        }
        reset.dataset.wireBusy = "1";
        busy(reset, true, "Sending…");
        post("/auth/reset", { email: email }).then(
          function () {
            reset.dataset.wireBusy = "";
            busy(reset, false);
            note(
              reset,
              "If an approved account exists for that email, a reset link is on its way. Open it in this same browser.",
              true,
            );
          },
          function () {
            reset.dataset.wireBusy = "";
            busy(reset, false);
            note(reset, "Network error — try again.", false);
          },
        );
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
