# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Report it privately through GitHub's private vulnerability reporting on this repository
(the *Security* tab → *Report a vulnerability*). If that is unavailable to you, contact
the maintainer at the address listed on their GitHub profile.

Please include what you can: affected version or commit, a description of the issue, the
steps to reproduce it, and the impact you believe it has. A proof of concept helps but is
not required.

This is a solo-maintained project. Expect an acknowledgement within 7 days and a first
substantive response within 14. If you have not heard back in that window, please ping
the thread — it means the message was missed, not ignored.

Fixes are disclosed publicly once a patched release is available, or 90 days after the
report, whichever comes first. If you would like credit in the advisory, say so and give
the name you'd like used.

## Supported versions

Only the latest release receives security fixes. There are no long-term support branches.

## Scope

In scope: this repository, the converter service under `services/converter/`, and the
example deployment configuration.

Out of scope: vulnerabilities in Better Auth, Postgres, Node, or other third-party
dependencies (report those upstream); findings that require an attacker to already hold
the instance's `DATABASE_URL`, `BETTER_AUTH_SECRET` or equivalent operator credentials; and
issues in a self-hosted deployment caused by misconfiguration rather than by the code here.

Cross-user access is always in scope: any way for one account to read or change another
account's projects, manuscripts, files, conversations or settings.

## A note for self-hosters

You are the operator of your own instance. Keep `.env` out of version control and
readable only by you (`scripts/setup.sh` creates it with mode 600), leave the database and
the converter unpublished as `docker-compose.yml` does, and read `docs/self-hosting.md`
before exposing an instance to the internet.
