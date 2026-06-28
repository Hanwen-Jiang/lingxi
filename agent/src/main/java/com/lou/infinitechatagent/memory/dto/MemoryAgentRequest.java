package com.lou.infinitechatagent.memory.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import lombok.Data;

@Data
public class MemoryAgentRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private String prompt;
}
