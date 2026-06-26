package com.lou.infinitechatagent.chat.dto;

import lombok.Data;

@Data
public class ChatSessionCreateRequest {

    private Long userId;

    private Long sessionId;

    private String mode;

    private String title;
}
