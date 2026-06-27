import {useCallback, useSyncExternalStore} from "react";

import type {ApiClient} from "../api";
import {authStore, decodeJwt, parseRoles, type AuthUser} from "../lib/auth";

// React side of the auth store. Components subscribe via useSyncExternalStore
// so the api client (which reads authStore.get() directly) and the UI never
// drift. The login/logout actions are stable identities because they pull
// the api client from closure — they don't memo the latest state.
export function useAuth(api: ApiClient) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);

  const login = useCallback(
    async ({phone, password}: {phone: string; password: string}): Promise<void> => {
      const res = await api.login({phone, password});
      if (!res?.token) {
        // Defensive — the contract requires a token; treat missing as failure.
        throw new Error("登录失败,请重试。");
      }
      // S3 known bug: LoginResponse.userId is null; fall back to the JWT sub.
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
    login,
    logout,
  };
}
