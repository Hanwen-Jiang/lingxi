package com.lou.infinitechatagent.chat.dto;

import lombok.Data;

@Data
public class ModelConfigRequest {

    private String provider;

    private String baseUrl;

    private String apiKey;

    private String model;

    private Double temperature;

    private Integer maxOutputTokens;

    private String reasoningEffort;
}
