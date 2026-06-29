package com.lou.infinitechatagent.chat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.infinitechatagent.agent.ReActAgentOrchestrator;
import com.lou.infinitechatagent.agent.dto.AgentRequest;
import com.lou.infinitechatagent.agent.dto.AgentResponse;
import com.lou.infinitechatagent.common.id.SessionIdCodec;
import com.lou.infinitechatagent.ai.AiChat;
import com.lou.infinitechatagent.chat.dto.AutoChatResponse;
import com.lou.infinitechatagent.chat.dto.AutoRouteDecision;
import com.lou.infinitechatagent.model.dto.ChatRequest;
import com.lou.infinitechatagent.rag.RagQueryService;
import com.lou.infinitechatagent.rag.adaptive.AdaptiveRagOrchestrator;
import com.lou.infinitechatagent.rag.adaptive.dto.AdaptiveRagRequest;
import com.lou.infinitechatagent.rag.adaptive.dto.AdaptiveRagResponse;
import com.lou.infinitechatagent.rag.dto.Citation;
import com.lou.infinitechatagent.rag.dto.RagQueryResponse;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AutoChatRouterService {

    private static final String ROUTE_DIRECT = "direct";
    private static final String ROUTE_AGENT = "agent";
    private static final String ROUTE_ADAPTIVE_RAG = "adaptive-rag";
    private static final String ROUTE_RAG = "rag";
    private static final String ROUTE_DRAFT = "draft";

    @Resource
    private AiChat aiChat;

    @Resource
    private ReActAgentOrchestrator reActAgentOrchestrator;

    @Resource
    private RagQueryService ragQueryService;

    @Resource
    private AdaptiveRagOrchestrator adaptiveRagOrchestrator;

    @Resource
    private ChatHistoryService chatHistoryService;

    @Resource
    private ObjectMapper objectMapper;

    public AutoRouteDecision decide(ChatRequest request) {
        String prompt = request == null ? "" : nullToBlank(request.getPrompt()).strip();
        ForcedCommand forced = forcedCommand(prompt);
        if (forced != null) {
            return AutoRouteDecision.builder()
                    .route(forced.route())
                    .forced(true)
                    .reason("Slash command override " + forced.command() + " applies to this message only.")
                    .prompt(forced.prompt())
                    .command(forced.command())
                    .build();
        }

        String normalized = prompt.toLowerCase(Locale.ROOT);
        if (containsAny(normalized, "draft", "reply", "respond to", "email back", "write back", "帮我回", "回复", "草稿")) {
            return route(ROUTE_DRAFT, false, "Reply drafting intent detected.", prompt);
        }
        if (containsAny(normalized, "use tool", "agent", "send email", "remember", "memory", "web search", "current time", "调用工具", "记住")) {
            return route(ROUTE_AGENT, false, "Tool, memory, or agent orchestration intent detected.", prompt);
        }
        if (containsAny(normalized, "compare", "analyze", "diagnose", "why", "how does", "tradeoff", "evidence", "source", "引用", "依据", "分析", "对比")) {
            return route(ROUTE_ADAPTIVE_RAG, false, "Question appears to need planning or evidence evaluation.", prompt);
        }
        if (containsAny(normalized, "document", "docs", "knowledge", "kb", "rag", "file", "manual", "知识库", "文档", "资料")) {
            return route(ROUTE_RAG, false, "Knowledge or document grounding intent detected.", prompt);
        }
        return route(ROUTE_DIRECT, false, "No specialized capability required; using direct chat.", prompt);
    }

    public AutoChatResponse chat(ChatRequest request) {
        AutoRouteDecision decision = decide(request);
        String requestId = UUID.randomUUID().toString();
        try {
            AutoChatResponse response = execute(request, decision, requestId);
            chatHistoryService.recordSuccess(
                    safeUserId(request),
                    safeSessionId(request),
                    decision.getRoute(),
                    decision.getPrompt(),
                    response.getAnswer(),
                    requestId,
                    metadata(decision, response.getToolTrace(), null)
            );
            return response;
        } catch (RuntimeException exception) {
            chatHistoryService.recordError(
                    safeUserId(request),
                    safeSessionId(request),
                    decision.getRoute(),
                    decision.getPrompt(),
                    exception.getMessage(),
                    requestId,
                    metadata(decision, null, exception.getMessage())
            );
            throw exception;
        }
    }

    public boolean supportsTokenStreaming(AutoRouteDecision decision) {
        return decision != null && ROUTE_DIRECT.equals(decision.getRoute());
    }

    public AutoChatResponse executeStream(ChatRequest request, AutoRouteDecision decision, String requestId) {
        return execute(request, decision, requestId);
    }

    public Flux<String> stream(ChatRequest request, AutoRouteDecision decision) {
        if (ROUTE_DIRECT.equals(decision.getRoute())) {
            return aiChat.streamChat(safeSessionId(request), decision.getPrompt());
        }
        return Mono.fromSupplier(() -> execute(request, decision, UUID.randomUUID().toString()).getAnswer()).flux();
    }

    public void recordStreamSuccess(ChatRequest request,
                                    AutoRouteDecision decision,
                                    String answer,
                                    String requestId,
                                    Object toolTrace,
                                    List<Citation> citations) {
        chatHistoryService.recordSuccess(
                safeUserId(request),
                safeSessionId(request),
                decision.getRoute(),
                decision.getPrompt(),
                answer,
                requestId,
                metadata(decision, Map.of(
                        "streamed", true,
                        "citationCount", citations == null ? 0 : citations.size(),
                        "toolTrace", toolTrace == null ? Map.of() : toolTrace
                ), null)
        );
    }

    public void recordStreamError(ChatRequest request, AutoRouteDecision decision, String errorMessage, String requestId) {
        chatHistoryService.recordError(
                safeUserId(request),
                safeSessionId(request),
                decision.getRoute(),
                decision.getPrompt(),
                errorMessage,
                requestId,
                metadata(decision, Map.of("streamed", true), errorMessage)
        );
    }

    private AutoChatResponse execute(ChatRequest request, AutoRouteDecision decision, String requestId) {
        return switch (decision.getRoute()) {
            case ROUTE_AGENT -> fromAgent(request, decision, requestId, false);
            case ROUTE_DRAFT -> fromAgent(request, decision, requestId, true);
            case ROUTE_ADAPTIVE_RAG -> fromAdaptiveRag(request, decision, requestId);
            case ROUTE_RAG -> fromRag(request, decision, requestId);
            case ROUTE_DIRECT -> fromDirect(request, decision, requestId);
            default -> fromDirect(request, decision, requestId);
        };
    }

    private AutoChatResponse fromDirect(ChatRequest request, AutoRouteDecision decision, String requestId) {
        String answer = aiChat.chat(safeSessionId(request), decision.getPrompt());
        return baseResponse(decision, requestId)
                .answer(answer)
                .toolTrace(Map.of("capability", "direct-chat"))
                .build();
    }

    private AutoChatResponse fromRag(ChatRequest request, AutoRouteDecision decision, String requestId) {
        RagQueryResponse response = ragQueryService.chatWithCitations(safeSessionId(request), decision.getPrompt());
        return baseResponse(decision, requestId)
                .answer(response.getAnswer())
                .citations(response.getCitations())
                .toolTrace(Map.of(
                        "capability", "rag-chat",
                        "retrievedCount", valueOrZero(response.getRetrievedCount()),
                        "candidateCount", valueOrZero(response.getCandidateCount()),
                        "hit", Boolean.TRUE.equals(response.getHit())
                ))
                .build();
    }

    private AutoChatResponse fromAdaptiveRag(ChatRequest request, AutoRouteDecision decision, String requestId) {
        AdaptiveRagRequest adaptiveRequest = new AdaptiveRagRequest();
        adaptiveRequest.setUserId(safeUserId(request));
        adaptiveRequest.setSessionId(safeSessionId(request));
        adaptiveRequest.setPrompt(decision.getPrompt());
        adaptiveRequest.setDebug(true);
        AdaptiveRagResponse response = adaptiveRagOrchestrator.chat(adaptiveRequest);
        return baseResponse(decision, requestId)
                .answer(response.getAnswer())
                .citations(response.getCitations())
                .toolTrace(Map.of(
                        "capability", "adaptive-rag",
                        "strategy", nullToBlank(response.getStrategy()),
                        "rounds", valueOrZero(response.getRounds()),
                        "hit", Boolean.TRUE.equals(response.getHit())
                ))
                .build();
    }

    private AutoChatResponse fromAgent(ChatRequest request, AutoRouteDecision decision, String requestId, boolean draft) {
        AgentRequest agentRequest = new AgentRequest();
        agentRequest.setUserId(safeUserId(request));
        Long sessionId = safeSessionId(request);
        agentRequest.setSessionId(request == null ? SessionIdCodec.toWire(sessionId) : request.getSessionId());
        agentRequest.setPrompt(draft ? draftPrompt(decision.getPrompt()) : decision.getPrompt());
        agentRequest.setDebug(true);
        // F01:透传高风险工具确认令牌(若客户端在 /chat/auto 二次请求里带了)。
        agentRequest.setConfirmationToken(request.getConfirmationToken());
        AgentResponse response = reActAgentOrchestrator.chat(agentRequest);
        return baseResponse(decision, requestId)
                .answer(response.getAnswer())
                .citations(response.getCitations())
                .toolTrace(Map.of(
                        "capability", draft ? "reply-draft" : "agent-chat",
                        "strategy", nullToBlank(response.getStrategy()),
                        "finalAction", response.getFinalAction() == null ? "" : response.getFinalAction().name(),
                        "trace", response.getReactTrace() == null ? List.of() : response.getReactTrace()
                ))
                .build();
    }

    private AutoChatResponse.AutoChatResponseBuilder baseResponse(AutoRouteDecision decision, String requestId) {
        return AutoChatResponse.builder()
                .route(decision.getRoute())
                .forced(Boolean.TRUE.equals(decision.getForced()))
                .reason(decision.getReason())
                .requestId(requestId)
                .status("SUCCESS");
    }

    private AutoRouteDecision route(String route, boolean forced, String reason, String prompt) {
        return AutoRouteDecision.builder()
                .route(route)
                .forced(forced)
                .reason(reason)
                .prompt(prompt)
                .build();
    }

    private ForcedCommand forcedCommand(String prompt) {
        if (!StringUtils.hasText(prompt) || !prompt.startsWith("/")) {
            return null;
        }
        int firstWhitespace = firstWhitespace(prompt);
        String command = (firstWhitespace < 0 ? prompt : prompt.substring(0, firstWhitespace)).toLowerCase(Locale.ROOT);
        String rest = firstWhitespace < 0 ? "" : prompt.substring(firstWhitespace).stripLeading();
        String cleanPrompt = StringUtils.hasText(rest) ? rest : prompt;
        String route = switch (command) {
            case "/streaming-chat", "/direct-chat" -> ROUTE_DIRECT;
            case "/agent-chat" -> ROUTE_AGENT;
            case "/adaptive-rag" -> ROUTE_ADAPTIVE_RAG;
            case "/rag-chat" -> ROUTE_RAG;
            case "/reply-draft" -> ROUTE_DRAFT;
            default -> null;
        };
        return route == null ? null : new ForcedCommand(command, route, cleanPrompt);
    }

    private int firstWhitespace(String value) {
        for (int i = 0; i < value.length(); i++) {
            if (Character.isWhitespace(value.charAt(i))) {
                return i;
            }
        }
        return -1;
    }

    private boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String metadata(AutoRouteDecision decision, Object toolTrace, String errorMessage) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "auto", true,
                    "route", decision.getRoute(),
                    "forced", Boolean.TRUE.equals(decision.getForced()),
                    "reason", nullToBlank(decision.getReason()),
                    "command", nullToBlank(decision.getCommand()),
                    "toolTrace", toolTrace == null ? Map.of() : toolTrace,
                    "error", nullToBlank(errorMessage)
            ));
        } catch (JsonProcessingException exception) {
            return "{\"auto\":true}";
        }
    }

    private String draftPrompt(String prompt) {
        return """
                Draft a concise, ready-to-send reply for the situation below. Keep the tone natural and preserve any constraints the user gave.

                %s
                """.formatted(prompt);
    }

    private Long safeUserId(ChatRequest request) {
        return request == null || request.getUserId() == null ? 1L : request.getUserId();
    }

    private Long safeSessionId(ChatRequest request) {
        return request == null ? SessionIdCodec.generateInternal() : request.ensureInternalSessionId();
    }

    private int valueOrZero(Number value) {
        return value == null ? 0 : value.intValue();
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    private record ForcedCommand(String command, String route, String prompt) {
    }
}
