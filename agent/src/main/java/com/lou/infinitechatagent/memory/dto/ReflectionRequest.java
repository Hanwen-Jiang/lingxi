package com.lou.infinitechatagent.memory.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import lombok.Data;

import java.util.List;

@Data
public class ReflectionRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private ReflectionTrigger trigger;

    private String prompt;

    private String answer;

    private String reason;

    private List<String> missingAspects;

    private Double confidence;
}
