package com.lou.infinitechatagent.agent.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AgentRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;

    private Boolean debug;

    /**
     * F01:服务端签发的一次性高风险工具确认令牌(来自上一次 {@code ToolGovernanceDecision.challengeToken})。
     * 二次请求回传它才放行(校验 userId/sessionId/工具指纹后一次性消费)。
     */
    private String confirmationToken;

    /**
     * @deprecated F01:旧的无状态确认入参(可被客户端伪造)。
     * 当 {@code agent.tool-governance.challenge.enabled=true}(默认)时<b>被忽略</b>,只认 {@link #confirmationToken}。
     * 仅在显式关闭 challenge 时作为遗留兼容路径保留。
     */
    @Deprecated
    private java.util.Set<String> confirmedTools;
}
