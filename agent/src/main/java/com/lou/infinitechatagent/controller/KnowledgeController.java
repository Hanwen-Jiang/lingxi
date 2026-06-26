package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.model.dto.KnowledgeRequest;
import com.lou.infinitechatagent.rag.DocumentIngestionService;
import com.lou.infinitechatagent.rag.dto.DocumentIngestResponse;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
public class KnowledgeController {

    @Resource
    private DocumentIngestionService documentIngestionService;

    @PostMapping("/insert")
    public BaseResponse<DocumentIngestResponse> insertKnowledge(@RequestBody KnowledgeRequest knowledgeRequest) {
        int chunkCount = documentIngestionService.ingestQa(
                knowledgeRequest.getQuestion(),
                knowledgeRequest.getAnswer(),
                knowledgeRequest.getSourceName()
        );
        log.info("RAG - 新增知识点成功: {}", knowledgeRequest.getQuestion());
        return ResultUtils.success(DocumentIngestResponse.builder()
                .sourceType("runtime_qa")
                .fileName(knowledgeRequest.getSourceName())
                .chunkCount(chunkCount)
                .message("插入成功：已同步至文档、向量数据库和引用溯源表")
                .build());
    }
}
