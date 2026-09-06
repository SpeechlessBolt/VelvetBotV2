# Telegram Roleplay Bot V2 / Mark II

A small, serverless Telegram bot where **users talk to human admins**. There is no AI responder.

The important difference from V1 is that the bot behaves like a tiny **no-code flow builder inside Telegram**: an admin can add buttons, nest categories, change labels, change what each button does, replace texts/media, ask questions, and start a human chat without touching the source code or redeploying.

## What a button can do

Every button can be changed to one of four actions:

1. **📂 Menu / category** — sends editable content and shows child buttons.
2. **💬 Send content** — sends editable text/media; it may also have child buttons.
3. **❓ Ask a question** — sends an editable question, remembers the user's answer, sends an editable/default acknowledgement, then shows child buttons.
4. **👤 Start human chat** — creates a fresh ticket/session and relays messages between the user and the human admin(s).

All four node types can have child buttons, so you can build flows such as:

```text
Start
└── Roleplay
    ├── Fantasy
    │   ├── Ask character name
    │   │   ├── Show rules
    │   │   │   └── Start human chat
    │   └── Superhero
    └── Support
        └── Start human chat
```

## Admin editing

After claiming admin access:

- `/admin` opens the admin panel.
- **Flow Builder** lets you add/edit/delete/reorder buttons.
- Each button's **action** can be changed at any time.
- **Edit content** captures the exact Telegram content you send: text, photo, video, GIF/animation, document, audio, voice, sticker, or video note.
- Text formatting/entities are preserved.
- Question nodes have separately editable **after-answer content**.
- **System texts** edits generic user-facing labels/messages such as Back, Home, choose-option prompt, no-admin message, etc.
- **Settings** can turn first-time name/ID collection on or off.

## Human chat / ticket behavior

- A new ticket ID is created **each time a human-chat node is entered**.
- The admin gets the user's chosen path and any previously collected question answers.
- Every user message is copied to each admin.
- The admin can reply to either the ticket header **or** the copied user message.
- Replies are routed back to the correct user.
- Either side can close the ticket.
- With multiple admins, any admin can reply; there is no AI in the loop.

## Architecture

```text
Telegram
   │ webhook
   ▼
Vercel Hobby Function
   ├── user flow handler
   ├── Telegram admin flow builder
   ├── ticket relay
   └── webhook setup endpoint
   │
   ▼
Upstash Redis Free
```

No always-on server, no database server, no paid SDK, and no background worker are required.

## Environment variables

Copy `.env.example` and configure these in Vercel:

- `TELEGRAM_BOT_TOKEN` — from BotFather.
- `WEBHOOK_SECRET` — your own random webhook secret using letters/numbers/`_`/`-`.
- `SETUP_SECRET` — protects the setup URL.
- `ADMIN_CLAIM_CODE` — a long random code human admins use once with `/claim <code>`.
- `UPSTASH_REDIS_REST_URL` — from Upstash.
- `UPSTASH_REDIS_REST_TOKEN` — from Upstash.
- `PUBLIC_BASE_URL` — optional; Vercel normally provides the production URL automatically.

**Never commit real secrets to GitHub.**

## Commands

### User

- `/start` — start/restart.
- `/menu` — leave any open human chat and return home.

### Admin

- `/claim YOUR_CODE` — claim human-admin access.
- `/admin` — open the editor/admin panel.
- `/cancel` — cancel the current admin edit step.

## Deployment overview

We will do this together after the repository is created:

1. Create a Telegram bot with BotFather.
2. Create a free Upstash Redis database.
3. Create a GitHub Free repository and upload this project.
4. Import the GitHub repository into a Vercel **Hobby** project.
5. Add the environment variables.
6. Deploy.
7. Visit:
   `https://YOUR-PROJECT.vercel.app/api/setup?secret=YOUR_SETUP_SECRET`
8. Telegram should now send updates to `/api/webhook`.
9. In Telegram, send `/claim YOUR_ADMIN_CLAIM_CODE`, then `/admin`.

## Free-only design

This project intentionally does **not** use Vercel Marketplace databases, paid add-ons, Google Play billing, payment SDKs, Stripe, or any feature that needs a card in the app itself.

Keep the Vercel account on **Hobby**, and create the Upstash database on its **Free** tier. Do not opt into a Vercel Pro trial or Upstash Pay-as-you-go when following the deployment steps.

## Reliability / security improvements over V1

- Secret-token verification on Telegram webhooks.
- No insecure built-in default admin code.
- Admin claim comparison uses timing-safe comparison.
- Telegram `update_id` deduplication in Redis.
- Real processing failures return HTTP 500 so Telegram can retry.
- Fresh ticket ID for each human-chat session.
- Both the admin header and copied user message are reply-routable.
- User-generated text is never injected into HTML parse mode.
- Forward mappings expire automatically after 14 days.
- Large webhook file split into small modules.

## Notes

- The Vercel Hobby plan is for personal/non-commercial use. If this becomes commercial, check Vercel's current plan rules before continuing on Hobby.
- Telegram callback data is intentionally compact so it stays under Telegram's callback-data size limit.
- The bot stores the flow and small user/session records in Redis. Telegram media is referenced by Telegram `file_id`, not re-uploaded into Redis.
