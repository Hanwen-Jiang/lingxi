package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.exception.BusinessException;
import com.lou.infinitechatagent.rag.DocumentIngestionService;
import com.lou.infinitechatagent.rag.dto.DocumentIngestRequest;
import com.lou.infinitechatagent.rag.dto.DocumentIngestResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RagDocumentControllerTest {

    @TempDir
    Path tempDir;

    @Test
    void ingestShouldRejectPathOutsideConfiguredDocsRoot() throws Exception {
        Path docsRoot = Files.createDirectory(tempDir.resolve("docs"));
        Path outsideFile = Files.writeString(tempDir.resolve("outside.md"), "outside");
        RagDocumentController controller = controllerWithDocsRoot(docsRoot);

        DocumentIngestRequest request = new DocumentIngestRequest();
        request.setPath(outsideFile.toString());

        assertThatThrownBy(() -> controller.ingest(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("不在允许的文档目录内");
    }

    @Test
    void ingestShouldAllowPathInsideConfiguredDocsRoot() throws Exception {
        Path docsRoot = Files.createDirectory(tempDir.resolve("docs"));
        Path allowedFile = Files.writeString(docsRoot.resolve("allowed.md"), "allowed");
        DocumentIngestionService ingestionService = mock(DocumentIngestionService.class);
        when(ingestionService.ingestDocumentsFromPath(allowedFile.toRealPath().toString())).thenReturn(2);
        RagDocumentController controller = controllerWithDocsRoot(docsRoot, ingestionService);

        DocumentIngestRequest request = new DocumentIngestRequest();
        request.setPath(allowedFile.toString());

        BaseResponse<DocumentIngestResponse> response = controller.ingest(request);

        assertThat(response.getData().getChunkCount()).isEqualTo(2);
        verify(ingestionService).ingestDocumentsFromPath(allowedFile.toRealPath().toString());
    }

    private RagDocumentController controllerWithDocsRoot(Path docsRoot) {
        return controllerWithDocsRoot(docsRoot, mock(DocumentIngestionService.class));
    }

    private RagDocumentController controllerWithDocsRoot(Path docsRoot, DocumentIngestionService ingestionService) {
        RagDocumentController controller = new RagDocumentController();
        ReflectionTestUtils.setField(controller, "documentIngestionService", ingestionService);
        ReflectionTestUtils.setField(controller, "docsPath", docsRoot.toString());
        return controller;
    }
}
