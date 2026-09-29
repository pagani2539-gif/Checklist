# ADR 0005: Local accounts managed by the highest admin

Status: Accepted for the current on-prem deployment profile.

## Context

The deployment does not use an organizational OIDC provider. The organization wants the highest admin to provision each operator account and assign the role and station access directly in Checklist.

## Decision

- Use PostgreSQL-backed local accounts with username, display name, role, station assignment, active status, and password hash.
- Keep public self-registration closed. The first admin is created only from a local server terminal, and only while the account table is empty. `npm.cmd run admin:bootstrap-default` creates username `admin` with a fresh random password copied to the current Windows clipboard and forces password change on first login; `npm.cmd run admin:bootstrap` remains available for a user-chosen credential.
- Hash passwords with Node.js `scrypt` and a per-account random salt. Never return or log password hashes, passwords, session cookies, or session tokens.
- Create operator accounts with a temporary password and require a password change on first sign-in. Admin resets revoke existing sessions and require another password change.
- Store opaque session tokens as hashes in PostgreSQL. Cookies use `Secure`, `HttpOnly`, and `SameSite=Lax` in local-auth mode. Each request loads the current account, so inactive users lose access and role/station changes take effect immediately.
- Only `admin` can list, create, update, reset, or suspend accounts. Keep a last-active-admin guard; suspend accounts instead of deleting them so audit history remains useful.
- Validate station assignments against existing Station Profiles for station-scoped roles. `viewer` accounts must have at least one assigned station. `inspector` accounts can access every current and future Station Profile, round, evidence item, and Vehicle API target without individual station assignments. `station-manager` and `admin` retain their existing central-management scope.
- Production/Public mode requires `CHECKLIST_AUTH_MODE=local` or the optional OIDC mode, Secure cookies, and station scope. `disabled` remains a development-only mode and cannot start in Production/Public mode.
- OIDC code remains an optional alternative, but it is not part of the selected deployment. No OIDC provider or Docker service is required for local accounts.

## Consequences

The deployment needs PostgreSQL and one controlled first-admin bootstrap. The random one-time bootstrap password stays in the local clipboard for the operator to paste into the login form and change; clear the clipboard after use. The organization is responsible for distributing later temporary passwords safely and for protecting the server, HTTPS reverse proxy, and PostgreSQL backup. Local password accounts do not provide external MFA or central directory lifecycle; the owner must review that trade-off before Public Go.

## Security behavior

- Local login is rate-limited by source address and returns the same invalid-credentials response for unknown, inactive, or incorrect accounts.
- A temporary-password account can only inspect its session, change password, or log out until its password is changed.
- `viewer` accounts cannot access Station Profiles, rounds, evidence, or Vehicle API targets outside their assignments. `inspector` accounts can inspect all stations; this does not grant account administration, which remains admin-only.
