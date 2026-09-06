# Deployment checklist (no-card route)

Do **not** deploy until you have these four free accounts/resources ready:

1. Telegram account + BotFather bot
2. GitHub Free account
3. Vercel Hobby account/project
4. Upstash Free Redis database

## 1) Telegram

In Telegram, open `@BotFather` and create a bot with `/newbot`.
Copy its bot token. You do not enter a card or use Telegram/Google Play payments for this bot.

## 2) Upstash

Create exactly one **Free** Redis database in the Upstash console and copy:

- REST URL
- REST token

Do not press upgrade / Pay-as-you-go and do not add a payment method.

## 3) Secrets

Create three random secrets locally. Examples of the *format only*:

```text
WEBHOOK_SECRET=telegram_hook_R4nd0m_...
SETUP_SECRET=setup_R4nd0m_...
ADMIN_CLAIM_CODE=admin_R4nd0m_...
```

Use your own long values. Never use those examples literally.

## 4) GitHub

Create a new repository, for example `telegram-roleplay-bot-v2`.
Upload every file from this project except `.env` / `.env.local`.

## 5) Vercel

- Choose/import the GitHub repository.
- Keep the project on **Hobby**.
- Do not start a Pro trial.
- Add the environment variables listed in `.env.example`.
- Deploy.

## 6) Register Telegram webhook

After deployment, open this URL in your browser, replacing the values:

```text
https://YOUR-VERCEL-DOMAIN/api/setup?secret=YOUR_SETUP_SECRET
```

A JSON response with `"ok": true` means the webhook was registered.

Check health at:

```text
https://YOUR-VERCEL-DOMAIN/api/health
```

## 7) Claim the human admin

Message the bot:

```text
/claim YOUR_ADMIN_CLAIM_CODE
/admin
```

Then build the entire user flow from **Flow Builder**.
