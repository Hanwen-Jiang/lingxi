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
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/chat")
public class ChatHistoryController {

    @Resource
    private ChatHistoryService chatHistoryService;

    /**
     * 管理员令牌(P0 过渡防护,B3/G09)。留空 = /model-config 端点关闭(fail-closed)。
     * P1 将由网关注入身份 + admin 角色取代本机制。
     */
    @Value("${agent.admin.token:}")
    private String adminToken;

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

    /**
     * 运行时改全局 LLM provider/baseURL/model 等。高危端点(SSRF + 密钥外泄面):
     * <ul>
     *   <li>需管理员令牌(header {@code X-Admin-Token});未配置令牌则端点 fail-closed 关闭。</li>
     *   <li>不接受来自请求体的原始 {@code apiKey};运行时密钥仅来自服务端环境配置。</li>
     *   <li>变更落审计日志。</li>
     * </ul>
     */
    @PostMapping("/model-config")
    public BaseResponse<ModelStatusResponse> updateModelConfig(
            @RequestBody ModelConfigRequest request,
            @RequestHeader(value = "X-Admin-Token", required = false) String adminTokenHeader) {
        requireAdmin(adminTokenHeader);
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

    private void requireAdmin(String providedToken) {
        if (!StringUtils.hasText(adminToken)) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR,
                    "model-config 已禁用:未配置 AGENT_ADMIN_TOKEN(P1 改为基于网关身份的 admin 角色)");
        }
        if (!constantTimeEquals(adminToken, providedToken)) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "需要管理员令牌(请求头 X-Admin-Token)");
        }
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        if (actual == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}
