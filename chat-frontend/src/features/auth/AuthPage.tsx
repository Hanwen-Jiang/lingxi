import {useEffect, useState, type FormEvent} from "react";

import {useNavigate} from "react-router";

import {Button, cn, LingxiLogo, TextField} from "@infinitechat/design-system";

import {useLogin, useLoginCode, useRegister, useSendMail} from "@/api/auth";

type View = "login" | "register";
type Mode = "password" | "code";

const TRUST = [
  {title: "发送前预览", desc: "重要的消息,发出去之前先看一眼。"},
  {title: "内容不丢失", desc: "关键的上下文会被妥善保留。"},
  {title: "继续前确认", desc: "需要确认的动作,灵犀会先问你。"},
];

/**
 * 灵犀 sign-in (D14 · 03-contracts §7.1) — email identity, no phone. Two login
 * methods (email+password / passwordless email code) plus email-code register.
 * Wired to the mock auth mutations; the real flow swaps only the api behind them.
 */
export function AuthPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const sendMail = useSendMail();
  const login = useLogin();
  const loginCode = useLoginCode();
  const register = useRegister();

  const needsCode = view === "register" || (view === "login" && mode === "code");
  const needsPassword = view === "register" || (view === "login" && mode === "password");
  const active = view === "register" ? register : mode === "password" ? login : loginCode;
  const errorMsg =
    (active.error as Error | null)?.message ?? (sendMail.error as Error | null)?.message;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function handleSendCode() {
    if (cooldown > 0 || !email || sendMail.isPending) return;
    sendMail.mutate(email, {onSuccess: () => setCooldown(60)});
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const done = {onSuccess: () => navigate("/", {replace: true})};
    if (view === "register") register.mutate({email, password, code}, done);
    else if (mode === "password") login.mutate({email, password}, done);
    else loginCode.mutate({email, code}, done);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-2">
        {/* Account-first: the form is the primary surface (DESIGN.md). */}
        <div className="order-1 w-full max-w-sm justify-self-center lg:justify-self-start">
          <LingxiLogo variant="lockup" className="mb-6" />
          <h1 className="text-xl font-semibold tracking-[-0.02em]">
            {view === "register" ? "注册灵犀" : "登录灵犀"}
          </h1>
          <p className="mt-1 text-sm text-muted">懂你的,不只是消息。</p>

          {/* Login-method segmented control — one quiet control (DESIGN.md). */}
          {view === "login" ? (
            <div className="mt-5 inline-flex rounded-xl border border-separator bg-surface p-0.5">
              {(["password", "code"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-[0.625rem] px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors",
                    mode === m
                      ? "bg-[var(--lx-accent)] text-white"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {m === "password" ? "密码登录" : "验证码登录"}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <TextField
              type="email"
              label="邮箱"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {needsPassword ? (
              <TextField
                type="password"
                label="密码"
                placeholder={view === "register" ? "设置密码(至少 6 位)" : "输入密码"}
                autoComplete={view === "register" ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : null}

            {needsCode ? (
              <div className="space-y-1.5">
                <TextField
                  inputMode="numeric"
                  label="邮箱验证码"
                  placeholder="6 位验证码"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  hint={sendMail.isSuccess ? `验证码已发送到 ${email}` : "我们会把验证码发到你的邮箱"}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={cooldown > 0 || !email || sendMail.isPending}
                  className="text-[0.8125rem] font-medium text-[var(--lx-accent)] hover:underline disabled:text-muted disabled:no-underline"
                >
                  {sendMail.isPending
                    ? "发送中…"
                    : cooldown > 0
                      ? `重新发送 (${cooldown}s)`
                      : "发送验证码"}
                </button>
              </div>
            ) : null}

            {/* Login-only secondary options on one compact row (DESIGN.md). */}
            {view === "login" ? (
              <div className="flex items-center justify-between text-[0.8125rem]">
                <label className="inline-flex items-center gap-2 text-muted">
                  <input type="checkbox" defaultChecked className="accent-[var(--lx-accent)]" />
                  保持登录
                </label>
                {mode === "password" ? (
                  <button
                    type="button"
                    onClick={() => setMode("code")}
                    className="text-[var(--lx-accent)] hover:underline"
                  >
                    用验证码登录
                  </button>
                ) : null}
              </div>
            ) : null}

            {errorMsg ? (
              <p role="alert" className="text-[0.8125rem] text-[var(--lx-state-error)]">
                {errorMsg}
              </p>
            ) : null}

            <Button type="submit" block size="lg" disabled={active.isPending}>
              {active.isPending
                ? "请稍候…"
                : view === "register"
                  ? "注册并登录"
                  : "登录"}
            </Button>

            <button
              type="button"
              onClick={() => setView(view === "login" ? "register" : "login")}
              className="block w-full text-center text-[0.8125rem] text-muted hover:text-foreground"
            >
              {view === "login" ? "没有账号?注册一个" : "已有账号?去登录"}
            </button>
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
