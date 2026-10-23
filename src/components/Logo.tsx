export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[17px] font-semibold tracking-[-0.04em] ${className}`}>
      <span aria-hidden className="relative h-5 w-5">
        <span className="absolute inset-0 rounded-full rounded-bl-[3px] bg-foreground" />
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full rounded-tr-[2px] bg-primary ring-2 ring-background" />
      </span>
      chatting
    </span>
  );
}
