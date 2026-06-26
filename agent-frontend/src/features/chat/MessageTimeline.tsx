import {MessageSquare} from "lucide-react";

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

import {extractTraceSteps, statusTone} from "../../lib/chat";
import {getObjectValue} from "../../lib/format";
import type {Citation, WorkspaceMessage} from "../../types";

export function MessageTimeline({messages}: {messages: WorkspaceMessage[]}) {
  return (
    <ChatConversation className="min-h-0 flex-1 overflow-y-auto" resize="smooth">
      <ChatConversation.Content className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 py-6 md:px-6">
        {messages.length === 0 ? (
          <div className="chat-empty-state mx-auto flex min-h-[42vh] w-full max-w-xl flex-col items-center justify-center text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-surface-secondary text-muted">
              <MessageSquare className="size-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Start a real conversation</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">
              Use the composer below. Conversations and turn summaries are saved after backend responses.
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageTurn key={message.id} message={message} />)
        )}
        <ChatConversation.ScrollAnchor />
      </ChatConversation.Content>
      <ChatConversation.ScrollButton tooltip="Jump to latest" />
    </ChatConversation>
  );
}

function MessageTurn({message}: {message: WorkspaceMessage}) {
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

  return (
    <ChatMessage.Assistant>
      <ChatMessage.Avatar show alt="InfiniteChat" fallback="AI" />
      <ChatMessage.Body>
        <div className="flex items-center gap-2">
          <Chip size="sm" variant="soft" color={statusTone(message.status)}>
            {message.status ?? "complete"}
          </Chip>
        </div>
        <ChatMessage.Content>
          {message.content ? (
            <Markdown>{message.content}</Markdown>
          ) : message.status === "streaming" ? (
            <TextShimmer>Thinking...</TextShimmer>
          ) : (
            <ChatLoader.Dots label="Waiting for response" />
          )}
        </ChatMessage.Content>
        {message.citations?.length ? <CitationList citations={message.citations} /> : null}
        {message.meta || message.requestId ? (
          <ResponseDetails meta={message.meta} requestId={message.requestId} />
        ) : null}
        {message.content ? (
          <ChatMessageActions>
            <ChatMessageActions.Copy aria-label="Copy assistant response" />
            <ChatMessageActions.ThumbsUp aria-label="Mark helpful" />
            <ChatMessageActions.ThumbsDown aria-label="Mark unhelpful" />
          </ChatMessageActions>
        ) : null}
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}

function CitationList({citations}: {citations: Citation[]}) {
  return (
    <ChatSources defaultExpanded={false}>
      <ChatSources.Trigger>{citations.length} sources</ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          {citations.map((citation, index) => (
            <ChatSource
              key={`${citation.chunkId ?? citation.docId ?? index}`}
              description={citation.snippet}
              sourceType="document"
              title={citation.fileName ?? citation.docId ?? `Source ${index + 1}`}
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
  const detailCode = JSON.stringify({requestId, ...meta}, null, 2);

  return (
    <div className="response-details">
      {steps.length ? (
        <ChainOfThought defaultExpanded={false}>
          <ChainOfThought.Trigger>Routing trace</ChainOfThought.Trigger>
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
            toolName={String(getObjectValue(toolTrace, "capability") ?? "backend-route")}
          />
        </ChatToolGroup>
      ) : null}
      <details className="response-details-code">
        <summary>Details</summary>
        <CodeBlock className="mt-2">
          <CodeBlock.Header>
            <span>Raw response</span>
            <CodeBlock.CopyButton aria-label="Copy response details" code={detailCode} />
          </CodeBlock.Header>
          <CodeBlock.Code code={detailCode} language="json" />
        </CodeBlock>
      </details>
    </div>
  );
}
