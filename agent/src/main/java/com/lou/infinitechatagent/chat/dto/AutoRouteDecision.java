package com.lou.infinitechatagent.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutoRouteDecision {

    private String route;

    private Boolean forced;

    private String reason;

    private String prompt;

    private String command;
}
