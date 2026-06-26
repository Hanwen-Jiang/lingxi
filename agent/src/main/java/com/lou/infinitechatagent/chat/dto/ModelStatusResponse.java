package com.lou.infinitechatagent.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelStatusResponse {

    private String provider;

    private String model;

    private String baseUrl;

    private Double temperature;

    private Integer maxOutputTokens;

    private String reasoningEffort;

    private Boolean configured;

    private Boolean runtimeEditable;

    private String message;
}
