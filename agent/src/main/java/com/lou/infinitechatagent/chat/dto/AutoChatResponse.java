package com.lou.infinitechatagent.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.lou.infinitechatagent.rag.dto.Citation;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AutoChatResponse {

    private String route;

    private Boolean forced;

    private String reason;

    private String answer;

    private List<Citation> citations;

    private Object toolTrace;

    private String requestId;

    private String status;

    private String errorMessage;
}
