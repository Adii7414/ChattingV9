import { format } from 'date-fns';
import type { Msg } from './messages';

/** Downloads the loaded conversation as a plain-text transcript. */
export function exportChat(title: string, messages: Msg[], nameOf: (userId: string) => string) {
  const lines = messages.filter((m) => !m.pending).map((m) => {
    const parts = [m.body];
    if (m.poll) parts.push(`[Poll] ${m.poll.question} — ${m.poll.options.map((o) => `${o.text} (${o.votes.length})`).join(', ')}`);
    m.attachments.forEach((a) => parts.push(`[Attachment] ${a.name}: ${a.url}`));
    return `[${format(new Date(m.sentAt), 'yyyy-MM-dd HH:mm')}] ${nameOf(m.senderId)}: ${parts.filter(Boolean).join('\n    ')}${m.editedAt ? ' (edited)' : ''}`;
  });
  const text = `Chat export — ${title}\nExported ${format(new Date(), 'PPpp')} · ${lines.length} messages\n\n${lines.join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${title.replace(/[^\w\s-]/g, '').trim() || 'chat'}-${format(new Date(), 'yyyy-MM-dd')}.txt` });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
