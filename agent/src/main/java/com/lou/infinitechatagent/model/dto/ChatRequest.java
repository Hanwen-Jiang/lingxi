package com.lou.infinitechatagent.model.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChatRequest {

    @SnowflakeId
    private Long sessionId;

    @SnowflakeId
    private Long userId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;

    /**
     * F01:高风险工具确认令牌(可选)。自动路由(/chat/auto)落到 agent 时透传给 ReAct 治理,
     * 使确认流程在 auto 端点也可用。直连 /agent/chat 用 {@code AgentRequest.confirmationToken}。
     */
    private String confirmationToken;
}