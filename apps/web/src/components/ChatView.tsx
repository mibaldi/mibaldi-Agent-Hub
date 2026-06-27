import { useEffect, useRef, useState } from 'react';
import type { TerminalConnection } from '../terminalConnection';

interface Msg {
  who: 'user' | 'agent';
  text: string;
}

// Quita secuencias de escape ANSI para una lectura más cómoda en el chat.
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
}

export function ChatView({ conn, visible }: { conn: TerminalConnection; visible: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef('');
  const flushTimer = useRef<number | null>(null);

  useEffect(() => {
    // Acumula la salida y la vuelca como mensajes "agent" cada poco tiempo.
    const off = conn.onData((data) => {
      bufferRef.current += stripAnsi(data);
      if (flushTimer.current) return;
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null;
        const text = bufferRef.current.trimEnd();
        bufferRef.current = '';
        if (!text) return;
        setMessages((m) => [...m, { who: 'agent', text }]);
      }, 400);
    });
    return off;
  }, [conn]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { who: 'user', text: input }]);
    conn.input(input + '\r');
    setInput('');
  };

  return (
    <div className="chat" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 && (
          <div className="empty">Vista chat. La salida del agente aparecerá aquí en texto legible.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.who}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
          placeholder="Escribe y pulsa Enter…"
          autoCapitalize="none"
        />
        <button className="primary" onClick={sendMessage}>
          Enviar
        </button>
      </div>
    </div>
  );
}
