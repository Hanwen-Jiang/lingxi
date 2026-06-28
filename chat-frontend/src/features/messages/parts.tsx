// Reusable chat pieces shared by the IM conversation (ChatColumn) and the
// /assistant 灵犀 surface, so streaming bubbles + composer behave identically.
import {memo, useRef} from "react";

import {ImagePlus, Send, Square} from "lucide-react";

import {Avatar, Button, cn, DeliveryTick} from "@infinitechat/design-system";

import type {Message} from "@/api/types";
import {formatClock} from "@/lib/format";

/** Three pulsing dots — the assistant "thinking" indicator before the first token. */
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="img" aria-label="灵犀正在输入">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-current opacity-50"
          style={{animationDelay: `${i * 160}ms`}}
        />
      ))}
    </span>
  );
}

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  senderName: string;
  isGroup: boolean;
  showAvatar: boolean;
  onRetry: () => void;
}

/**
 * Memoized so that during assistant streaming only the growing bubble re-renders
 * (the others keep their message reference). The custom comparison ignores the
 * inline `onRetry` callback, which is recreated each render.
 */
export const MessageBubble = memo(
  MessageBubbleImpl,
  (a, b) =>
    a.message === b.message &&
    a.mine === b.mine &&
    a.showAvatar === b.showAvatar &&
    a.isGroup === b.isGroup &&
    a.senderName === b.senderName,
);

function MessageBubbleImpl({
  message,
  mine,
  senderName,
  isGroup,
  showAvatar,
  onRetry,
}: MessageBubbleProps) {
  if (message.kind === "system") {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-surface px-3 py-1 text-[0.6875rem] text-muted">
          {message.content}
        </span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <div className="w-8 shrink-0">
        {!mine && showAvatar ? <Avatar name={senderName} size="sm" /> : null}
      </div>
      <div className={cn("flex max-w-[68%] flex-col", mine ? "items-end" : "items-start")}>
        {isGroup && !mine && showAvatar ? (
          <span className="mb-0.5 px-1 text-[0.6875rem] text-muted">{senderName}</span>
        ) : null}
        {message.kind === "image" ? (
          <a
            href={message.content}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "block overflow-hidden rounded-2xl border border-separator",
              mine ? "rounded-br-md" : "rounded-bl-md",
              message.delivery === "sending" && "opacity-70",
            )}
          >
            <img
              src={message.content}
              alt="图片消息"
              className="max-h-60 max-w-[16rem] object-cover"
            />
          </a>
        ) : (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
              mine
                ? "rounded-br-md bg-[var(--lx-accent)] text-white"
                : "rounded-bl-md bg-surface text-foreground",
            )}
          >
            {message.streaming && !message.content ? (
              <ThinkingDots />
            ) : (
              <>
                {message.content}
                {message.streaming ? (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-3.5 w-px translate-y-[2px] animate-pulse bg-current align-baseline"
                  />
                ) : null}
              </>
            )}
          </div>
        )}
        {!message.streaming ? (
          <div className="mt-0.5 flex items-center gap-1 px-1 text-[0.625rem] text-muted">
            <span className="tabular-nums">{formatClock(message.createdAt)}</span>
            {mine ? <DeliveryTick state={message.delivery} onRetry={onRetry} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  streaming = false,
  onStop,
  onPickImage,
  placeholder = "输入消息,Enter 发送 · Shift+Enter 换行",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  streaming?: boolean;
  onStop?: () => void;
  /** When provided, shows an attach-image button; called with the picked file. */
  onPickImage?: (file: File) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="shrink-0 border-t border-separator p-3">
      <div className="flex items-end gap-2 rounded-2xl border border-separator bg-surface px-3 py-2 focus-within:border-[color-mix(in_oklch,var(--lx-accent)_45%,var(--separator))]">
        {onPickImage ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickImage(file);
                e.target.value = ""; // allow re-picking the same file
              }}
            />
            <Button
              size="sm"
              iconOnly
              variant="ghost"
              aria-label="发送图片"
              disabled={streaming}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="size-4" />
            </Button>
          </>
        ) : null}
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !streaming) {
              e.preventDefault();
              onSubmit();
              if (ref.current) ref.current.style.height = "auto";
            }
          }}
          placeholder={placeholder}
          aria-label="消息输入框"
          className="max-h-36 min-h-[1.5rem] flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted"
        />
        {streaming ? (
          <Button size="sm" iconOnly variant="secondary" aria-label="停止生成" onClick={onStop}>
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            iconOnly
            aria-label="发送"
            disabled={!value.trim()}
            onClick={() => {
              onSubmit();
              if (ref.current) ref.current.style.height = "auto";
            }}
          >
            <Send className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
