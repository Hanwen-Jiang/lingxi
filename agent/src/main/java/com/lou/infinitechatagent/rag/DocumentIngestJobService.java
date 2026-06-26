package com.lou.infinitechatagent.rag;

import com.lou.infinitechatagent.rag.dto.DocumentIngestJobResponse;
import com.lou.infinitechatagent.rag.dto.DocumentIngestJobStatus;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.IntSupplier;

@Service
public class DocumentIngestJobService {

    private final Map<String, DocumentIngestJobResponse> jobs = new ConcurrentHashMap<>();

    private final ExecutorService executorService = Executors.newFixedThreadPool(2);

    public DocumentIngestJobResponse start(String sourceType, String fileName, String path, IntSupplier task) {
        String jobId = "ingest_" + UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        DocumentIngestJobResponse response = DocumentIngestJobResponse.builder()
                .jobId(jobId)
                .status(DocumentIngestJobStatus.PENDING)
                .sourceType(sourceType)
                .fileName(fileName)
                .path(path)
                .chunkCount(0)
                .message("入库任务已提交")
                .createdAt(now)
                .updatedAt(now)
                .build();
        jobs.put(jobId, response);
        executorService.submit(() -> run(jobId, task));
        return response;
    }

    public Optional<DocumentIngestJobResponse> find(String jobId) {
        return Optional.ofNullable(jobs.get(jobId));
    }

    private void run(String jobId, IntSupplier task) {
        update(jobId, DocumentIngestJobStatus.RUNNING, 0, "正在解析并写入知识库");
        try {
            int chunkCount = task.getAsInt();
            String message = chunkCount > 0 ? "文档入库完成" : "未产生新增片段，可能已入库或文档无有效文本";
            update(jobId, DocumentIngestJobStatus.SUCCEEDED, chunkCount, message);
        } catch (Exception e) {
            update(jobId, DocumentIngestJobStatus.FAILED, 0, e.getMessage());
        }
    }

    private void update(String jobId, DocumentIngestJobStatus status, Integer chunkCount, String message) {
        jobs.computeIfPresent(jobId, (id, current) -> {
            current.setStatus(status);
            current.setChunkCount(chunkCount);
            current.setMessage(message);
            current.setUpdatedAt(LocalDateTime.now());
            return current;
        });
    }

    @PreDestroy
    public void shutdown() {
        executorService.shutdownNow();
    }
}
