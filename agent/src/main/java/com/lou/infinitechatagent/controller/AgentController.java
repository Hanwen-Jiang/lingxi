package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.chat.ChatHistoryService;
import com.lou.infinitechatagent.monitor.MonitorContext;
import com.lou.infinitechatagent.monitor.MonitorContextHolder;
import com.lou.infinitechatagent.agent.ReActAgentOrchestrator;
import com.lou.infinitechatagent.agent.dto.AgentRequest;
import com.lou.infinitechatagent.agent.dto.AgentResponse;
import com.lou.infinitechatagent.agent.dto.AgentTool;
import com.lou.infinitechatagent.agent.governance.ToolGovernanceService;
import com.lou.infinitechatagent.agent.governance.dto.ToolAuditRecord;
import com.lou.infinitechatagent.agent.tool.ToolRegistry;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.CurrentUser;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/agent")
public class AgentController {

    @Resource
    private ReActAgentOrchestrator reActAgentOrchestrator;

    @Resource
    private ToolRegistry toolRegistry;

    @Resource
    private ToolGovernanceService toolGovernanceService;

    @Resource
    private ChatHistoryService chatHistoryService;

    @GetMapping("/tools")
    public BaseResponse<List<AgentTool>> tools() {
        return ResultUtils.success(toolRegistry.listEnabledTools());
    }

    @GetMapping("/tools/audit")
    public BaseResponse<List<ToolAuditRecord>> toolAudit(@CurrentUser AuthPrincipal principal,
                                                         @RequestParam(required = false) Long userId,
                                                         @RequestParam(required = false) Long sessionId,
                                                         @RequestParam(defaultValue = "20") int limit) {
        // 按主体限权(B1):网关身份在场则只查自己的审计,忽略传入 userId。
        return ResultUtils.success(toolGovernanceService.listAuditRecords(principal.resolveUserId(userId), sessionId, limit));
    }

    @PostMapping("/chat")
    public BaseResponse<AgentResponse> chat(@RequestBody AgentRequest request,
                                            @CurrentUser AuthPrincipal principal) {
        // 网关身份优先(B1):覆盖请求体 userId,使其贯通到 ReAct 编排/记忆/审计深层;过渡期回退 body。
        request.setUserId(principal.resolveUserId(request.getUserId()));
        MonitorContextHolder.setContext(MonitorContext.builder()
                .userId(request.getUserId())
                .sessionId(request.getSessionId())
                .build());
        try {
            AgentResponse response = reActAgentOrchestrator.chat(request);
            chatHistoryService.recordSuccess(
                    request.getUserId(),
                    request.getSessionId(),
                    "agent",
                    request.getPrompt(),
                    response.getAnswer(),
                    null,
                    "{\"strategy\":\"" + safe(response.getStrategy()) + "\",\"finalAction\":\"" + (response.getFinalAction() == null ? "" : response.getFinalAction()) + "\"}"
            );
            return ResultUtils.success(response);
        } catch (RuntimeException e) {
            chatHistoryService.recordError(
                    request.getUserId(),
                    request.getSessionId(),
                    "agent",
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
