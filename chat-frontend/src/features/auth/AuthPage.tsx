import {useState, type FormEvent} from "react";

import {useNavigate} from "react-router";

import {Button, cn, LingxiLogo, TextField} from "@infinitechat/design-system";

type Mode = "password" | "code";

const TRUST = [
  {title: "发送前预览", desc: "重要的消息,发出去之前先看一眼。"},
  {title: "内容不丢失", desc: "关键的上下文会被妥善保留。"},
  {title: "继续前确认", desc: "需要确认的动作,灵犀会先问你。"},
];

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("password");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Mock sign-in. P2 wires POST /api/v1/user/{login,loginCode} + token storage.
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-2">
        {/* Account-first: the form is the primary surface (DESIGN.md). */}
        <div className="order-1 w-full max-w-sm justify-self-center lg:justify-self-start">
          <LingxiLogo variant="lockup" className="mb-6" />
          <h1 className="text-xl font-semibold tracking-[-0.02em]">登录灵犀</h1>
          <p className="mt-1 text-sm text-muted">懂你的,不只是消息。</p>

          {/* Mode segmented control — one quiet control (DESIGN.md). */}
          <div className="mt-5 inline-flex rounded-xl border border-separator bg-surface p-0.5">
            {(["password", "code"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-[0.625rem] px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
                  mode === m ? "bg-[var(--lx-accent)] text-white" : "text-muted hover:text-foreground",
                )}
              >
                {m === "password" ? "密码登录" : "验证码登录"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <TextField
              type="email"
              label="邮箱"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            {mode === "password" ? (
              <TextField
                type="password"
                label="密码"
                placeholder="输入密码"
                autoComplete="current-password"
                required
              />
            ) : (
              <TextField
                inputMode="numeric"
                label="验证码"
                placeholder="6 位验证码"
                hint="我们会把验证码发到你的邮箱"
                required
              />
            )}

            {/* Keep secondary options on one compact row (DESIGN.md). */}
            <div className="flex items-center justify-between text-[0.8125rem]">
              <label className="inline-flex items-center gap-2 text-muted">
                <input type="checkbox" defaultChecked className="accent-[var(--lx-accent)]" />
                保持登录
              </label>
              <button type="button" className="text-[var(--lx-accent)] hover:underline">
                忘记密码?
              </button>
            </div>

            <Button type="submit" block size="lg">
              登录
            </Button>

            {mode === "password" ? (
              <button
                type="button"
                onClick={() => setMode("code")}
                className="block w-full text-center text-[0.8125rem] text-muted hover:text-foreground"
              >
                用邮箱验证码登录
              </button>
            ) : null}
          </form>
        </div>

        {/* Product explanation follows the form. Open three-cell strip, not cards. */}
        <div className="order-2 w-full max-w-sm justify-self-center lg:max-w-md lg:justify-self-end">
          <div className="overflow-hidden rounded-[var(--lx-radius-panel-lg)] border border-separator">
            {TRUST.map((t, i) => (
              <div key={t.title} className={cn("px-5 py-4", i > 0 && "border-t border-separator")}>
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[var(--lx-accent)]" aria-hidden="true" />
                  <span className="text-sm font-medium">{t.title}</span>
                </div>
                <p className="mt-1 pl-3.5 text-[0.8125rem] leading-relaxed text-muted">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
