import {Chip} from "@heroui/react/chip";
import {ChainOfThought} from "@heroui-pro/react/chain-of-thought";
import {ChatConversation} from "@heroui-pro/react/chat-conversation";
import {ChatLoader} from "@heroui-pro/react/chat-loader";
import {ChatMessage} from "@heroui-pro/react/chat-message";
import {ChatMessageActions} from "@heroui-pro/react/chat-message-actions";
import {ChatSource, ChatSources} from "@heroui-pro/react/chat-source";
import {ChatTool, ChatToolGroup} from "@heroui-pro/react/chat-tool";
import {CodeBlock} from "@heroui-pro/react/code-block";
import {Markdown} from "@heroui-pro/react/markdown";
import {TextShimmer} from "@heroui-pro/react/text-shimmer";

import {EmptyState, LingxiGlyph} from "@infinitechat/design-system";

import {extractTraceSteps, statusTone} from "../../lib/chat";
import {getObjectValue} from "../../lib/format";
import type {Citation, PendingTool, WorkspaceMessage} from "../../types";

import {ToolConfirmation} from "./ToolConfirmation";

// (assistantId, shouldRelease) — shouldRelease=false means the user declined.
// The actual approval rides on the server-issued challengeToken stored inside
// useChat; this handler is only deciding whether to release it.
type ConfirmTurnHandler = (assistantId: string, shouldRelease: boolean) => void;

export function MessageTimeline({
  messages,
  onConfirmTurn,
}: {
  messages: WorkspaceMessage[];
  onConfirmTurn?: ConfirmTurnHandler;
}) {
  return (
    <ChatConversation className="min-h-0 flex-1 overflow-y-auto" resize="smooth">
      <ChatConversation.Content className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 py-6 md:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-[42vh] w-full max-w-xl items-center justify-center">
            <EmptyState
              icon={<LingxiGlyph className="size-6 text-accent" />}
              title="和灵犀聊聊"
              description="懂你的,不只是消息。在下方输入框开始一段对话,聊完会自动保存。"
            />
          </div>
        ) : (
          messages.map((message) => <MessageTurn key={message.id} message={message} onConfirmTurn={onConfirmTurn} />)
        )}
        <ChatConversation.ScrollAnchor />
      </ChatConversation.Content>
      <ChatConversation.ScrollButton tooltip="跳到最新" />
    </ChatConversation>
  );
}

function readPendingTools(message: WorkspaceMessage): PendingTool[] {
  const pending = message.meta?.pendingTools;
  return Array.isArray(pending) ? (pending as PendingTool[]) : [];
}

function readChallenge(message: WorkspaceMessage): {challengeToken?: string; expiresInSec?: number} | undefined {
  return message.meta?.challenge as {challengeToken?: string; expiresInSec?: number} | undefined;
}

function MessageTurn({message, onConfirmTurn}: {message: WorkspaceMessage; onConfirmTurn?: ConfirmTurnHandler}) {
  if (message.role === "user") {
    return (
      <ChatMessage.User>
        <ChatMessage.Bubble>
          <ChatMessage.Content>{message.content}</ChatMessage.Content>
        </ChatMessage.Bubble>
      </ChatMessage.User>
    );
  }

  if (message.role === "system") {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {message.content}
      </div>
    );
  }

  // Only surface a status chip for the error case — "streaming" is already
  // expressed by the shimmer/loader and "complete" is the default, so showing
  // raw status strings would leak internal state to the UI (D10/D12).
  const showErrorChip = message.status === "error";

  // M4 (F01) — render the tool-confirmation card while this turn holds tools.
  // The decisive signal is the server-issued challenge token (stashed on
  // meta.challenge by useChat); pendingTools is informational only. The card
  // hides during the replay (status === "streaming").
  const pendingTools = readPendingTools(message);
  const challenge = readChallenge(message);
  const hasChallenge = Boolean(challenge?.challengeToken);
  const showToolConfirmation = hasChallenge && Boolean(onConfirmTurn);
  const isConfirming = message.status === "streaming";

  return (
    <ChatMessage.Assistant>
      <ChatMessage.Avatar show alt="灵犀" fallback="灵犀" />
      <ChatMessage.Body>
        {showErrorChip ? (
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft" color={statusTone(message.status)}>
              出错了
            </Chip>
          </div>
        ) : null}
        <ChatMessage.Content>
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : message.status === "streaming" ? (
            <TextShimmer>灵犀正在思考...</TextShimmer>
          ) : (
            <ChatLoader.Dots label="正在生成回复" />
          )}
        </ChatMessage.Content>
        {message.citations?.length ? <CitationList citations={message.citations} /> : null}
        {showToolConfirmation ? (
          <ToolConfirmation
            expiresInSec={challenge?.expiresInSec}
            isConfirming={isConfirming}
            tools={pendingTools}
            onConfirm={() => onConfirmTurn?.(message.id, true)}
            onCancel={() => onConfirmTurn?.(message.id, false)}
          />
        ) : null}
        {message.meta || message.requestId ? (
          <ResponseDetails meta={message.meta} requestId={message.requestId} />
        ) : null}
        {message.content ? (
          <ChatMessageActions>
            <ChatMessageActions.Copy aria-label="复制灵犀的回复" />
            <ChatMessageActions.ThumbsUp aria-label="标记为有帮助" />
            <ChatMessageActions.ThumbsDown aria-label="标记为没帮助" />
          </ChatMessageActions>
        ) : null}
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}

function CitationList({citations}: {citations: Citation[]}) {
  return (
    <ChatSources defaultExpanded={false}>
      <ChatSources.Trigger>{citations.length} 条来源</ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          {citations.map((citation, index) => (
            <ChatSource
              key={`${citation.chunkId ?? citation.docId ?? index}`}
              description={citation.snippet}
              sourceType="document"
              title={citation.fileName ?? citation.docId ?? `来源 ${index + 1}`}
            />
          ))}
        </ChatSources.List>
      </ChatSources.Content>
    </ChatSources>
  );
}

function ResponseDetails({meta, requestId}: {meta?: Record<string, unknown>; requestId?: string}) {
  const steps = extractTraceSteps(meta);
  const toolTrace = getObjectValue(meta, "toolTrace") ?? getObjectValue(getObjectValue(meta, "details"), "toolTrace");
  const detailCode = JSON.stringify(redactSensitiveDetail({requestId, ...meta}), null, 2);

  return (
    <div className="response-details">
      {steps.length ? (
        <ChainOfThought defaultExpanded={false}>
          <ChainOfThought.Trigger>灵犀的思考过程</ChainOfThought.Trigger>
          <ChainOfThought.Content>
            <ChainOfThought.Steps>
              {steps.map((step) => (
                <ChainOfThought.Step key={`${step.label}-${step.detail ?? ""}`} label={step.label}>
                  {step.detail ? <span>{step.detail}</span> : null}
                </ChainOfThought.Step>
              ))}
            </ChainOfThought.Steps>
          </ChainOfThought.Content>
        </ChainOfThought>
      ) : null}
      {toolTrace ? (
        <ChatToolGroup>
          <ChatTool
            input={toolTrace}
            isExpandable
            output={getObjectValue(toolTrace, "trace") ?? toolTrace}
            state="output-available"
            toolName={String(getObjectValue(toolTrace, "capability") ?? "灵犀")}
          />
        </ChatToolGroup>
      ) : null}
      <details className="response-details-code">
        <summary>更多细节</summary>
        <CodeBlock className="mt-2">
          <CodeBlock.Header>
            <span>原始响应</span>
            <CodeBlock.CopyButton aria-label="复制细节" code={detailCode} />
          </CodeBlock.Header>
          <CodeBlock.Code code={detailCode} language="json" />
        </CodeBlock>
      </details>
    </div>
  );
}

function redactSensitiveDetail(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveDetail);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      key === "challengeToken" || key === "confirmationToken" ? "[redacted]" : redactSensitiveDetail(child),
    ]),
  );
}
