# Security

## Reporting a vulnerability

Use the repository's **Security → Advisories → Report a vulnerability** button
to contact the maintainers privately. Include the affected revision, reproduction
steps, impact and a minimal proof of concept without real credentials or personal
data. Do not post an exploitable vulnerability in a public issue or pull request.

Repository owners must enable GitHub private vulnerability reporting before
publishing this template. If the button is unavailable on a fork, ask its owner
to enable a private reporting channel without disclosing exploit details.

Fixes target the current default branch; older template snapshots do not have
a separate patch-support commitment. Projects generated from this template
must track and apply relevant dependency and security updates themselves.

## Deployment boundary

This is a production-oriented starting point, not an authenticated product.
The sample `/users` endpoints intentionally have **no authentication or
authorization**. Remove or protect them before exposing an instance with real
data. CORS and Helmet are not access control.

Before a real deployment, configure TLS, application-specific access control
and rate limits, secrets, database backups and a tested restore procedure,
monitoring and alerting. Keep the stores private, retain the restricted runtime
database role, and review migrations for compatibility with application rollbacks.
Changing an image tag does not roll back a database migration.

Enable dependency updates and review the resulting PRs. `renovate.json` is
configuration only: the Renovate GitHub App (or a self-hosted runner) must be
enabled separately. CI passing is useful evidence, not a security certification.
