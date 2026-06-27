import {useCallback, useSyncExternalStore} from "react";

import type {ApiClient} from "../api";
import {authStore, decodeJwt, parseRoles, type AuthUser} from "../lib/auth";
import type {LoginResponse} from "../types";

// React side of the auth store. Components subscribe via useSyncExternalStore
// so the api client (which reads authStore.get() directly) and the UI never
// drift. The action callbacks pull `api` from closure — they're stable across
// state changes, only re-created when the api client itself swaps.
//
// All three entry points (password login, email-code login, register) hit
// chat Auth and return the same LoginResponse, so `applySession` is the
// single point that turns a server response into a stored session.
export function useAuth(api: ApiClient) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);

  const applySession = useCallback((res: LoginResponse) => {
    if (!res?.token) {
      throw new Error("登录失败,请重试。");
    }
    // S3 unit1b fixed `userId` (now the sub string id), but we keep the
    // sub fallback for defence-in-depth and pre-unit1b backends.
    const claims = decodeJwt(res.token);
    const id = res.userId && res.userId !== "" ? res.userId : claims?.sub ? String(claims.sub) : null;
    if (!id) {
      throw new Error("登录失败,无法识别身份。");
    }
    const user: AuthUser = {
      id,
      name: res.userName ?? undefined,
      avatar: res.avatar ?? undefined,
      roles: parseRoles(claims),
    };
    authStore.setSession({
      accessToken: res.token,
      refreshToken: res.refreshToken ?? null,
      user,
    });
  }, []);

  const loginPassword = useCallback(
    async ({email, password}: {email: string; password: string}): Promise<void> => {
      const res = await api.login({email, password});
      applySession(res);
    },
    [api, applySession],
  );

  const loginCode = useCallback(
    async ({email, code}: {email: string; code: string}): Promise<void> => {
      const res = await api.loginCode({email, code});
      applySession(res);
    },
    [api, applySession],
  );

  const register = useCallback(
    async ({email, password, code}: {email: string; password: string; code: string}): Promise<void> => {
      // chat Auth returns a LoginResponse from /register — successful
      // registration auto-logs the user in (no separate login round-trip).
      const res = await api.register({email, password, code});
      applySession(res);
    },
    [api, applySession],
  );

  const sendMail = useCallback(
    async (email: string): Promise<void> => {
      await api.sendMail({email});
    },
    [api],
  );

  const logout = useCallback(() => {
    authStore.clear();
  }, []);

  return {
    accessToken: state.accessToken,
    user: state.user,
    isAuthenticated: !!state.accessToken && !!state.user,
    loginPassword,
    loginCode,
    register,
    sendMail,
    logout,
  };
}
