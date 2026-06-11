/**
 * The ⋯ project-row menu (locked decision): Projects… / Save workspace /
 * Load workspace / Auto-export folder… / Demo Data ▸ — one dropdown instead
 * of the old Projects/File/Demo chips. Presentational: the Sidebar owns the
 * handlers, confirmation flows, and the hidden file input. "Demo Data ▸"
 * swaps the panel to its submenu in place (a 184px flyout has no room for a
 * second level).
 */
import { useState } from 'react';
import { isHostedMode } from '../../utils/deploy-env';
import HostedUserMenu from '../../auth/HostedUserMenu';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';

export interface ProjectMenuActions {
  onOpenProjects: () => void;
  onSaveWorkspace: () => void;
  onLoadWorkspace: () => void;
  onConfigureAutoExport: () => void;
  onDisableAutoExport: () => void;
  onLoadCombinatorial: () => void;
  onLoadVulcanMesa: () => void;
  onLoadSpringhill: () => void;
}

interface ProjectMenuProps extends ProjectMenuActions {
  /** Positioning classes for the flyout (expanded vs rail anchor). */
  className?: string;
  readOnly: boolean;
  seedLoading: boolean;
  showDemoDataMenu: boolean;
  autoExportEnabled: boolean;
  onClose: () => void;
}

function MenuItem({
  label,
  onClick,
  disabled = false,
  title,
  accent = false,
  trailing,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
  trailing?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-parchment-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${
        accent ? 'font-medium text-leather' : 'text-ink'
      }`}
    >
      {label}
      {trailing && <span className="text-ink-light">{trailing}</span>}
    </button>
  );
}

function Divider() {
  return <div className="mx-1.5 my-1 h-px bg-ledger-line" />;
}

export default function ProjectMenu({
  className = '',
  readOnly,
  seedLoading,
  showDemoDataMenu,
  autoExportEnabled,
  onClose,
  onOpenProjects,
  onSaveWorkspace,
  onLoadWorkspace,
  onConfigureAutoExport,
  onDisableAutoExport,
  onLoadCombinatorial,
  onLoadVulcanMesa,
  onLoadSpringhill,
}: ProjectMenuProps) {
  const [panel, setPanel] = useState<'main' | 'demo'>('main');
  const hostedMode = isHostedMode();
  const readOnlyTitle = readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined;
  const pick = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <div
      role="menu"
      className={`w-52 rounded-[10px] border border-ledger-line bg-parchment-light p-1.5 shadow-[0_12px_30px_rgba(45,33,20,0.16)] ${className}`}
    >
      {panel === 'main' ? (
        <>
          <MenuItem label="Projects…" onClick={pick(onOpenProjects)} />
          <Divider />
          <MenuItem label="Save workspace" onClick={pick(onSaveWorkspace)} />
          <MenuItem
            label="Load workspace"
            disabled={readOnly}
            title={readOnlyTitle}
            onClick={pick(onLoadWorkspace)}
          />
          <MenuItem
            label="Auto-export folder…"
            onClick={pick(onConfigureAutoExport)}
          />
          {autoExportEnabled && (
            <MenuItem
              label="Disable auto-export"
              onClick={pick(onDisableAutoExport)}
            />
          )}
          {showDemoDataMenu && (
            <>
              <Divider />
              <MenuItem
                label={seedLoading ? 'Loading demo…' : 'Demo Data'}
                accent
                trailing="▸"
                disabled={readOnly || seedLoading}
                title={readOnlyTitle}
                onClick={() => setPanel('demo')}
              />
            </>
          )}
          {hostedMode && (
            <>
              <Divider />
              <div className="px-1 py-0.5">
                <HostedUserMenu />
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <MenuItem label="‹ Back" onClick={() => setPanel('main')} />
          <Divider />
          <MenuItem
            label="Combinatorial — Raven Forest"
            disabled={readOnly || seedLoading}
            title={readOnlyTitle}
            onClick={pick(onLoadCombinatorial)}
          />
          <MenuItem
            label="Vulcan Mesa — Demo"
            disabled={readOnly || seedLoading}
            title={readOnlyTitle}
            onClick={pick(onLoadVulcanMesa)}
          />
          <MenuItem
            label="Dr. Elmore #1 Unit — Sample"
            disabled={readOnly || seedLoading}
            title={readOnlyTitle}
            onClick={pick(onLoadSpringhill)}
          />
        </>
      )}
    </div>
  );
}
