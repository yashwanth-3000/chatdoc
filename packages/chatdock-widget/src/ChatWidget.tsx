import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import type { ChatWidgetProps, ChatMessage } from './types';

const PANEL_DIMS = {
  compact:  { width: 320, height: 480 },
  standard: { width: 380, height: 560 },
  wide:     { width: 440, height: 600 },
};

const SHADOW_MAP = {
  soft: '0 4px 20px rgba(0,0,0,0.10)',
  deep: '0 12px 48px rgba(0,0,0,0.22)',
  flat: 'none',
};

function positionStyles(position: string): CSSProperties {
  const base: CSSProperties = { position: 'fixed', zIndex: 9999 };
  if (position === 'bottom-right') return { ...base, bottom: 24, right: 24 };
  if (position === 'bottom-left')  return { ...base, bottom: 24, left: 24 };
  if (position === 'top-right')    return { ...base, top: 24, right: 24 };
  if (position === 'top-left')     return { ...base, top: 24, left: 24 };
  return { ...base, bottom: 24, right: 24 };
}

function panelOriginStyle(position: string): CSSProperties {
  if (position === 'bottom-left')  return { bottom: 80, left: 0 };
  if (position === 'top-right')    return { top: 80, right: 0 };
  if (position === 'top-left')     return { top: 80, left: 0 };
  return { bottom: 80, right: 0 };
}

function TypingDots({ color }: { color: string }) {
  const dot: CSSProperties = {
    width: 7, height: 7, borderRadius: '50%', backgroundColor: color,
    display: 'inline-block', margin: '0 2px',
    animation: 'chatdock-bounce 1.2s infinite ease-in-out',
  };
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 2px' }}>
      <style>{`
        @keyframes chatdock-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
      <span style={{ ...dot, animationDelay: '0s' }} />
      <span style={{ ...dot, animationDelay: '0.2s' }} />
      <span style={{ ...dot, animationDelay: '0.4s' }} />
    </span>
  );
}

export function ChatWidget({
  config,
  onMessage,
  position = 'bottom-right',
  defaultOpen = false,
}: ChatWidgetProps) {
  const { content, theme, behavior } = config;
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: 'assistant', text: content.greeting },
  ]);
  const [chipsVisible, setChipsVisible] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const dims = PANEL_DIMS[behavior.panelSize];
  const shadow = SHADOW_MAP[behavior.shadow];
  const radius = theme.cornerRadius;

  const panelBg = (() => {
    if (theme.surfaceStyle === 'glass') return theme.panelColor + 'cc'; // ~80%
    if (theme.surfaceStyle === 'matte') return theme.panelColor + 'f7'; // ~97%
    return theme.panelColor;
  })();

  const panelExtra: CSSProperties =
    theme.surfaceStyle === 'glass'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {};

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setChipsVisible(false);
    const userMsg: ChatMessage = { id: Date.now(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    let reply: string;
    try {
      reply = onMessage
        ? await onMessage(trimmed)
        : 'Gateway not connected. Add a gateway config to enable live responses.';
    } catch {
      reply = 'Something went wrong. Please try again.';
    }

    setTyping(false);
    setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', text: reply }]);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  const wrapStyle: CSSProperties = { ...positionStyles(position), display: 'flex', flexDirection: 'column', alignItems: 'flex-end' };

  const panelStyle: CSSProperties = {
    ...panelOriginStyle(position),
    position: 'absolute',
    width: dims.width,
    height: dims.height,
    borderRadius: radius,
    background: panelBg,
    boxShadow: shadow,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'opacity 0.22s ease, transform 0.22s ease',
    opacity: open ? 1 : 0,
    transform: open ? 'translateY(0)' : 'translateY(16px)',
    pointerEvents: open ? 'auto' : 'none',
    ...panelExtra,
  };

  const headerStyle: CSSProperties = {
    background: theme.accentColor,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  };

  const messagesStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const inputRowStyle: CSSProperties = {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: `1px solid rgba(0,0,0,0.07)`,
    flexShrink: 0,
    background: panelBg,
    ...panelExtra,
  };

  const inputStyle: CSSProperties = {
    flex: 1,
    border: `1.5px solid ${theme.accentColor}44`,
    borderRadius: radius * 0.6,
    padding: '8px 12px',
    fontSize: 14,
    outline: 'none',
    background: 'transparent',
    color: theme.userTextColor,
    fontFamily: 'inherit',
  };

  const sendBtnStyle: CSSProperties = {
    background: theme.accentColor,
    color: '#fff',
    border: 'none',
    borderRadius: radius * 0.6,
    padding: '8px 16px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    fontFamily: 'inherit',
    opacity: input.trim() ? 1 : 0.55,
    transition: 'opacity 0.15s',
  };

  const launcherStyle: CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: theme.launcherColor,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    flexShrink: 0,
    transition: 'transform 0.15s ease',
    color: '#fff',
    fontSize: 24,
  };

  const chipStyle: CSSProperties = {
    background: theme.accentColor + '18',
    color: theme.accentColor,
    border: `1px solid ${theme.accentColor}44`,
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'background 0.12s',
  };

  function Bubble({ msg }: { msg: ChatMessage }) {
    const isUser = msg.role === 'user';
    const bubbleStyle: CSSProperties = {
      maxWidth: '82%',
      padding: '9px 13px',
      borderRadius: radius * 0.7,
      fontSize: 14,
      lineHeight: 1.5,
      wordBreak: 'break-word',
      background: isUser ? theme.userBubbleColor : theme.messageColor,
      color: isUser ? theme.userTextColor : theme.messageTextColor,
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    };
    return <div style={bubbleStyle}>{msg.text}</div>;
  }

  return (
    <div style={wrapStyle}>
      <div style={panelStyle} aria-hidden={!open}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'inherit' }}>
            {content.assistantName}
          </span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 2, opacity: 0.85 }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div style={messagesStyle}>
          {messages.map((msg) => <Bubble key={msg.id} msg={msg} />)}

          {/* Sub-greeting below first assistant bubble */}
          {content.subGreeting && messages.length === 1 && (
            <div style={{ fontSize: 13, color: theme.accentColor, alignSelf: 'flex-start', paddingLeft: 4, opacity: 0.8 }}>
              {content.subGreeting}
            </div>
          )}

          {/* Suggested action chips */}
          {chipsVisible && content.suggestedActions && content.suggestedActions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
              {content.suggestedActions.map((a, i) => (
                <button key={i} style={chipStyle} onClick={() => send(a.prompt)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Typing indicator */}
          {typing && (
            <div style={{
              alignSelf: 'flex-start',
              background: theme.messageColor,
              borderRadius: radius * 0.7,
              padding: '8px 14px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            }}>
              <TypingDots color={theme.messageTextColor} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div style={inputRowStyle}>
          <input
            ref={inputRef}
            style={inputStyle}
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={typing}
            aria-label="Chat message input"
          />
          <button
            style={sendBtnStyle}
            onClick={() => send(input)}
            disabled={typing || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </div>

      {/* Launcher */}
      <button
        style={launcherStyle}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : content.launcherLabel}
        title={content.launcherLabel}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
