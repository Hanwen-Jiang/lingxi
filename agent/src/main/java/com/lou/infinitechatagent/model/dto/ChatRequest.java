package com.lou.infinitechatagent.model.dto;
import com.lou.infinitechatagent.common.id.SessionIdCodec;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChatRequest {

    /**
     * D5 wire id: JSON string snowflake. Jackson still accepts JSON numbers for expand/contract;
     * client-only UI ids are mapped to an internal Long only after request binding.
     */
    private String sessionId;

    @SnowflakeId
    private Long userId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;

    /**
     * F01:高风险工具确认令牌(可选)。自动路由(/chat/auto)落到 agent 时透传给 ReAct 治理,
     * 使确认流程在 auto 端点也可用。直连 /agent/chat 用 {@code AgentRequest.confirmationToken}。
     */
    private String confirmationToken;

    public void setSessionId(String sessionId) {
        this.sessionId = SessionIdCodec.normalizeWire(sessionId);
    }

    public Long internalSessionId() {
        return SessionIdCodec.toInternal(sessionId);
    }

    public Long ensureInternalSessionId() {
        Long internal = internalSessionId();
        if (internal != null) {
            return internal;
        }
        Long generated = SessionIdCodec.generateInternal();
        this.sessionId = SessionIdCodec.toWire(generated);
        return generated;
    }
}
