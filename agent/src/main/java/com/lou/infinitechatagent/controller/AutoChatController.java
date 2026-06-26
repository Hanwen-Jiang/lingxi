package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.chat.AutoChatRouterService;
import com.lou.infinitechatagent.chat.dto.AutoChatResponse;
import com.lou.infinitechatagent.chat.dto.AutoRouteDecision;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.model.dto.ChatRequest;
import com.lou.infinitechatagent.model.dto.StreamChatEvent;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.CurrentUser;
import jakarta.annotation.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping("/chat/auto")
public class AutoChatController {

    @Resource
    private AutoChatRouterService autoChatRouterService;

    @PostMapping
    public BaseResponse<AutoChatResponse> chat(@RequestBody ChatRequest request,
                                               @CurrentUser AuthPrincipal principal) {
        // 网关身份优先(B1):覆盖请求体 userId,贯通到自动路由各子链;过渡期回退 body。
        request.setUserId(principal.resolveUserId(request.getUserId()));
        return ResultUtils.success(autoChatRouterService.chat(request));
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<StreamChatEvent>> stream(@RequestBody ChatRequest request,
                                                         @CurrentUser AuthPrincipal principal) {
        request.setUserId(principal.resolveUserId(request.getUserId()));
        AutoRouteDecision decision = autoChatRouterService.decide(request);
        String requestId = UUID.randomUUID().toString();
        AtomicReference<StringBuilder> answer = new AtomicReference<>(new StringBuilder());
        AtomicReference<Object> toolTrace = new AtomicReference<>(java.util.Map.of(
                "capability",
                "direct".equals(decision.getRoute()) ? "direct-chat" : decision.getRoute(),
                "streamed",
                true
        ));
        AtomicReference<java.util.List<com.lou.infinitechatagent.rag.dto.Citation>> citations = new AtomicReference<>();
        AtomicBoolean failed = new AtomicBoolean(false);

        Flux<ServerSentEvent<StreamChatEvent>> start = Flux.just(sse(StreamChatEvent.builder()
                .type("start")
                .requestId(requestId)
                .sessionId(request.getSessionId())
                .route(decision.getRoute())
                .forced(Boolean.TRUE.equals(decision.getForced()))
                .reason(decision.getReason())
                .message("auto stream started")
                .build()));
        Flux<ServerSentEvent<StreamChatEvent>> delta = autoChatRouterService.supportsTokenStreaming(decision)
                ? autoChatRouterService.stream(request, decision)
                .map(text -> {
                    answer.get().append(text);
                    return sse(StreamChatEvent.builder()
                            .type("delta")
                            .requestId(requestId)
                            .sessionId(request.getSessionId())
                            .route(decision.getRoute())
                            .forced(Boolean.TRUE.equals(decision.getForced()))
                            .reason(decision.getReason())
                            .text(text)
                            .build());
                })
                : Flux.defer(() -> {
                    AutoChatResponse response = autoChatRouterService.executeStream(request, decision, requestId);
                    String responseText = response.getAnswer() == null ? "" : response.getAnswer();
                    answer.get().append(responseText);
                    toolTrace.set(response.getToolTrace());
                    citations.set(response.getCitations());
                    return Flux.just(sse(StreamChatEvent.builder()
                            .type("delta")
                            .requestId(requestId)
                            .sessionId(request.getSessionId())
                            .route(decision.getRoute())
                            .forced(Boolean.TRUE.equals(decision.getForced()))
                            .reason(decision.getReason())
                            .text(responseText)
                            .citations(response.getCitations())
                            .toolTrace(response.getToolTrace())
                            .build()));
                });
        Flux<ServerSentEvent<StreamChatEvent>> done = Flux.defer(() -> Flux.just(sse(StreamChatEvent.builder()
                .type("done")
                .requestId(requestId)
                .sessionId(request.getSessionId())
                .route(decision.getRoute())
                .forced(Boolean.TRUE.equals(decision.getForced()))
                .reason(decision.getReason())
                .citations(citations.get())
                .toolTrace(toolTrace.get())
                .message("auto stream completed")
                .build())));

        return Flux.concat(start, delta, done)
                .onErrorResume(exception -> Flux.just(sse(StreamChatEvent.builder()
                        .type("error")
                        .requestId(requestId)
                        .sessionId(request.getSessionId())
                        .route(decision.getRoute())
                        .forced(Boolean.TRUE.equals(decision.getForced()))
                        .reason(decision.getReason())
                        .code(ErrorCode.SYSTEM_ERROR.getCode())
                        .message(exception.getMessage())
                        .build()))
                        .doOnNext(event -> {
                            failed.set(true);
                            autoChatRouterService.recordStreamError(
                                    request,
                                    decision,
                                    event.data() == null ? null : event.data().getMessage(),
                                    requestId
                            );
                        }))
                .doOnComplete(() -> {
                    if (!failed.get()) {
                        autoChatRouterService.recordStreamSuccess(
                                request,
                                decision,
                                answer.get().toString(),
                                requestId,
                                toolTrace.get(),
                                citations.get()
                        );
                    }
                });
    }

    private ServerSentEvent<StreamChatEvent> sse(StreamChatEvent event) {
        return ServerSentEvent.<StreamChatEvent>builder(event)
                .event(event.getType())
                .id(event.getRequestId())
                .build();
    }
}
