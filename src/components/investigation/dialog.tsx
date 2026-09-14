'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';
export function Dialog({ title, onClose, children, opener }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
    opener?: HTMLElement | null;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    useEffect(() => {
        // Effect restarts must not replace the opener with the dialog's own Close button.
        if (!dialog.current?.open) {
            returnFocus.current = opener ?? document.activeElement as HTMLElement | null;
            dialog.current?.showModal();
        }
        return () => { requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }); };
    }, [opener]);
    return <dialog ref={dialog} className="workspace-dialog" aria-labelledby="dialog-title" onKeyDown={e => {
        if (e.key !== 'Tab') return;
        const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])')).filter(el => el.checkVisibility());
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget)
        onClose(); }}>
    <header className="dialog-heading"><div><span className="eyebrow">Signal 1 / Investigation</span><h2 id="dialog-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose} autoFocus><Icon name="close"/></button></header><div className="dialog-content">{children}</div>
  </dialog>;
}
