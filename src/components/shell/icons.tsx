/**
 * Shell icon set — inline SVGs lifted verbatim from the Ledger Refined design
 * handoff (one 24×24 stroke icon per nav view, plus shell chrome glyphs).
 * Stroke-based so they inherit currentColor; no icon library (AGENTS: no new
 * deps without need).
 */
import type { ReactNode, SVGProps } from 'react';

function Stroke({
  children,
  size = 16,
  ...rest
}: SVGProps<SVGSVGElement> & { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export type ShellIconName =
  | 'deskMap'
  | 'leasehold'
  | 'flowchart'
  | 'runsheet'
  | 'documents'
  | 'owners'
  | 'research'
  | 'curative'
  | 'maps'
  | 'salesDeck'
  | 'federalLeasing';

const ICON_PATHS: Record<ShellIconName, ReactNode> = {
  deskMap: (
    <>
      <rect x="8" y="3" width="8" height="6" rx="1.5" />
      <rect x="2.5" y="15" width="8" height="6" rx="1.5" />
      <rect x="13.5" y="15" width="8" height="6" rx="1.5" />
      <path d="M12 9v3M6.5 15v-3h11v3" />
    </>
  ),
  leasehold: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5" />
      <path d="m4 13.5 8 4.5 8-4.5" />
    </>
  ),
  flowchart: (
    <>
      <rect x="3" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="16" width="7" height="5" rx="1.5" />
      <path d="M6.5 8v4.5h11V16" />
    </>
  ),
  runsheet: <path d="M4 6h16M4 12h16M4 18h10" />,
  documents: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  owners: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.6c2.1.8 3.5 2.9 3.5 5.4" />
    </>
  ),
  research: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  curative: (
    <>
      <path d="M12 2 4.5 5v6c0 5 3.2 8.7 7.5 11 4.3-2.3 7.5-6 7.5-11V5z" />
      <path d="m9 11.5 2.2 2.3L15.5 9" />
    </>
  ),
  maps: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  salesDeck: (
    <>
      <path d="M3 4h18" />
      <rect x="5" y="4" width="14" height="10" rx="1.5" />
      <path d="M12 14v3m-4 4 4-4 4 4" />
    </>
  ),
  federalLeasing: (
    <path d="M3 21h18M5 18v-7M10 18v-7M14 18v-7M19 18v-7M3 11l9-7 9 7z" />
  ),
};

export function ShellIcon({
  name,
  size,
}: {
  name: ShellIconName;
  size?: number;
}) {
  return <Stroke size={size}>{ICON_PATHS[name]}</Stroke>;
}

export function CollapseIcon({ size = 14 }: { size?: number }) {
  return <Stroke size={size}><path d="m11 17-5-5 5-5M18 17l-5-5 5-5" /></Stroke>;
}

export function ExpandIcon({ size = 15 }: { size?: number }) {
  return <Stroke size={size}><path d="m13 17 5-5-5-5M6 17l5-5-5-5" /></Stroke>;
}

export function DotsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="19" r="1.4" />
    </svg>
  );
}

export function UndoIcon({ size = 13 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </Stroke>
  );
}

export function RedoIcon({ size = 13 }: { size?: number }) {
  return (
    <Stroke size={size}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </Stroke>
  );
}
