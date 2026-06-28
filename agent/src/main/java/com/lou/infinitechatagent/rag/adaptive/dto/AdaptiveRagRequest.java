package com.lou.infinitechatagent.rag.adaptive.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdaptiveRagRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;

    private Boolean debug;
}
