package com.lou.infinitechatagent.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelListResponse {

    private String provider;

    private String baseUrl;

    private Boolean configured;

    private String source;

    private String message;

    private List<ModelOptionResponse> models;
}
