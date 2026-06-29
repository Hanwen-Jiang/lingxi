package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.ai.AiChat;
import com.lou.infinitechatagent.chat.ChatHistoryService;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.monitor.MonitorContext;
import com.lou.infinitechatagent.monitor.MonitorContextHolder;
import com.lou.infinitechatagent.model.dto.ChatRequest;
import com.lou.infinitechatagent.model.dto.ChatResponse;
import com.lou.infinitechatagent.model.dto.StreamChatEvent;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.CurrentUser;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.UUID;

@RestController
public class AiChatController {

    @Resource
    private AiChat aiChat;

    @Resource
    private ChatHistoryService chatHistoryService;

    @PostMapping("/chat")
    public BaseResponse<ChatResponse> chat(@Valid @RequestBody ChatRequest chatRequest,
                                           @CurrentUser AuthPrincipal principal) {
        // 网关身份(B1):userId 取自网关注入身份(不再回退 body)。
        Long userId = principal.requireUserId();
        Long sessionId = chatRequest.ensureInternalSessionId();
        MonitorContextHolder.setContext(MonitorContext.builder().userId(userId).sessionId(sessionId).build());
        try {
            String answer = aiChat.chat(sessionId, chatRequest.getPrompt());
            chatHistoryService.recordSuccess(
                    userId,
                    sessionId,
                    "chat",
                    chatRequest.getPrompt(),
                    answer,
                    null,
                    null
            );
            return ResultUtils.success(ChatResponse.builder()
                    .sessionId(chatRequest.getSessionId())
                    .answer(answer)
                    .build());
        } catch (RuntimeException e) {
            chatHistoryService.recordError(
                    userId,
                    sessionId,
                    "chat",
                    chatRequest.getPrompt(),
                    e.getMessage(),
                    null,
                    null
            );
            throw e;
        } finally {
            MonitorContextHolder.clearContext();
        }
    }

    @PostMapping(value = "/streamChat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<StreamChatEvent>> streamChat(@Valid @RequestBody ChatRequest chatRequest,
                                                             @CurrentUser AuthPrincipal principal) {
        Long userId = principal.requireUserId();
        Long sessionId = chatRequest.ensureInternalSessionId();
        MonitorContext context = MonitorContext.builder()
                .userId(userId)
                .sessionId(sessionId)
                .build();
        String requestId = UUID.randomUUID().toString();

        return Flux.defer(() -> {
            MonitorContextHolder.setContext(context);
            AtomicReference<StringBuilder> answer = new AtomicReference<>(new StringBuilder());
            AtomicBoolean failed = new AtomicBoolean(false);
            Flux<ServerSentEvent<StreamChatEvent>> start = Flux.just(sse(StreamChatEvent.builder()
                    .type("start")
                    .requestId(requestId)
                    .sessionId(chatRequest.getSessionId())
                    .message("stream started")
                    .build()));
            Flux<ServerSentEvent<StreamChatEvent>> delta = Flux.defer(() -> {
                        MonitorContextHolder.setContext(context);
                        return aiChat.streamChat(sessionId, chatRequest.getPrompt())
                                .map(text -> {
                                    answer.get().append(text);
                                    return sse(StreamChatEvent.builder()
                                            .type("delta")
                                            .requestId(requestId)
                                            .sessionId(chatRequest.getSessionId())
                                            .text(text)
                                            .build());
                                })
                                .doFinally(signal -> MonitorContextHolder.clearContext());
                    })
                    .subscribeOn(Schedulers.boundedElastic());
            Flux<ServerSentEvent<StreamChatEvent>> done = Flux.just(sse(StreamChatEvent.builder()
                    .type("done")
                    .requestId(requestId)
                    .sessionId(chatRequest.getSessionId())
                    .message("stream completed")
                    .build()));
            return Flux.concat(start, delta, done)
                    .onErrorResume(e -> Flux.just(sse(StreamChatEvent.builder()
                            .type("error")
                            .requestId(requestId)
                            .sessionId(chatRequest.getSessionId())
                            .code(ErrorCode.SYSTEM_ERROR.getCode())
                            .message(e.getMessage())
                            .build()))
                            .doOnNext(event -> {
                                failed.set(true);
                                chatHistoryService.recordError(
                                        userId,
                                        sessionId,
                                        "stream",
                                        chatRequest.getPrompt(),
                                        event.data() == null ? null : event.data().getMessage(),
                                        requestId,
                                        null
                                );
                            }))
                    .doOnComplete(() -> {
                        if (!failed.get()) {
                            chatHistoryService.recordSuccess(
                                    userId,
                                    sessionId,
                                    "stream",
                                    chatRequest.getPrompt(),
                                    answer.get().toString(),
                                    requestId,
                                    null
                            );
                        }
                    })
                    .doFinally(signal -> MonitorContextHolder.clearContext());
        });
    }

    private ServerSentEvent<StreamChatEvent> sse(StreamChatEvent event) {
        return ServerSentEvent.<StreamChatEvent>builder(event)
                .event(event.getType())
                .id(event.getRequestId())
                .build();
    }
}
