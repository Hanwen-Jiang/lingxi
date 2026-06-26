package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.chat.ChatHistoryService;
import com.lou.infinitechatagent.chat.dto.ModelConfigRequest;
import com.lou.infinitechatagent.chat.dto.ChatSessionCreateRequest;
import com.lou.infinitechatagent.chat.dto.ChatSessionDetail;
import com.lou.infinitechatagent.chat.dto.ChatSessionSummary;
import com.lou.infinitechatagent.chat.dto.ModelListResponse;
import com.lou.infinitechatagent.chat.dto.ModelStatusResponse;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ResultUtils;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/chat")
public class ChatHistoryController {

    @Resource
    private ChatHistoryService chatHistoryService;

    @GetMapping("/sessions")
    public BaseResponse<List<ChatSessionSummary>> sessions(@RequestParam Long userId,
                                                           @RequestParam(defaultValue = "40") int limit) {
        return ResultUtils.success(chatHistoryService.listSessions(userId, limit));
    }

    @GetMapping("/sessions/{sessionId}")
    public BaseResponse<ChatSessionDetail> session(@PathVariable Long sessionId,
                                                   @RequestParam Long userId) {
        return ResultUtils.success(chatHistoryService.getSession(userId, sessionId));
    }

    @PostMapping("/sessions")
    public BaseResponse<ChatSessionSummary> createSession(@RequestBody ChatSessionCreateRequest request) {
        return ResultUtils.success(chatHistoryService.createSession(request));
    }

    @PostMapping("/sessions/{sessionId}/summarize")
    public BaseResponse<ChatSessionSummary> summarize(@PathVariable Long sessionId,
                                                      @RequestParam Long userId) {
        return ResultUtils.success(chatHistoryService.summarize(userId, sessionId));
    }

    @GetMapping("/model-status")
    public BaseResponse<ModelStatusResponse> modelStatus() {
        return ResultUtils.success(chatHistoryService.modelStatus());
    }

    @PostMapping("/model-config")
    public BaseResponse<ModelStatusResponse> updateModelConfig(@RequestBody ModelConfigRequest request) {
        return ResultUtils.success(chatHistoryService.updateModelConfig(request));
    }

    @GetMapping("/models")
    public BaseResponse<ModelListResponse> models() {
        return ResultUtils.success(chatHistoryService.listModels());
    }
}
