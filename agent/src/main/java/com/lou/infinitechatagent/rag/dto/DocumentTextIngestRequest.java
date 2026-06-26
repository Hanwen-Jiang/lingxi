package com.lou.infinitechatagent.rag.dto;

import lombok.Data;

@Data
public class DocumentTextIngestRequest {

    private String fileName;

    private String title;

    private String content;

    private String sourceType;
}
