package com.lou.infinitechatagent.chat.dto;
import com.lou.infinitechatagent.common.json.SnowflakeId;

import lombok.Data;

@Data
public class ChatSessionCreateRequest {

    @SnowflakeId
    private Long userId;

    @SnowflakeId
    private Long sessionId;

    private String mode;

    private String title;
}
