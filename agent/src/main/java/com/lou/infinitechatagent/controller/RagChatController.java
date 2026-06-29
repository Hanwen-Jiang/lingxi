package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.chat.ChatHistoryService;
import com.lou.infinitechatagent.monitor.MonitorContext;
import com.lou.infinitechatagent.monitor.MonitorContextHolder;
import com.lou.infinitechatagent.model.dto.ChatRequest;
import com.lou.infinitechatagent.rag.RagQueryService;
import com.lou.infinitechatagent.rag.dto.RagQueryResponse;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.CurrentUser;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/rag")
public class RagChatController {

    @Resource
    private RagQueryService ragQueryService;

    @Resource
    private ChatHistoryService chatHistoryService;

    @PostMapping("/chat")
    public BaseResponse<RagQueryResponse> chatWithCitations(@Valid @RequestBody ChatRequest chatRequest,
                                                            @CurrentUser AuthPrincipal principal) {
        // 网关身份(B1):userId 取自网关注入身份(不再回退 body)。
        Long userId = principal.requireUserId();
        Long sessionId = chatRequest.ensureInternalSessionId();
        MonitorContextHolder.setContext(MonitorContext.builder()
                .userId(userId)
                .sessionId(sessionId)
                .build());
        try {
            RagQueryResponse response = ragQueryService.chatWithCitations(sessionId, chatRequest.getPrompt());
            chatHistoryService.recordSuccess(
                    userId,
                    sessionId,
                    "rag",
                    chatRequest.getPrompt(),
                    response.getAnswer(),
                    null,
                    "{\"citations\":" + (response.getCitations() == null ? 0 : response.getCitations().size()) + "}"
            );
            return ResultUtils.success(response);
        } catch (RuntimeException e) {
            chatHistoryService.recordError(
                    userId,
                    sessionId,
                    "rag",
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
}
