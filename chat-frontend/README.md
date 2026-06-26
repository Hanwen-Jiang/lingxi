# chat-frontend

IM web client for the `chat` backend (the WeChat-style instant-messenger microservices:
AuthenticationService / ContactService / MessagingService / RealTimeCommunicationService).

Distinct from `frontend/`, which is the AI-agent chat UI. This app is the human-to-human
messenger: conversation list, single & group chats, contacts, friend requests.

## Stack

- Vite 5 + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- `lucide-react` icons, `motion` for animation

Matches the house stack used by `frontend/`, minus the HeroUI Pro chat widgets
(this client is human-IM, not assistant-streaming).

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5273
```

By default it runs in **Mock mode** — all data comes from an in-memory fixture in
`src/api.ts`, so no backend is required. The bot conversation auto-replies so you can
exercise the send flow.

## Connecting the real backend

Set `VITE_API_BASE` to the GateWay origin and the API layer switches to real REST calls:

```bash
VITE_API_BASE=http://127.0.0.1:8080 npm run dev
```

Routes mirrored from the backend controllers:

| Action            | Method & path                              | Service            |
| ----------------- | ------------------------------------------ | ------------------ |
| Send message      | `POST /api/v1/chat/session`                | MessagingService   |
| Friend requests   | `GET  /api/v1/contact/{userUuid}/apply`    | ContactService     |
| Login / register  | `POST /api/v1/user/login` `/register`      | AuthenticationServ |

`src/api.ts` is the single integration seam — replace the mock branches with the real
endpoints (and wire the WebSocket push from RealTimeCommunicationService) to go live.

## Structure

```
src/
  App.tsx     three-pane shell: rail nav · conversation list · chat pane
  api.ts      API layer with mock fallback (the backend integration seam)
  types.ts    domain types mirroring the backend Result<T> shapes
  styles.css  Tailwind entry + scrollbar polish
```
