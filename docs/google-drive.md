# Google Drive setup

Orbit uses the existing Google OAuth Web application client. No separate API key or service account is needed.

1. In the **Orbit** Google Cloud project, enable **Google Drive API** under APIs & Services → Library.
2. In Google Auth Platform → Data Access, add:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`
3. Keep the existing Google sign-in redirect URI: `https://i8is-marketing-os-f7ci.vercel.app/api/auth/callback/google` (and your configured localhost callback for development).
4. Check Audience: internal Workspace apps are limited to that organization. External apps in testing need their users added as test users; Google may require verification for production external use of restricted scopes. Follow the requirements shown in the Google console.
5. Each user opens **Assets → Connect Google Drive**, selects their own account, and grants both permissions. Normal sign-in continues to request only basic identity permissions.

The read permission allows browsing/searching existing files, including private files that the connected person can download. The file permission allows creating new copies in that person's My Drive. Orbit does not modify sharing permissions or overwrite/delete Drive originals. Only explicitly imported copies become available to other active workspace members. Google Docs, Slides and Sheets can be exported to PDF; Google's export limit is 10 MB. Other files have Orbit's 25 MB limit.

To store new uploads in Drive, enable **Also save a copy of each upload to my Google Drive** in the upload dialog. An Orbit copy remains available for shared previews and post attachments. A failed Drive copy does not discard the successful Orbit upload; retry from asset details. This is optional backup storage, not a replacement for Orbit's asset store or allowance.

Tokens remain on the server, encrypted with AES-256-GCM, bound to the tenant and Google identity. They never enter browser sessions or API responses. Keep `AUTH_SECRET` stable; rotating it requires reconnecting Drive. Workspace revocation blocks Drive APIs. Disconnect removes Orbit's stored credentials; revoke the application's grant in Google Account permissions to remove Google's authorization as well.

References: [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [downloads and exports](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
