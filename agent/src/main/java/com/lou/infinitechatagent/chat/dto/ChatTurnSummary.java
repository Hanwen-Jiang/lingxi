package com.lou.infinitechatagent.chat.dto;
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
public class ChatTurnSummary {

    @SnowflakeId
    private Long id;

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private String mode;

    private String prompt;

    private String answer;

    private String status;

    private String requestId;

    private String miniSummary;

    private String errorMessage;

    private String metadataJson;

    private LocalDateTime createdAt;
}
