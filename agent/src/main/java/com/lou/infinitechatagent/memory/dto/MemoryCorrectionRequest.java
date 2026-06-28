package com.lou.infinitechatagent.memory.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import lombok.Data;

@Data
public class MemoryCorrectionRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private MemoryType memoryType;

    private String correctedContent;

    private String correctedSummary;

    private String reason;

    private Double confidence;
}
