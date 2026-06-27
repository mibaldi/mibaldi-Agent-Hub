import type { ClientTerminalMessage, ServerTerminalMessage } from '@mah/shared';
import { terminalWsUrl } from './api';

type DataListener = (data: string) => void;
type StatusListener = (status: ConnStatus) => void;
export type ConnStatus = 'connecting' | 'connected' | 'disconnected';

// Gestiona el WebSocket de terminal y lo comparte entre la vista xterm y el chat.
// Reconecta automáticamente; cerrar la pestaña hace detach (no mata tmux).
export class TerminalConnection {
  private ws: WebSocket | null = null;
  private dataListeners = new Set<DataListener>();
  private statusListeners = new Set<StatusListener>();
  private cols = 80;
  private rows = 24;
  private manualClose = false;
  private reconnectTimer: number | null = null;
  status: ConnStatus = 'disconnected';

  constructor(private projectId: string) {}

  setSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
  }

  connect(): void {
    this.manualClose = false;
    this.open();
  }

  private open(): void {
    this.setStatus('connecting');
    const ws = new WebSocket(terminalWsUrl(this.projectId, this.cols, this.rows));
    this.ws = ws;

    ws.onopen = () => this.setStatus('connected');
    ws.onmessage = (ev) => {
      let msg: ServerTerminalMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'data') this.dataListeners.forEach((l) => l(msg.data));
      else if (msg.type === 'error') this.dataListeners.forEach((l) => l(`\r\n\x1b[31m[error] ${msg.message}\x1b[0m\r\n`));
      else if (msg.type === 'exit') this.dataListeners.forEach((l) => l(`\r\n\x1b[33m[sesión cerrada]\x1b[0m\r\n`));
    };
    ws.onclose = () => {
      this.setStatus('disconnected');
      if (!this.manualClose) this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manualClose) this.open();
    }, 1500);
  }

  private setStatus(s: ConnStatus): void {
    this.status = s;
    this.statusListeners.forEach((l) => l(s));
  }

  send(msg: ClientTerminalMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  input(data: string): void {
    this.send({ type: 'input', data });
  }

  resize(cols: number, rows: number): void {
    this.setSize(cols, rows);
    this.send({ type: 'resize', cols, rows });
  }

  onData(l: DataListener): () => void {
    this.dataListeners.add(l);
    return () => this.dataListeners.delete(l);
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  // Cierra la conexión SIN matar tmux (solo detach del lado servidor).
  close(): void {
    this.manualClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
