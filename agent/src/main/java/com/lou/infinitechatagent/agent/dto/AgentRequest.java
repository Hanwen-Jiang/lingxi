package com.lou.infinitechatagent.agent.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AgentRequest {

    private Long userId;

    private Long sessionId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;

    private Boolean debug;

    private java.util.Set<String> confirmedTools;
}
