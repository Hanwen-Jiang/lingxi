package com.lou.infinitechatagent.agent.governance.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolGovernanceDecision {

    private Boolean allowed;

    private Boolean confirmationRequired;

    private String toolName;

    private String actionType;

    private String riskLevel;

    private String reason;

    private List<String> guardrailHits;

    /**
     * F01:命中高风险工具且未确认时,服务端签发的一次性确认挑战令牌。
     * 客户端须在二次请求里回传 {@code AgentRequest.confirmationToken}(而非工具名)才放行。
     * 已确认/无需确认/签发失败时为 {@code null}(NON_NULL 下省略)。
     */
    private String challengeToken;

    /** challenge 令牌有效期(秒),供客户端提示/超时。 */
    private Long challengeExpiresInSec;
}
