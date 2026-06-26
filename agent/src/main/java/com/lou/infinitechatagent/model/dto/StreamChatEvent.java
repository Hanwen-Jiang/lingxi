package com.lou.infinitechatagent.model.dto;

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
public class StreamChatEvent {

    private String type;

    private String requestId;

    private Long sessionId;

    private String text;

    private Integer code;

    private String message;

    private String route;

    private Boolean forced;

    private String reason;

    private List<Citation> citations;

    private Object toolTrace;

    private Integer inputTokens;

    private Integer outputTokens;
}
