package com.lou.infinitechatagent.memory.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionSummary {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private String summary;

    private Integer turnCount;

    private LocalDateTime lastMessageAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
