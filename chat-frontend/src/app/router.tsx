import {createBrowserRouter} from "react-router";

import {AppShell} from "./AppShell";
import {AssistantPage} from "@/features/assistant/AssistantPage";
import {AuthPage} from "@/features/auth/AuthPage";
import {ContactsPage} from "@/features/contacts/ContactsPage";
import {DiscoverPage} from "@/features/discover/DiscoverPage";
import {HomePage} from "@/features/home/HomePage";
import {MessagesPage} from "@/features/messages/MessagesPage";
import {SettingsPage} from "@/features/settings/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
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
  {path: "/auth", element: <AuthPage />},
]);
