package com.lou.infinitechatagent.rag.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentIngestJobResponse {

    private String jobId;

    private DocumentIngestJobStatus status;

    private String sourceType;

    private String fileName;

    private String path;

    private Integer chunkCount;

    private String message;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
