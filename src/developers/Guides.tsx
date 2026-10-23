import { C, Callout, Code, H2, H3, P, Table, Tabs } from './kit';
import { ERRORS, EVENTS } from './reference';

export function Intro({ url }: { url: string }) {
  return (<>
    <H2 id="introduction">Introduction</H2>
    <P>The Chatting Bot API lets your own code act inside a community: post messages and rich cards, add buttons and dropdowns, read channels, react, give roles and moderate. It also tells your code the moment something happens, through signed webhooks or a polling feed. If you’ve built a Discord bot before, this will feel familiar.</P>
    <P>The whole API is <b>one HTTPS endpoint</b>. Every call is a <C>POST</C> with a JSON body naming an <C>op</C> (the operation) and its <C>params</C>. Every response is JSON with <C>ok</C> set to true or false. There are no SDKs to install.</P>
    <Code lang="endpoint" code={`POST ${url}`} className="mt-4" />
  </>);
}

export function Quickstart({ url }: { url: string }) {
  return (<>
    <H2 id="quickstart">Quickstart (2 minutes)</H2>
    <ol className="mt-3 list-decimal space-y-2 pl-5 leading-7 text-muted-foreground">
      <li>Open your community → <b>Settings → Bots → Add bot → Custom bot</b>.</li>
      <li>Copy the API key that appears. It starts with <C>cb_</C> and is shown only once.</li>
      <li>Tick the permissions your bot needs (for example <b>Send Messages</b>) and save.</li>
      <li>Run one of these with your key and a channel id. You can get channel ids from <C>channels.list</C>.</li>
    </ol>
    <div className="mt-4"><Tabs items={[
      { label: 'curl', lang: 'bash', code: `curl -X POST '${url}' \\\n  -H 'content-type: application/json' \\\n  -d '{\n    "token": "cb_YOUR_KEY",\n    "op": "messages.send",\n    "params": { "channelId": "CHANNEL_ID", "content": "Hello, world 👋" }\n  }'` },
      { label: 'Node.js', lang: 'js', code: `const API = '${url}';\nconst TOKEN = process.env.CHATTING_TOKEN;\n\nexport async function call(op, params = {}) {\n  const res = await fetch(API, {\n    method: 'POST',\n    headers: { 'content-type': 'application/json' },\n    body: JSON.stringify({ token: TOKEN, op, params }),\n  });\n  const json = await res.json();\n  if (!json.ok) throw new Error(\`\${json.error.code}: \${json.error.message}\`);\n  return json.data;\n}\n\nconst { channels } = await call('channels.list');\nawait call('messages.send', { channelId: channels[0].id, content: 'Hello, world 👋' });` },
      { label: 'Python', lang: 'python', code: `import os, requests\n\nAPI = "${url}"\nTOKEN = os.environ["CHATTING_TOKEN"]\n\ndef call(op, **params):\n    r = requests.post(API, json={"token": TOKEN, "op": op, "params": params}, timeout=15)\n    data = r.json()\n    if not data["ok"]:\n        raise RuntimeError(f"{data['error']['code']}: {data['error']['message']}")\n    return data["data"]\n\nchannels = call("channels.list")["channels"]\ncall("messages.send", channelId=channels[0]["id"], content="Hello, world 👋")` },
    ]} /></div>
  </>);
}

export function Auth() {
  return (<>
    <H2 id="authentication">Authentication</H2>
    <P>Send your key as <C>token</C> in the JSON body. You can send it in an <C>x-bot-token</C> header instead. Each key belongs to one bot installed in one community, so you never pass a community id.</P>
    <Callout tone="warn"><b>Keep keys server-side.</b> Never put a key in a browser, mobile app or public repo. If one leaks, open <b>Settings → Bots</b> and click <b>Reset API key</b>. The old key stops working immediately.</Callout>
    <H3 id="requests">Request & response shape</H3>
    <Code lang="request" code={`{\n  "token": "cb_…",\n  "op": "messages.list",\n  "params": { "channelId": "…", "limit": 20 }\n}`} className="mt-3" />
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <Code lang="success" code={`{\n  "ok": true,\n  "op": "messages.list",\n  "data": { "messages": [ … ], "hasMore": true }\n}`} />
      <Code lang="failure" code={`{\n  "ok": false,\n  "op": "messages.send",\n  "error": {\n    "code": "missing_permission",\n    "message": "This bot needs the “Send Messages” permission for that.",\n    "status": 403\n  }\n}`} />
    </div>
    <P>Always check <C>ok</C>. Errors come back as a normal JSON body with an <C>error.status</C> that mirrors the HTTP meaning. Retrying is safe only for <C>rate_limited</C> and <C>internal_error</C>.</P>
    <H3 id="errors">Error codes</H3>
    <Table head={['code', 'status', 'meaning']} rows={ERRORS.map(([c, s, m]) => [<C key="c">{c}</C>, s, m])} />
    <H3 id="limits">Rate limits & sizes</H3>
    <Table head={['limit', 'value']} rows={[
      ['Calls per bot', '120 per rolling 60 seconds'], ['Message content', '4000 characters'], ['Embeds per message', '10 (12 KB total JSON)'],
      ['Component rows', '5 rows; up to 5 buttons or 1 dropdown per row'], ['Dropdown options', '25'], ['Bots per community', '25'],
      ['Webhook timeout', 'Your server must answer within 5 seconds'],
    ]} />
    <H3 id="permissions">Permissions</H3>
    <P>Community admins choose what each bot may do. An op that needs a permission your bot lacks returns <C>missing_permission</C>.</P>
    <Table head={['permission', 'unlocks']} rows={[
      ['Read Messages', 'messages.list / get / search, reactions.list'], ['Send Messages', 'messages.send, interactions.respond, giveaways, reminders'],
      ['Add Reactions', 'reactions.add'], ['Manage Messages', 'Delete or pin anyone’s messages'], ['Manage Roles', 'roles.add / remove'],
      ['Moderate Members', 'warn, timeout, untimeout, kick'], ['View Members', 'members.list / get'], ['Manage Channels', 'Reserved for upcoming channel ops'],
    ]} />
  </>);
}

export function Objects() {
  return (<>
    <H2 id="objects">Objects</H2>
    <H3 id="obj-message">Message</H3>
    <Code lang="json" className="mt-3" code={`{\n  "id": "8c1f…",\n  "content": "text with **markdown**",\n  "author": { "id": "u_1…", "name": "Ava", "bot": false },\n  "createdAt": "2026-10-20T08:15:02.114Z",\n  "editedAt": null,\n  "threadId": null,       // set when the message lives in a thread\n  "replyToId": null,      // the quoted message\n  "pinned": false,\n  "embeds": [Embed],\n  "components": [[Component]],\n  "attachments": [{ "url": "…", "filename": "photo.png", "contentType": "image/png" }]\n}`} />
    <H3 id="obj-embed">Embed (rich card)</H3>
    <Code lang="json" className="mt-3" code={`{\n  "title": "Build #482 passed",\n  "url": "https://ci.example.com/482",       // makes the title a link\n  "description": "All **214** tests green. Finished <t:2026-10-20T08:15:00Z>",\n  "color": "#16a34a",                         // left border colour\n  "author": { "name": "CI", "iconUrl": "https://…/ci.png" },\n  "fields": [\n    { "name": "Branch", "value": "main", "inline": true },\n    { "name": "Duration", "value": "3m 12s", "inline": true }\n  ],\n  "thumbnail": "https://…/small.png",\n  "image": "https://…/chart.png",\n  "footer": "ci-bot",\n  "timestamp": "2026-10-20T08:15:00Z"\n}`} />
    <P><C>{'<t:ISO-date>'}</C> anywhere in content, descriptions or fields shows up in each reader’s own time zone.</P>
    <H3 id="obj-components">Components (buttons & dropdowns)</H3>
    <P><C>components</C> is an array of rows, and each row is an array of components.</P>
    <Code lang="json" className="mt-3" code={`[\n  [\n    { "type": "button", "id": "approve", "label": "Approve", "style": "success", "emoji": "✅" },\n    { "type": "button", "id": "deny",    "label": "Deny",    "style": "danger" },\n    { "type": "button", "id": "docs",    "label": "Docs",    "style": "link", "url": "https://…" }\n  ],\n  [\n    { "type": "select", "id": "color", "placeholder": "Pick a colour",\n      "options": [ { "label": "Blue", "value": "blue", "emoji": "💙" }, { "label": "Red", "value": "red", "emoji": "❤️" } ] }\n  ]\n]`} />
    <Table head={['style', 'look']} rows={[['primary', 'Accent colour'], ['secondary', 'Neutral (default)'], ['success', 'Green'], ['danger', 'Red'], ['link', 'Opens `url`. No event is sent.']]} />
    <H3 id="builtin-components">Built-in component ids (no code needed)</H3>
    <P>Some ids are handled by Chatting itself, so you can post them with nothing listening:</P>
    <Table head={['id', 'what happens on click']} rows={[
      [<C key="a">role:ROLE_ID</C>, 'Toggles that role for the clicker. Only roles without permissions can be self-assigned.'],
      [<C key="b">roles</C>, 'On a dropdown whose option values are role ids, sets the clicker’s roles to their choice (a reaction-roles picker).'],
      [<C key="c">rules:accept</C>, 'Thanks the member and gives them a role named “Member” or “Verified” if one exists.'],
      [<C key="d">giveaway:ID</C>, 'Enters or leaves a giveaway.'],
    ]} />
  </>);
}

export function Events() {
  return (<>
    <H2 id="events">Events</H2>
    <P>Choose which events your bot gets under <b>Settings → Bots → your bot → Events</b>. There are two ways to receive them, and you can use both:</P>
    <ul className="mt-3 list-disc space-y-1 pl-5 leading-7 text-muted-foreground">
      <li><b>Webhooks (push):</b> set an <b>Events URL</b> and we <C>POST</C> each event to it within a moment.</li>
      <li><b>Polling (pull):</b> call <C>events.poll</C> with a cursor. This works without a public server, for example on a laptop or behind a firewall.</li>
    </ul>
    <H3 id="event-types">Event types</H3>
    <Table head={['type', 'when', 'data']} rows={EVENTS.map((e) => [<C key="t">{e.type}</C>, e.when, <code key="d" className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{JSON.stringify(e.data)}</code>])} />
    <H3 id="webhook-format">Webhook delivery</H3>
    <Code lang="http" className="mt-3" code={`POST https://your-bot.example.com/chatting\ncontent-type: application/json\nx-chatting-event: MESSAGE_CREATE\nx-chatting-event-id: 3f6a…\nx-chatting-timestamp: 1760948102\nx-chatting-signature: v1=5d41402abc4b2a76b9719d911017c592…\n\n{\n  "id": "3f6a…", "seq": 1521,\n  "type": "MESSAGE_CREATE",\n  "communityId": "5a2b…", "channelId": "b4d7…",\n  "timestamp": "2026-10-20T08:15:02.114Z",\n  "data": { "messageId": "8c1f…", "userId": "u_1…", "body": "!help" }\n}`} />
    <P>Reply with any 2xx status within 5 seconds. Every attempt, with its status code, shows under <b>Recent deliveries</b> in the bot’s settings. A failed delivery is <b>not retried</b>, but it is always kept in the <C>events.poll</C> feed, so a polling catch-up never loses events.</P>
    <H3 id="signatures">Verifying signatures</H3>
    <P>The signature is <C>HMAC-SHA256(signingSecret, timestamp + "." + rawBody)</C> in hex. Reject requests older than 5 minutes to block replays. Use the <b>raw</b> request body: re-serialising the JSON changes the bytes and the check fails.</P>
    <div className="mt-4"><Tabs items={[
      { label: 'Node.js (Express)', lang: 'js', code: `import express from 'express';\nimport crypto from 'node:crypto';\n\nconst app = express();\napp.post('/chatting', express.raw({ type: 'application/json' }), (req, res) => {\n  const ts = req.header('x-chatting-timestamp');\n  const sig = req.header('x-chatting-signature')?.replace('v1=', '') ?? '';\n  const expected = crypto.createHmac('sha256', process.env.CHATTING_SIGNING_SECRET)\n    .update(\`\${ts}.\${req.body}\`).digest('hex');\n  const fresh = Math.abs(Date.now() / 1000 - Number(ts)) < 300;\n  if (!fresh || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return res.sendStatus(401);\n\n  const event = JSON.parse(req.body);\n  res.sendStatus(200);            // answer fast, then do the work\n  handle(event).catch(console.error);\n});\napp.listen(3000);` },
      { label: 'Python (Flask)', lang: 'python', code: `import hmac, hashlib, os, time\nfrom flask import Flask, request, abort\n\napp = Flask(__name__)\nSECRET = os.environ["CHATTING_SIGNING_SECRET"].encode()\n\n@app.post("/chatting")\ndef hook():\n    ts = request.headers.get("x-chatting-timestamp", "0")\n    sig = request.headers.get("x-chatting-signature", "").removeprefix("v1=")\n    raw = request.get_data()\n    expected = hmac.new(SECRET, f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()\n    if abs(time.time() - int(ts)) > 300 or not hmac.compare_digest(sig, expected):\n        abort(401)\n    event = request.get_json()\n    handle(event)\n    return "", 200` },
    ]} /></div>
    <H3 id="polling">Polling loop</H3>
    <Code lang="js" className="mt-3" code={`let cursor = Number(await loadCursor() ?? 0);\nwhile (true) {\n  const { events, cursor: next } = await call('events.poll', { after: cursor, limit: 100 });\n  for (const e of events) await handle(e.payload);\n  cursor = next; await saveCursor(cursor);\n  if (!events.length) await new Promise((r) => setTimeout(r, 2000));\n}`} />
  </>);
}

export function ReadyMade() {
  return (<>
    <H2 id="ready-made">Ready-made bots</H2>
    <P>These need no code. Add them from <b>Settings → Bots → Add bot</b> and set them up in the panel.</P>
    <Table head={['bot', 'what it does', 'commands']} rows={[
      ['👋 Welcome', 'Greets new members ({user}, {community}), gives starter roles, and can add an “Accept rules ✅” button', '—'],
      ['🛡️ Mod', 'Deletes invite links, links, blocked words, repeated-character spam and mass mentions. Warns the author and times them out after N warnings', '—'],
      ['⭐ Level', 'Congratulates members at each level (level n = 5·n² messages)', '—'],
      ['🎁 Giveaway', 'Giveaways with an Enter button and random winners, plus quick polls', <C key="g">/giveaway 2h 3w Prize</C>],
      ['⏰ Reminder', 'Personal reminders posted back in the channel', <C key="r">/remind me 2h check the oven</C>],
    ]} />
  </>);
}

export function Recipes({ url }: { url: string }) {
  return (<>
    <H2 id="recipes">Recipes & use cases</H2>

    <H3 id="recipe-roles">Self-serve role picker (no server needed)</H3>
    <P>Post this once, for example from a script. Members pick roles from the dropdown and role-gated channels unlock instantly.</P>
    <Code lang="json" className="mt-3" code={`{ "op": "messages.send", "params": {\n  "channelId": "WELCOME_CHANNEL",\n  "embeds": [{ "title": "Pick your interests", "description": "Choose as many as you like — you can change them any time.", "color": "#2563eb" }],\n  "components": [[{ "type": "select", "id": "roles", "placeholder": "Your interests", "maxValues": 5,\n    "options": [\n      { "label": "Design",  "value": "ROLE_ID_DESIGN",  "emoji": "🎨" },\n      { "label": "Code",    "value": "ROLE_ID_CODE",    "emoji": "💻" },\n      { "label": "Music",   "value": "ROLE_ID_MUSIC",   "emoji": "🎵" }\n    ] }]]\n} }`} />

    <H3 id="recipe-commands">A “!command” bot</H3>
    <Code lang="js" className="mt-3" code={`async function handle(event) {\n  if (event.type !== 'MESSAGE_CREATE') return;\n  const { body, channelId, messageId, userId } = event.data;\n  const [cmd, ...args] = body.trim().split(/\\s+/);\n\n  if (cmd === '!ping') return call('messages.send', { channelId, content: 'pong 🏓', replyToId: messageId });\n  if (cmd === '!roll') return call('messages.send', { channelId, content: \`🎲 \${1 + Math.floor(Math.random() * Number(args[0] || 6))}\` });\n  if (cmd === '!whois') {\n    const m = await call('members.get', { userId });\n    return call('messages.send', { channelId, embeds: [{ title: m.name, fields: [\n      { name: 'Roles', value: m.roles.length ? m.roles.join(', ') : 'none', inline: true },\n      { name: 'Warnings', value: String(m.warnings), inline: true },\n    ] }] });\n  }\n}`} />

    <H3 id="recipe-buttons">Approval flow with buttons</H3>
    <Code lang="js" className="mt-3" code={`// 1. Post a request with two buttons\nawait call('messages.send', { channelId, embeds: [{ title: 'Time-off request', description: 'Ava · Oct 24–26' }],\n  components: [[{ type: 'button', id: 'approve:ava-123', label: 'Approve', style: 'success' },\n                { type: 'button', id: 'deny:ava-123',    label: 'Deny',    style: 'danger' }]] });\n\n// 2. React to clicks (INTERACTION_CREATE) by editing the card in place\nasync function handle(e) {\n  if (e.type !== 'INTERACTION_CREATE') return;\n  const [action, id] = e.data.componentId.split(':');\n  await call('interactions.respond', { interactionId: e.id, type: 'update',\n    embeds: [{ title: 'Time-off request', description: \`\${action === 'approve' ? '✅ Approved' : '❌ Denied'} by \${e.data.userName}\` }],\n    components: [] });\n}`} />

    <H3 id="recipe-github">GitHub commits feed</H3>
    <P>In GitHub, add a webhook pointing at a small server of yours, then forward each push into a channel:</P>
    <Code lang="js" className="mt-3" code={`app.post('/github', express.json(), async (req, res) => {\n  res.sendStatus(200);\n  if (req.header('x-github-event') !== 'push') return;\n  const { repository, commits, pusher, compare } = req.body;\n  await call('messages.send', { channelId: process.env.DEV_CHANNEL, embeds: [{\n    title: \`\${commits.length} new commit\${commits.length === 1 ? '' : 's'} to \${repository.full_name}\`,\n    url: compare, color: '#24292f', author: { name: pusher.name },\n    description: commits.slice(0, 5).map((c) => \`[\\\`\${c.id.slice(0, 7)}\\\`](\${c.url}) \${c.message.split('\\n')[0]}\`).join('\\n'),\n  }] });\n});`} />

    <H3 id="recipe-mod">Custom moderation</H3>
    <Code lang="python" className="mt-3" code={`SLURS = {"badword1", "badword2"}\n\ndef handle(event):\n    if event["type"] != "MESSAGE_CREATE":\n        return\n    d = event["data"]\n    if any(w in d["body"].lower() for w in SLURS):\n        call("messages.delete", messageId=d["messageId"], reason="slur filter")\n        warns = call("members.warn", userId=d["userId"], reason="Used a blocked word")["warnings"]\n        if warns >= 3:\n            call("members.timeout", userId=d["userId"], minutes=60, reason="3 warnings")`} />

    <H3 id="recipe-digest">Daily digest from a cron job</H3>
    <Code lang="bash" className="mt-3" code={`# crontab: 0 9 * * *  /usr/local/bin/digest.sh\ncurl -s -X POST '${url}' -H 'content-type: application/json' -d "{\n  \\"token\\": \\"$CHATTING_TOKEN\\", \\"op\\": \\"messages.send\\",\n  \\"params\\": { \\"channelId\\": \\"$CHANNEL\\", \\"content\\": \\"☀️ Good morning! Today: $(date +%A)\\" }\n}"`} />

    <H3 id="more-ideas">More ideas</H3>
    <ul className="mt-3 grid list-disc gap-1 pl-5 leading-7 text-muted-foreground sm:grid-cols-2">
      <li>Support tickets: a button that opens a thread for each request</li><li>Trivia games with dropdown answers and a leaderboard</li>
      <li>Uptime and CI alerts as coloured embeds</li><li>RSS or blog-post announcements</li>
      <li>Starboard: repost messages with 5+ ⭐ reactions</li><li>Onboarding quizzes that grant a role when passed</li>
      <li>Event sign-ups with “Going / Maybe” buttons</li><li>Translation, summaries or FAQ answers from your own backend</li>
    </ul>
  </>);
}
