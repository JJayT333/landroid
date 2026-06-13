/**
 * Canvas keyboard shortcuts — undo/redo, delete, select all, zoom.
 *
 * Uses a single keydown listener that reads from the canvas store
 * via getState() so the effect never needs to re-register.
 */
import { useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useCanvasStore } from '../store/canvas-store';

export default function useCanvasKeyboardShortcuts() {
  const rf = useReactFlow();
  const rfRef = useRef(rf);
  rfRef.current = rf;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      const meta = e.metaKey || e.ctrlKey;
      const s = useCanvasStore.getState();

      // Ctrl+Z — Undo
      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — Redo
      if ((meta && e.key === 'z' && e.shiftKey) || (meta && e.key === 'y')) {
        e.preventDefault();
        s.redo();
        return;
      }

      // Delete / Backspace — Delete selected elements
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const nodeIds = s.nodes.filter((n) => n.selected).map((n) => n.id);
        const edgeIds = s.edges.filter((ed) => ed.selected).map((ed) => ed.id);
        if (nodeIds.length > 0 || edgeIds.length > 0) {
          s.pushHistory();
          s.removeElements(nodeIds, edgeIds);
        }
        return;
      }

      // Ctrl+A — Select all
      if (meta && e.key === 'a') {
        e.preventDefault();
        s.selectAll();
        return;
      }

      // Ctrl+C — Copy selection
      if (meta && e.key === 'c') {
        s.copySelection();
        return;
      }

      // Ctrl+V — Paste
      if (meta && e.key === 'v') {
        e.preventDefault();
        s.paste();
        return;
      }

      // Ctrl+D — Duplicate selection in place
      if (meta && e.key === 'd') {
        e.preventDefault();
        s.duplicateSelection();
        return;
      }

      // Ctrl+] / Ctrl+[ — Bring to front / send to back
      if (meta && (e.key === ']' || e.key === '[')) {
        e.preventDefault();
        const ids = s.nodes.filter((n) => n.selected).map((n) => n.id);
        if (ids.length > 0) {
          if (e.key === ']') s.bringToFront(ids);
          else s.sendToBack(ids);
        }
        return;
      }

      // Escape — Deselect, reset tool
      if (e.key === 'Escape') {
        s.deselectAll();
        s.setActiveTool('select');
        return;
      }

      // Ctrl+0 — Fit view
      if (meta && e.key === '0') {
        e.preventDefault();
        rfRef.current.fitView({ padding: 0.1, duration: 300 });
        return;
      }

      // Ctrl+= / Ctrl++ — Zoom in
      if (meta && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        rfRef.current.zoomIn({ duration: 200 });
        return;
      }

      // Ctrl+- — Zoom out
      if (meta && e.key === '-') {
        e.preventDefault();
        rfRef.current.zoomOut({ duration: 200 });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
