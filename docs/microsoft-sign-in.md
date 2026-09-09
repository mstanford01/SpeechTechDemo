# Microsoft sign-in (future integration)

The current demo is intentionally local and unauthenticated. No passwords, secrets, account identifiers, or simulated sign-in sessions are stored.

To add real Microsoft authentication:

1. Register an application in Microsoft Entra. To use a personal Microsoft account, select an audience that includes **personal Microsoft accounts**. For the eventual Experis deployment, have Experis IT register an approved company application in the appropriate tenant.
2. For a browser implementation, register the **Single-page application** platform and an exact localhost redirect URI such as `http://localhost:8000/redirect`.
3. Record the public application (client) ID and tenant/audience. Do not put client secrets in browser code.
4. Implement MSAL Browser with authorization code flow and PKCE, the current MSAL redirect bridge page, sign-in/sign-out handling, and an access token scoped to the API.
5. Protect the Python API by validating token signature, issuer, audience and expiry, then enforce the intended users/groups. A login button alone does not secure the inference endpoint.
6. Verify personal-account login first, then replace or restrict it to the Experis tenant when company access is ready.

This is a setup plan, not an implemented authentication feature. The email address alone is not enough to configure Microsoft OAuth.

Official references:
- https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization
- https://learn.microsoft.com/en-us/entra/msal/javascript/browser/login-user
- https://learn.microsoft.com/en-us/entra/identity-platform/reply-url
