# Sheriya Study Zone — Secure OpenRouter Worker

## 1. Create the Worker
1. Open https://dash.cloudflare.com/
2. Go to Workers & Pages -> Create -> Create Worker.
3. Name it (example: sheriya-ai-api), create/deploy it.
4. Open Edit Code and replace the sample code with the contents of worker.js in this repository.
5. Deploy.

## 2. Add secrets and variables
In the Worker -> Settings -> Variables and Secrets:
- Add Secret: OPENROUTER_API_KEY = your NEW OpenRouter key.
- Add Text variable: ALLOWED_ORIGIN = https://anshalkumar644.github.io

ALLOWED_ORIGIN must be the exact origin of the Pages site (scheme + hostname only; no path or trailing slash). If your Pages site uses a custom domain, use that domain instead.
Save and deploy/redeploy.

## 3. Copy Worker URL
It will look like:
https://sheriya-ai-api.YOUR-SUBDOMAIN.workers.dev

The frontend calls POST https://YOUR-WORKER-URL/chat.

## 4. Finish frontend configuration
In index.html on branch secure/openrouter-worker, replace:
https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev
with your actual Worker base URL (do not add /chat).
Commit the change.

## 5. Test before publishing
Open the site and test both Veda AI and Shweta Helping Hand. Also check Worker Logs in Cloudflare.
Do not put the OpenRouter key in HTML, JavaScript, GitHub, or chat.

## Security notes
- Revoke any OpenRouter key previously committed to a public repository. Removing it from the current file does not erase old Git history.
- CORS only controls browser origins; it is not authentication and does not prevent non-browser abuse.
- Before public launch, configure Cloudflare rate limiting/WAF rules for POST /chat and set an OpenRouter spending limit. Monitor Worker logs and provider usage.
- The Worker enforces request size/message limits and keeps the provider key server-side.
