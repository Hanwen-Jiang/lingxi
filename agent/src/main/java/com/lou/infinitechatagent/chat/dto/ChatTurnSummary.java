package com.lou.infinitechatagent.chat.dto;

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

    private Long id;

    private Long userId;

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
