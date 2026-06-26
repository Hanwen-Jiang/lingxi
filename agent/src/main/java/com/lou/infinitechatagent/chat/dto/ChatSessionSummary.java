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
public class ChatSessionSummary {

    private Long userId;

    private Long sessionId;

    private String title;

    private String mode;

    private String summary;

    private Integer turnCount;

    private String lastStatus;

    private LocalDateTime lastMessageAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
