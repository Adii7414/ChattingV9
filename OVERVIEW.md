# Chatting

Chatting is a messaging product for friends, groups, teams and communities. The site has three parts:

- **Landing page** (`/`) — a polished, Apple-style public page. Its main button reads "Get Chatting" for visitors and "Open Chatting" for people who are already signed in.
- **The chat app** (`/app`) — behind email sign-in. It has direct messages and custom groups (with a name, emoji, description, admins and member management), threaded replies, communities with channels (public ones can be found in Discover, private ones are joined by invite link), reactions, message editing and deleting, photos and files, pin and mute, presence, read receipts, search, and a full profile and privacy settings page.
- **Legal pages** (`/privacy`, `/terms`) — written to match the data the app actually stores.

## Live delivery & communities (latest)
- Messages, reactions, read receipts and "typing…" arrive live: the app keeps a waiting connection open that answers the moment anything changes.
- Communities are deeply customisable from their settings page (`/app/community/:id`): icon, banner, accent colour, tagline, tags, custom invite link, quick reactions, categories and channel order, channel emoji/topic/slow mode/announcement/private-to-roles, custom roles with colours and 9 permissions, nicknames, join modes (open / approval / invite-only) with requests, kick/ban/unban, blocked words, link blocking, max message length, welcome messages, rules members must accept, ownership transfer and an audit log.

Recent additions: voice messages, GIFs, link previews, polls, send-later scheduling, disappearing messages, blocking, auto-clearing status, drafts synced across devices, mark-as-unread / jump-to-unread, chat export, more keyboard shortcuts, and community timeouts, events with RSVPs and an insights dashboard. Removed or banned members are ejected from the community in real time.

Latest round: a custom waveform voice-note player; personal appearance settings (accent colour, text size, compact mode, wallpapers, reduced motion), sound choices, Do Not Disturb and quiet hours; richer formatting (code blocks, spoilers, strikethrough, quotes, big emoji), stickers, slash commands with confetti, emoji shortcodes, @here, translate, copy message link; chat folders, sorting, per-chat colours, private renames and notes; profile banners, local time and things-in-common; community welcome screens, leaderboard with levels, activity-by-hour, event countdowns and calendar export; and moderation tools — message reports with a review queue, warnings, mod notes and spam protection.

## Customise everything (latest)
- Communities get a **Customise** settings tab: font, bubble style, wallpaper, accent-coloured UI, banner strip, announcement bar, custom placeholder/empty text/member name, guidelines link, on/off switches for GIFs, uploads, polls, reactions, threads and edits, extra auto-mod rules (min length, caps, mentions, emoji) and auto-responders.
- Personal settings add fonts (incl. easy-read), any accent colour, square bubbles, high contrast, 24h clock, hidden avatars, link-preview/blur/spell-check/character-counter toggles, sidebar previews, private notifications and new wallpapers.
- New slash commands, shortcodes, sticker packs, ==highlight== and __underline__, a getting-started checklist, a "Make it yours" landing section and a branded sign-in screen (Zite still handles the secure email link).

- **Official accounts** — verified Chatting (welcome DM + product updates, read-only) and Chatting Support (in-app support chat that opens on request and disappears when the ticket is closed).

## Support panel (/support)
The former ChattingModPanel app now lives inside this app at /support. It is staff-only: people must sign in and their email must be listed in the ZITE_SUPPORT_STAFF_EMAILS secret. Staff handle support tickets, user reports, user moderation, communities, announcements and saved replies there.

## Bots & developer platform (latest)
- Communities can add bots from **Settings → Bots**. Ready-made bots handle welcome messages and starter roles, auto-moderation, level-ups, giveaways and polls, and reminders. Custom bots get a secret API key, a permissions list, an events URL and a signing secret.
- Bot messages show a BOT badge and can carry rich cards, buttons and dropdowns (for example self-serve role pickers, rules acceptance and giveaway entry).
- A public Bot API (one JSON endpoint) plus signed event webhooks or a polling feed let developers build their own bots. Full docs, with recipes, live at `/developers`.

## Support panel additions
- Staff can verify any community by hand, even when it doesn't meet every requirement. The override is recorded.
- A platform-wide **Audit log** covers sign-ins, staff actions, moderation, verification and bot activity, with filters, a detail view and CSV export.
- Each user's page now has account tools: device sessions with sign-out or sign-out-everywhere, activity stats, an audit trail, the bots they own, staff flags and notes, renaming and profile resets.

Direct messages are end-to-end encrypted: each device keeps its own private key, and people can compare a WhatsApp-style 60-digit security code or scan a QR code to verify each other.

Voice and video calls (Discord-style privacy): 1:1 and group calls from any DM/group, plus community voice channels people can drop into. Calls support camera, screen sharing and up to 8 people; audio and video travel straight between devices, end-to-end encrypted, with a shared privacy code to verify. Text in groups and communities stays readable by the server so moderation and bots keep working.

## Usernames, stories & Discord-style layout (latest)
- Everyone picks a unique @username after signing up; people are found only by username (never email).
- Instagram-style 24-hour stories (text, photo, video) for friends, with views, reactions and replies.
- WhatsApp-style ticks (clock → grey double tick → blue when read), a Discord-style community rail, community cards with collapsible categories, and a slide-in profile panel.
- Support panel **Toolkit**: analytics, platform-wide message search, username moderation, story removal, live call monitor, bot kill-switch, SLA watch, repeat offenders, bulk actions and user CSV export.

## Discord polish & richer stories (latest)
- Channel type (text or voice) is chosen when a channel is created. Community settings use a Discord-style menu on phones and fill wide screens.
- Stories have a rich-text editor, fonts, colours, alignment, position, stickers, text boxes, custom duration and a "who viewed" list.
- Discord extras: member list grouped by role with online/offline, people shown under voice channels, rail hover names, right-click a community to mark it read or reorder it, and Alt+↑/↓ (Alt+Shift for unread) to switch chats.
