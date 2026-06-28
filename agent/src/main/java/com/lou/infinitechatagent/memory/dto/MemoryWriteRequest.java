package com.lou.infinitechatagent.memory.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class MemoryWriteRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private MemoryType memoryType;

    private String content;

    private String summary;

    private Double confidence;

    private String source;

    private LocalDateTime expiresAt;
}
