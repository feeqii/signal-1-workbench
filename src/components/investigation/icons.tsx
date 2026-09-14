import type { SVGProps } from 'react';
const paths = {
    molecule: <><path d="m8 5 8 2 3 8-7 5-8-5zM8 5l4 7m4-5-4 5m7 3-7-3m0 8v-8m-8 3 8-3"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="19" cy="15" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="4" cy="15" r="2"/></>,
    compare: <><path d="M7 3v18M17 3v18M3 7l4-4 4 4M13 17l4 4 4-4"/></>,
    assays: <><path d="M4 3v17h17"/><circle cx="8" cy="14" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="19" cy="5" r="1"/></>,
    notebook: <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M3 7h4M3 12h4M3 17h4M12 8h5M12 12h5"/></>,
    sources: <><path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4zM12 6v15"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    chevron: <path d="m8 5 7 7-7 7"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    focus: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/><circle cx="12" cy="12" r="3"/></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></>,
    settings: <><path d="M3 7h18M3 17h18"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    layers: <><path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/></>,
};
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & {
    name: keyof typeof paths;
}) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
