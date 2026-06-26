package com.lou.infinitechatagent.model.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ChatRequest {

    private Long sessionId;

    private Long userId;

    @NotNull(message = "prompt 不能为空")
    private String prompt;
}