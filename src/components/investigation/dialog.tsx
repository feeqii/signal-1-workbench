'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';
export function Dialog({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const prior = document.activeElement as HTMLElement | null;
        dialog.current?.showModal();
        return () => { prior?.focus({ preventScroll: true }); };
    }, []);
    return <dialog ref={dialog} className="workspace-dialog" aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget)
        onClose(); }}>
    <div className="dialog-content"><header className="dialog-heading"><div><span className="eyebrow">Signal 1 / Investigation</span><h2 id="dialog-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose} autoFocus><Icon name="close"/></button></header>{children}</div>
  </dialog>;
}
