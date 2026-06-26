package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.chat.ChatHistoryService;
import com.lou.infinitechatagent.monitor.MonitorContext;
import com.lou.infinitechatagent.monitor.MonitorContextHolder;
import com.lou.infinitechatagent.rag.adaptive.AdaptiveRagOrchestrator;
import com.lou.infinitechatagent.rag.adaptive.dto.AdaptiveRagRequest;
import com.lou.infinitechatagent.rag.adaptive.dto.AdaptiveRagResponse;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/rag/adaptive")
public class AdaptiveRagController {

    @Resource
    private AdaptiveRagOrchestrator adaptiveRagOrchestrator;

    @Resource
    private ChatHistoryService chatHistoryService;

    @PostMapping("/chat")
    public BaseResponse<AdaptiveRagResponse> chat(@RequestBody AdaptiveRagRequest request) {
        MonitorContextHolder.setContext(MonitorContext.builder()
                .userId(request.getUserId())
                .sessionId(request.getSessionId())
                .build());
        try {
            AdaptiveRagResponse response = adaptiveRagOrchestrator.chat(request);
            chatHistoryService.recordSuccess(
                    request.getUserId(),
                    request.getSessionId(),
                    "adaptive-rag",
                    request.getPrompt(),
                    response.getAnswer(),
                    null,
                    "{\"strategy\":\"" + safe(response.getStrategy()) + "\",\"citations\":" + (response.getCitations() == null ? 0 : response.getCitations().size()) + "}"
            );
            return ResultUtils.success(response);
        } catch (RuntimeException e) {
            chatHistoryService.recordError(
                    request.getUserId(),
                    request.getSessionId(),
                    "adaptive-rag",
                    request.getPrompt(),
                    e.getMessage(),
                    null,
                    null
            );
            throw e;
        } finally {
            MonitorContextHolder.clearContext();
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.replace("\"", "\\\"");
    }
}
