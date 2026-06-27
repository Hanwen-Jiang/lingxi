import {useState} from "react";

import {Button} from "@heroui/react/button";

import {ErrorState, LingxiGlyph} from "@infinitechat/design-system";

// Centered, calm auth screen. Per docs/planning/03-contracts.md the login goes
// to chat Auth (POST /api/v1/user/login) and returns a JWT — verification
// happens at the gateway. We never set X-User-Id from the client (the gateway
// strips it). The 验证码 (SMS code) flow is not yet wired — we expose the tab
// for layout intent only (D8 §Auth) and disable it with a quiet helper line.
export function AuthScreen({
  busy,
  errorMessage,
  onLogin,
}: {
  busy: boolean;
  errorMessage: string | null;
  onLogin: (input: {phone: string; password: string}) => void;
}) {
  const [mode, setMode] = useState<"password" | "code">("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const canSubmit = mode === "password" && phone.trim().length > 0 && password.length > 0 && !busy;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onLogin({phone: phone.trim(), password});
  }

  return (
    <main className="flex h-svh w-full items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-sm space-y-6">
        <header className="space-y-3 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <LingxiGlyph className="size-6" title="灵犀" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">登录灵犀</h1>
            <p className="mt-1 text-sm text-muted">懂你的,不只是消息。</p>
          </div>
        </header>

        <div role="tablist" aria-label="登录方式" className="flex gap-1 rounded-full bg-surface-secondary p-1">
          <button
            role="tab"
            aria-selected={mode === "password"}
            type="button"
            onClick={() => setMode("password")}
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
            onClick={() => setMode("code")}
            className={`flex-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
              mode === "code" ? "bg-surface text-foreground shadow-surface" : "text-muted hover:text-foreground"
            }`}
          >
            验证码登录
          </button>
        </div>

        {mode === "password" ? (
          <form className="space-y-3" onSubmit={submit}>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted">手机号</span>
              <input
                autoFocus
                className="field-input"
                inputMode="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted">密码</span>
              <input
                className="field-input"
                placeholder="请输入密码"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {errorMessage ? <ErrorState compact title="登录没有成功" description={errorMessage} /> : null}
            <Button
              type="submit"
              className="control-button settings-action-button w-full justify-center"
              variant="primary"
              isDisabled={!canSubmit}
            >
              {busy ? "正在登录…" : "登录"}
            </Button>
            <p className="text-center text-xs text-muted">登录即同意《灵犀服务协议》与《隐私政策》</p>
          </form>
        ) : (
          <div className="rounded-2xl border border-separator bg-surface p-4 text-sm leading-6 text-muted">
            验证码登录即将上线,可以先用密码登录。
          </div>
        )}
      </section>
    </main>
  );
}
