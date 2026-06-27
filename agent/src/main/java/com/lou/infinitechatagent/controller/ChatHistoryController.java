package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.chat.ChatHistoryService;
import com.lou.infinitechatagent.chat.dto.ModelConfigRequest;
import com.lou.infinitechatagent.chat.dto.ChatSessionCreateRequest;
import com.lou.infinitechatagent.chat.dto.ChatSessionDetail;
import com.lou.infinitechatagent.chat.dto.ChatSessionSummary;
import com.lou.infinitechatagent.chat.dto.ModelListResponse;
import com.lou.infinitechatagent.chat.dto.ModelStatusResponse;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.exception.BusinessException;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.CurrentUser;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 会话历史 + 运行时模型配置。<b>contract 相(P3):</b> userId 取自网关注入身份(不再收 param/body userId)。
 * {@code /model-config} 为 admin-only(D10):<b>仅认网关注入的 admin 角色</b>;P0 的 {@code X-Admin-Token} 已退役。
 */
@Slf4j
@RestController
@RequestMapping("/chat")
public class ChatHistoryController {

    @Resource
    private ChatHistoryService chatHistoryService;

    @GetMapping("/sessions")
    public BaseResponse<List<ChatSessionSummary>> sessions(@CurrentUser AuthPrincipal principal,
                                                           @RequestParam(defaultValue = "40") int limit) {
        return ResultUtils.success(chatHistoryService.listSessions(principal.requireUserId(), limit));
    }

    @GetMapping("/sessions/{sessionId}")
    public BaseResponse<ChatSessionDetail> session(@CurrentUser AuthPrincipal principal,
                                                   @PathVariable Long sessionId) {
        return ResultUtils.success(chatHistoryService.getSession(principal.requireUserId(), sessionId));
    }

    @PostMapping("/sessions")
    public BaseResponse<ChatSessionSummary> createSession(@CurrentUser AuthPrincipal principal,
                                                          @RequestBody ChatSessionCreateRequest request) {
        request.setUserId(principal.requireUserId());
        return ResultUtils.success(chatHistoryService.createSession(request));
    }

    @PostMapping("/sessions/{sessionId}/summarize")
    public BaseResponse<ChatSessionSummary> summarize(@CurrentUser AuthPrincipal principal,
                                                      @PathVariable Long sessionId) {
        return ResultUtils.success(chatHistoryService.summarize(principal.requireUserId(), sessionId));
    }

    @GetMapping("/model-status")
    public BaseResponse<ModelStatusResponse> modelStatus() {
        return ResultUtils.success(chatHistoryService.modelStatus());
    }

    /**
     * 运行时改全局 LLM provider/baseURL/model 等(高危:SSRF + 密钥外泄面)。
     * <ul>
     *   <li><b>admin-only</b>:仅认网关注入的 admin 角色(X-User-Roles 含 admin),否则 403。</li>
     *   <li>不接受请求体里的原始 {@code apiKey};运行时密钥仅来自服务端环境配置。</li>
     *   <li>变更落审计日志。</li>
     * </ul>
     */
    @PostMapping("/model-config")
    public BaseResponse<ModelStatusResponse> updateModelConfig(@CurrentUser AuthPrincipal principal,
                                                               @RequestBody ModelConfigRequest request) {
        if (!principal.isAdmin()) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR, "需要 admin 角色");
        }
        if (request != null && request.getApiKey() != null) {
            log.warn("[model-config] 忽略请求体携带的 apiKey(出于安全不接受原始密钥)");
            request.setApiKey(null);
        }
        ModelStatusResponse status = chatHistoryService.updateModelConfig(request);
        log.warn("[model-config] 管理员变更运行时模型配置: provider={}, model={}, baseUrl={}",
                status.getProvider(), status.getModel(), status.getBaseUrl());
        return ResultUtils.success(status);
    }

    @GetMapping("/models")
    public BaseResponse<ModelListResponse> models() {
        return ResultUtils.success(chatHistoryService.listModels());
    }
}
