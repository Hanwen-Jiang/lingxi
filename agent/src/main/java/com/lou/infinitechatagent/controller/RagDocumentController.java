package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.exception.BusinessException;
import com.lou.infinitechatagent.rag.DocumentIngestJobService;
import com.lou.infinitechatagent.rag.DocumentIngestionService;
import com.lou.infinitechatagent.rag.dto.DocumentIngestJobResponse;
import com.lou.infinitechatagent.rag.dto.DocumentIngestJobStatus;
import com.lou.infinitechatagent.rag.dto.DocumentIngestRequest;
import com.lou.infinitechatagent.rag.dto.DocumentIngestResponse;
import com.lou.infinitechatagent.rag.dto.DocumentTextIngestRequest;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/rag/documents")
public class RagDocumentController {

    @Resource
    private DocumentIngestionService documentIngestionService;

    @Resource
    private DocumentIngestJobService documentIngestJobService;

    @Value("${rag.docs-path:src/main/resources/docs}")
    private String docsPath;

    @Value("${rag.ingest.allow-external-paths:false}")
    private boolean allowExternalPaths;

    @Value("${rag.ingest.upload-dir:./data/rag/uploads}")
    private String uploadDir;

    @Value("${rag.ingest.max-file-size-mb:20}")
    private int maxFileSizeMb;

    @PostMapping("/ingest")
    public BaseResponse<DocumentIngestResponse> ingest(@RequestBody DocumentIngestRequest request) {
        Path realPath = resolveAndValidateLocalPath(request);
        int chunkCount = documentIngestionService.ingestDocumentsFromPath(realPath.toString());
        log.info("RAG - legacy 本地文档入库完成，path={}，chunkCount={}", realPath, chunkCount);
        return ResultUtils.success(DocumentIngestResponse.builder()
                .status(DocumentIngestJobStatus.SUCCEEDED.name())
                .sourceType("legacy_local_file")
                .fileName(fileName(realPath))
                .path(realPath.toString())
                .chunkCount(chunkCount)
                .message(chunkCount > 0 ? "文档入库完成" : "未产生新增片段，可能已入库或文档无有效文本")
                .build());
    }

    @PostMapping("/local-ingest")
    public BaseResponse<DocumentIngestJobResponse> localIngest(@RequestBody DocumentIngestRequest request) {
        Path realPath = resolveAndValidateLocalPath(request);
        DocumentIngestJobResponse job = documentIngestJobService.start(
                "local_file",
                fileName(realPath),
                realPath.toString(),
                () -> documentIngestionService.ingestDocumentsFromPath(realPath.toString(), "local_file")
        );
        return ResultUtils.success(job, "本地入库任务已提交");
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BaseResponse<DocumentIngestJobResponse> upload(@RequestParam("file") MultipartFile file) {
        Path savedPath = saveUpload(file);
        DocumentIngestJobResponse job = documentIngestJobService.start(
                "upload_file",
                fileName(savedPath),
                savedPath.toString(),
                () -> documentIngestionService.ingestDocumentsFromPath(savedPath.toString(), "upload_file")
        );
        return ResultUtils.success(job, "上传入库任务已提交");
    }

    @PostMapping("/text")
    public BaseResponse<DocumentIngestJobResponse> ingestText(@RequestBody DocumentTextIngestRequest request) {
        if (request == null || !StringUtils.hasText(request.getContent())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "content 不能为空");
        }
        String sourceType = StringUtils.hasText(request.getSourceType()) ? request.getSourceType().strip() : "manual_text";
        String fileName = normalizeTextFileName(request.getFileName());
        String content = buildTextContent(request.getTitle(), request.getContent());
        Path savedPath = saveText(fileName, content);
        DocumentIngestJobResponse job = documentIngestJobService.start(
                sourceType,
                fileName(savedPath),
                savedPath.toString(),
                () -> documentIngestionService.ingestDocumentsFromPath(savedPath.toString(), sourceType)
        );
        return ResultUtils.success(job, "文本入库任务已提交");
    }

    @GetMapping("/jobs/{jobId}")
    public BaseResponse<DocumentIngestJobResponse> getJob(@PathVariable String jobId) {
        return ResultUtils.success(documentIngestJobService.find(jobId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "入库任务不存在: " + jobId)));
    }

    private Path resolveAndValidateLocalPath(DocumentIngestRequest request) {
        if (request == null || !StringUtils.hasText(request.getPath())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "path 不能为空");
        }
        Path path = Path.of(request.getPath()).toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "文档路径不存在: " + path);
        }
        Path realPath = realPath(path);
        validatePath(realPath);
        return realPath;
    }

    private Path saveUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "file 不能为空");
        }
        String originalName = sanitizeFileName(file.getOriginalFilename());
        if (!documentIngestionService.isSupportedFileName(originalName)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "仅支持 md、markdown、txt、pdf、doc、docx 文件");
        }
        long maxBytes = Math.max(1, maxFileSizeMb) * 1024L * 1024L;
        if (file.getSize() > maxBytes) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文件大小不能超过 " + maxFileSizeMb + "MB");
        }
        Path uploadRoot = uploadRoot();
        Path target = uploadRoot.resolve(uniqueFileName(originalName)).normalize();
        if (!target.startsWith(uploadRoot)) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "上传文件路径非法");
        }
        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
            return target.toRealPath();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "保存上传文件失败: " + e.getMessage());
        }
    }

    private Path saveText(String fileName, String content) {
        Path textRoot = uploadRoot().resolve("text").normalize();
        try {
            Files.createDirectories(textRoot);
            Path realTextRoot = textRoot.toRealPath();
            Path target = realTextRoot.resolve(uniqueFileName(fileName)).normalize();
            if (!target.startsWith(realTextRoot)) {
                throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "文本文件路径非法");
            }
            Files.writeString(target, content, StandardCharsets.UTF_8);
            return target.toRealPath();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "保存文本失败: " + e.getMessage());
        }
    }

    private String buildTextContent(String title, String content) {
        String normalizedContent = content.strip();
        if (!StringUtils.hasText(title)) {
            return normalizedContent;
        }
        String normalizedTitle = title.strip();
        if (normalizedContent.startsWith("#")) {
            return normalizedContent;
        }
        return "# " + normalizedTitle + "\n\n" + normalizedContent;
    }

    private String normalizeTextFileName(String fileName) {
        String safeName = sanitizeFileName(fileName);
        if (!safeName.contains(".")) {
            return safeName + ".md";
        }
        if (!documentIngestionService.isSupportedFileName(safeName)) {
            return safeName.substring(0, safeName.lastIndexOf('.')) + ".md";
        }
        return safeName;
    }

    private Path uploadRoot() {
        try {
            Path root = Path.of(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(root);
            return root.toRealPath();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "上传目录不可用: " + e.getMessage());
        }
    }

    private String sanitizeFileName(String fileName) {
        String name = StringUtils.hasText(fileName) ? fileName.strip() : "document.md";
        int slashIndex = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slashIndex >= 0 && slashIndex < name.length() - 1) {
            name = name.substring(slashIndex + 1);
        }
        String sanitized = name.replaceAll("[\\\\/:*?\"<>|]+", "_").strip();
        return StringUtils.hasText(sanitized) ? sanitized : "document.md";
    }

    private String uniqueFileName(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        String baseName = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
        String extension = dotIndex > 0 ? fileName.substring(dotIndex) : "";
        return baseName + "-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + extension;
    }

    private String fileName(Path path) {
        return path.getFileName() == null ? path.toString() : path.getFileName().toString();
    }

    private void validatePath(Path realPath) {
        if (allowExternalPaths) {
            return;
        }
        Path docsRoot = Path.of(docsPath).toAbsolutePath().normalize();
        if (!Files.exists(docsRoot)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文档根目录不存在: " + docsRoot);
        }
        Path realDocsRoot = realPath(docsRoot);
        if (!realPath.startsWith(realDocsRoot)) {
            throw new BusinessException(ErrorCode.NO_AUTH_ERROR, "文档路径不在允许的文档目录内: " + realDocsRoot);
        }
    }

    private Path realPath(Path path) {
        try {
            return path.toRealPath();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文档路径解析失败: " + path);
        }
    }
}
