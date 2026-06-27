// Auth mutations (D14). Sign-in on success stores the session in the auth store;
// the AuthPage reads isPending/error for its loading + error states.
import {useMutation} from "@tanstack/react-query";

import {useAuthStore} from "@/store/auth";
import {api} from "./index";

export function useSendMail() {
  return useMutation({mutationFn: (email: string) => api.sendMail(email)});
}

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({email, password}: {email: string; password: string}) =>
      api.login(email, password),
    onSuccess: signIn,
  });
}

export function useLoginCode() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({email, code}: {email: string; code: string}) => api.loginCode(email, code),
    onSuccess: signIn,
  });
}

export function useRegister() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({email, password, code}: {email: string; password: string; code: string}) =>
      api.register(email, password, code),
    onSuccess: signIn,
  });
}
