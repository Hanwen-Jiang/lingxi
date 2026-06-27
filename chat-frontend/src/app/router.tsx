import type {ReactNode} from "react";

import {createBrowserRouter, Navigate} from "react-router";

import {useAuthStore} from "@/store/auth";
import {AppShell} from "./AppShell";
import {AssistantPage} from "@/features/assistant/AssistantPage";
import {AuthPage} from "@/features/auth/AuthPage";
import {ContactsPage} from "@/features/contacts/ContactsPage";
import {DiscoverPage} from "@/features/discover/DiscoverPage";
import {HomePage} from "@/features/home/HomePage";
import {MessagesPage} from "@/features/messages/MessagesPage";
import {SettingsPage} from "@/features/settings/SettingsPage";

/** Gate the app behind auth (D2). No session → /auth. */
function RequireAuth({children}: {children: ReactNode}) {
  const session = useAuthStore((s) => s.session);
  return session ? <>{children}</> : <Navigate to="/auth" replace />;
}

/** Already signed in → skip the auth screen. */
function RedirectIfAuthed({children}: {children: ReactNode}) {
  const session = useAuthStore((s) => s.session);
  return session ? <Navigate to="/" replace /> : <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {index: true, element: <HomePage />},
      {path: "messages", element: <MessagesPage />},
      {path: "messages/:sessionId", element: <MessagesPage />},
      {path: "contacts", element: <ContactsPage />},
      {path: "discover", element: <DiscoverPage />},
      {path: "assistant", element: <AssistantPage />},
      {path: "settings", element: <SettingsPage />},
    ],
  },
  {
    path: "/auth",
    element: (
      <RedirectIfAuthed>
        <AuthPage />
      </RedirectIfAuthed>
    ),
  },
]);
