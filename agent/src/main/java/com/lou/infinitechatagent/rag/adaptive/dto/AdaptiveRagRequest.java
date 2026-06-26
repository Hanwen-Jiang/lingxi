package com.lou.infinitechatagent.rag.adaptive.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdaptiveRagRequest {

    private Long userId;

    private Long sessionId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;

    private Boolean debug;
}
