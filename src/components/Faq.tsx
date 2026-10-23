import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@project/components/ui/accordion';
import { SectionHead } from './ui';

const faqs = [
  ['Is Chatting free?', 'Yes. Direct messages, groups, threads, communities and file sharing are free for everyone.'],
  ['Can anyone read my messages?', 'Only members of a conversation can open it. Messages are encrypted in transit and at rest, we never sell your data or show ads, and you control your online status and read receipts.'],
  ['Which devices does it work on?', 'Any modern browser — phone, tablet or laptop. Your conversations stay in sync across all of them.'],
  ['When can I start using it?', 'Right now. Sign in with your email — no password needed — and start a chat, group or community in seconds.'],
];

export default function Faq() {
  return (
    <section id="faq" className="section-y scroll-mt-20 mx-auto max-w-3xl px-5 sm:px-6">
      <SectionHead center eyebrow="FAQ" title={<>Questions? <span className="text-muted-foreground">Answers.</span></>} body="Everything you might want to know before you start." />
      <Accordion type="single" collapsible className="mt-14">
        {faqs.map(([q, a]) => (
          <AccordionItem key={q} value={q} className="border-b border-border">
            <AccordionTrigger className="py-6 text-left text-lg font-medium hover:no-underline">{q}</AccordionTrigger>
            <AccordionContent className="pb-6 text-base text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
