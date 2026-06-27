import {useCallback, useMemo, useState} from "react";

import {Button} from "@heroui/react/button";

import {ErrorState, LingxiGlyph} from "@infinitechat/design-system";

// chat-backend Auth (D14 email model — 03-contracts.md §7.1). The screen has
// three modes:
//   • password   — email + password   → onLoginPassword
//   • code       — email + code       → onLoginCode  (passwordless)
//   • register   — email + password + code → onRegister  (auto-logs in)
// Sending a verification code is shared between the code-login and register
// flows; we guard it with a 60s resend countdown. All copy is product-facing
// (D10/D12) — no internal terms, no raw backend error strings.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RESEND_COOLDOWN_SECONDS = 60;

export type AuthMode = "password" | "code" | "register";

export type AuthScreenProps = {
  busy: boolean;
  errorMessage: string | null;
  /** Hint copy under the verification-code field after a successful send. */
  codeNotice: string | null;
  /** Wall-clock seconds until the "重新发送" button can be pressed again. */
  resendCooldown: number;
  onSendCode: (email: string) => Promise<void> | void;
  onLoginPassword: (input: {email: string; password: string}) => void;
  onLoginCode: (input: {email: string; code: string}) => void;
  onRegister: (input: {email: string; password: string; code: string}) => void;
  /**
   * Called when the user switches between login (password/code) and the
   * register flow so the parent can clear stale error/notice state.
   */
  onModeChange?: (mode: AuthMode) => void;
};

export function AuthScreen({
  busy,
  errorMessage,
  codeNotice,
  resendCooldown,
  onSendCode,
  onLoginPassword,
  onLoginCode,
  onRegister,
  onModeChange,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);

  const emailLooksValid = useMemo(() => EMAIL_PATTERN.test(email.trim()), [email]);

  const switchMode = useCallback(
    (next: AuthMode) => {
      setMode(next);
      onModeChange?.(next);
      // Don't clear email when toggling tabs — re-typing it would be annoying.
      // Password/code are mode-specific, so reset to avoid leaking across.
      if (next === "password") setCode("");
      if (next === "code") setPassword("");
      if (next === "register") {
        // keep both fields when entering register; user often pre-typed them
      }
    },
    [onModeChange],
  );

  const canSubmit = (() => {
    if (busy || !emailLooksValid) return false;
    if (mode === "password") return password.length > 0;
    if (mode === "code") return code.trim().length > 0;
    return password.length > 0 && code.trim().length > 0; // register
  })();

  const canSendCode = emailLooksValid && !sendingCode && resendCooldown === 0;
  const showCodeBlock = mode === "code" || mode === "register";
  const showPasswordBlock = mode === "password" || mode === "register";

  async function handleSendCode() {
    if (!canSendCode) return;
    setSendingCode(true);
    try {
      await onSendCode(email.trim());
    } finally {
      setSendingCode(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (mode === "password") onLoginPassword({email: trimmedEmail, password});
    else if (mode === "code") onLoginCode({email: trimmedEmail, code: trimmedCode});
    else onRegister({email: trimmedEmail, password, code: trimmedCode});
  }

  const submitLabel = (() => {
    if (busy) {
      if (mode === "register") return "正在注册…";
      return "正在登录…";
    }
    if (mode === "register") return "注册并登录";
    return "登录";
  })();

  const resendLabel = (() => {
    if (sendingCode) return "发送中…";
    if (resendCooldown > 0) return `${resendCooldown}s 后可重发`;
    return codeNotice ? "重新发送" : "发送验证码";
  })();

  return (
    <main className="flex h-svh w-full items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-sm space-y-6">
        <header className="space-y-3 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <LingxiGlyph className="size-6" title="灵犀" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{mode === "register" ? "注册灵犀" : "登录灵犀"}</h1>
            <p className="mt-1 text-sm text-muted">懂你的,不只是消息。</p>
          </div>
        </header>

        {mode !== "register" ? (
          <div role="tablist" aria-label="登录方式" className="flex gap-1 rounded-full bg-surface-secondary p-1">
            <button
              role="tab"
              aria-selected={mode === "password"}
              type="button"
              onClick={() => switchMode("password")}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
                mode === "password" ? "bg-surface text-foreground shadow-surface" : "text-muted hover:text-foreground"
              }`}
            >
              密码登录
            </button>
            <button
              role="tab"
              aria-selected={mode === "code"}
              type="button"
              onClick={() => switchMode("code")}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
                mode === "code" ? "bg-surface text-foreground shadow-surface" : "text-muted hover:text-foreground"
              }`}
            >
              邮箱验证码
            </button>
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={submit}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted">邮箱</span>
            <input
              autoFocus
              autoComplete="email"
              className="field-input"
              inputMode="email"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          {showPasswordBlock ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted">密码</span>
              <input
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="field-input"
                placeholder={mode === "register" ? "设置一个密码" : "请输入密码"}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          ) : null}

          {showCodeBlock ? (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted">邮箱验证码</span>
              <div className="flex gap-2">
                <input
                  autoComplete="one-time-code"
                  className="field-input flex-1"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位验证码"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
                />
                <Button
                  className="control-button shrink-0"
                  isDisabled={!canSendCode}
                  size="sm"
                  type="button"
                  variant="outline"
                  onPress={() => void handleSendCode()}
                >
                  {resendLabel}
                </Button>
              </div>
              {codeNotice ? <p className="text-xs text-muted">{codeNotice}</p> : null}
            </div>
          ) : null}

          {errorMessage ? (
            <ErrorState
              compact
              title={mode === "register" ? "注册没有成功" : "登录没有成功"}
              description={errorMessage}
            />
          ) : null}

          <Button
            type="submit"
            className="control-button settings-action-button w-full justify-center"
            variant="primary"
            isDisabled={!canSubmit}
          >
            {submitLabel}
          </Button>

          {mode === "register" ? (
            <p className="text-center text-xs text-muted">
              已经有账号了?
              <button type="button" className="ml-1 text-accent hover:underline" onClick={() => switchMode("password")}>
                去登录
              </button>
            </p>
          ) : (
            <p className="text-center text-xs text-muted">
              还没有账号?
              <button type="button" className="ml-1 text-accent hover:underline" onClick={() => switchMode("register")}>
                注册一个
              </button>
            </p>
          )}

          <p className="text-center text-xs text-muted">登录即同意《灵犀服务协议》与《隐私政策》</p>
        </form>
      </section>
    </main>
  );
}
