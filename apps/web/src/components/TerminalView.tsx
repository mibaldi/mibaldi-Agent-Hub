import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { TerminalConnection } from '../terminalConnection';

export function TerminalView({ conn, visible }: { conn: TerminalConnection; visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#000000', foreground: '#e2e8f0' },
      scrollback: 5000,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    termRef.current = term;
    fitRef.current = fit;

    try {
      fit.fit();
      conn.resize(term.cols, term.rows);
    } catch {
      /* noop */
    }

    // Salida del servidor -> terminal.
    const offData = conn.onData((data) => term.write(data));
    // Entrada del usuario -> servidor.
    const offInput = term.onData((data) => conn.input(data));

    const onResize = () => {
      try {
        fit.fit();
        conn.resize(term.cols, term.rows);
      } catch {
        /* noop */
      }
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(containerRef.current);

    return () => {
      offData();
      offInput.dispose();
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al hacerse visible, reajustar (el contenedor pudo cambiar de tamaño).
  useEffect(() => {
    if (visible && fitRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitRef.current!.fit();
          conn.resize(termRef.current!.cols, termRef.current!.rows);
          termRef.current!.focus();
        } catch {
          /* noop */
        }
      }, 50);
    }
  }, [visible, conn]);

  return (
    <div className="xterm-wrap" ref={containerRef} style={{ display: visible ? 'block' : 'none' }} />
  );
}
