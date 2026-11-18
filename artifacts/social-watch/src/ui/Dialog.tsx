import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { X } from 'lucide-react';

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  wide?: boolean;
  tabs?: ComponentChildren;
  id?: string;
}

export function Dialog({ title, onClose, children, footer, wide, tabs, id = 'dialog' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelectorAll<HTMLElement>(FOCUSABLE)[1] ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const a = items[0]!, z = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} data-testid={`dialog-${id}`}>
        <div className="dialog-head">
          <h2 id={`${id}-title`}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X /></button>
        </div>
        {tabs}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirmLabel, danger, onConfirm, onClose, requireText }: {
  title: string; body: ComponentChildren; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void; requireText?: string;
}) {
  const typed = useRef('');
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <Dialog title={title} onClose={onClose} id="confirm"
      footer={<>
        <button className="btn" onClick={onClose} data-testid="button-cancel">Cancel</button>
        <button ref={btn} className={`btn ${danger ? 'danger' : 'primary'}`} disabled={!!requireText}
          onClick={() => { onConfirm(); onClose(); }} data-testid="button-confirm">{confirmLabel}</button>
      </>}>
      <div>{body}</div>
      {requireText && (
        <label className="field">
          <span>Type <span className="kbd">{requireText}</span> to confirm</span>
          <input className="input" data-autofocus autoComplete="off" data-testid="input-confirm-text"
            onInput={(e) => { typed.current = (e.target as HTMLInputElement).value; if (btn.current) btn.current.disabled = typed.current !== requireText; }} />
        </label>
      )}
    </Dialog>
  );
}
