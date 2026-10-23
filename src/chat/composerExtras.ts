export const SHORTCODES: Record<string, string> = {
  smile: '😄', grin: '😁', joy: '😂', rofl: '🤣', wink: '😉', blush: '😊', heart_eyes: '😍', kiss: '😘', thinking: '🤔', neutral: '😐',
  eyeroll: '🙄', sleepy: '😴', cool: '😎', cry: '😢', sob: '😭', angry: '😠', scream: '😱', party: '🥳', skull: '💀', clown: '🤡',
  heart: '❤️', fire: '🔥', thumbsup: '👍', '+1': '👍', thumbsdown: '👎', clap: '👏', pray: '🙏', wave: '👋', muscle: '💪', eyes: '👀',
  tada: '🎉', star: '⭐', sparkles: '✨', check: '✅', x: '❌', warning: '⚠️', rocket: '🚀', '100': '💯', ok: '👌', shrug: '🤷',
  coffee: '☕', tea: '🍵', beer: '🍺', wine: '🍷', burger: '🍔', taco: '🌮', sushi: '🍣', donut: '🍩', icecream: '🍦', apple: '🍎',
  soccer: '⚽', basketball: '🏀', trophy: '🏆', medal: '🥇', game: '🎮', music: '🎵', guitar: '🎸', art: '🎨', book: '📚', bulb: '💡',
  money: '💰', gift: '🎁', balloon: '🎈', crown: '👑', gem: '💎', zap: '⚡', snow: '❄️', flower: '🌸', tree: '🌳', earth: '🌍',
  salute: '🫡', melt: '🫠', hug: '🤗', nerd: '🤓', facepalm: '🤦', mindblown: '🤯', sweat: '😅', upside: '🙃', hearthands: '🫶', handshake: '🤝',
  coffee2: '☕', pizza: '🍕', cake: '🎂', sun: '☀️', moon: '🌙', rainbow: '🌈', poop: '💩', ghost: '👻', robot: '🤖', cat: '🐱', dog: '🐶',
};

export const SLASH: { cmd: string; desc: string; run: (rest: string) => string; confetti?: boolean }[] = [
  { cmd: '/shrug', desc: 'Append ¯\\_(ツ)_/¯', run: (r) => `${r} ¯\\_(ツ)_/¯`.trim() },
  { cmd: '/tableflip', desc: '(╯°□°)╯︵ ┻━┻', run: (r) => `${r} (╯°□°)╯︵ ┻━┻`.trim() },
  { cmd: '/unflip', desc: '┬─┬ノ( º _ ºノ)', run: (r) => `${r} ┬─┬ノ( º _ ºノ)`.trim() },
  { cmd: '/lenny', desc: '( ͡° ͜ʖ ͡°)', run: (r) => `${r} ( ͡° ͜ʖ ͡°)`.trim() },
  { cmd: '/confetti', desc: 'Send with a confetti burst 🎉', run: (r) => r || '🎉', confetti: true },
  { cmd: '/spoiler', desc: 'Hide text until tapped', run: (r) => `||${r || 'spoiler'}||` },
  { cmd: '/code', desc: 'Send as a code block', run: (r) => `\`\`\`\n${r}\n\`\`\`` },
  { cmd: '/roll', desc: 'Roll a die (e.g. /roll 20)', run: (r) => { const n = Math.max(2, Math.min(1000, parseInt(r) || 6)); return `🎲 rolled ${1 + Math.floor(Math.random() * n)} (d${n})`; } },
  { cmd: '/flip', desc: 'Flip a coin', run: () => `🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}!` },
  { cmd: '/8ball', desc: 'Ask the magic 8-ball', run: (r) => `🎱 ${r ? `“${r}” — ` : ''}${EIGHT[Math.floor(Math.random() * EIGHT.length)]}` },
  { cmd: '/pick', desc: 'Pick one: /pick pizza, tacos, sushi', run: (r) => { const o = r.split(',').map((x) => x.trim()).filter(Boolean); return o.length ? `🤔 I pick… **${o[Math.floor(Math.random() * o.length)]}**` : '🤔 Give me some options!'; } },
  { cmd: '/mock', desc: 'sPoNgEbOb TeXt', run: (r) => r.split('').map((ch, i) => (i % 2 ? ch.toUpperCase() : ch.toLowerCase())).join('') },
  { cmd: '/reverse', desc: 'Send text backwards', run: (r) => [...r].reverse().join('') },
  { cmd: '/time', desc: 'Share your local time', run: (r) => `🕒 It’s ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} for me ${r}`.trim() },
  { cmd: '/me', desc: 'Describe an action in italics', run: (r) => `_${r || 'waves'}_` },
];

const EIGHT = ['It is certain.', 'Without a doubt.', 'Yes, definitely.', 'Most likely.', 'Ask again later.', 'Cannot predict now.', 'Don’t count on it.', 'My sources say no.', 'Very doubtful.', 'Signs point to yes.'];

export function applySlash(body: string) {
  const m = /^(\/\w+)\s*([\s\S]*)$/.exec(body);
  const c = m && SLASH.find((s) => s.cmd === m[1].toLowerCase());
  if (!c || !m) return { body, confetti: false };
  return { body: c.run(m[2].trim()), confetti: !!c.confetti };
}

export const STICKERS: { name: string; items: string[] }[] = [
  { name: 'Moods', items: ['😂', '🥹', '😍', '🥳', '😎', '🤯', '😭', '😴', '🤔', '🙃', '😤', '🫠'] },
  { name: 'Love', items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '💖', '💘', '😘', '🥰', '🫶', '💌'] },
  { name: 'Animals', items: ['🐶', '🐱', '🦊', '🐼', '🐨', '🦁', '🐸', '🐵', '🦄', '🐙', '🦖', '🐧'] },
  { name: 'Food', items: ['🍕', '🍔', '🌮', '🍣', '🍜', '🍩', '🍪', '🧁', '🍦', '🍓', '🥑', '☕'] },
  { name: 'Sports & play', items: ['⚽', '🏀', '🏈', '🎾', '🏓', '🎮', '🎯', '🎳', '🏆', '🥇', '🛹', '🎲'] },
  { name: 'Hype', items: ['🔥', '🎉', '💯', '🚀', '👏', '🙌', '✨', '🏆', '⚡', '🤝', '💪', '👀'] },
];

export function confetti() { window.dispatchEvent(new Event('chat:confetti')); }
