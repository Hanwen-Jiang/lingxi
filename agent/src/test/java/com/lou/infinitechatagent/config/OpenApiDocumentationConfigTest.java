package com.lou.infinitechatagent.config;

import io.swagger.v3.oas.models.OpenAPI;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OpenApiDocumentationConfigTest {

    @Test
    void exposesAgentOpenApiMetadata() {
        OpenAPI openAPI = new OpenApiDocumentationConfig().agentOpenAPI();

        assertThat(openAPI.getInfo().getTitle()).isEqualTo("InfiniteChat Agent API");
        assertThat(openAPI.getInfo().getVersion()).isEqualTo("v1");
        assertThat(openAPI.getInfo().getDescription()).contains("Agent", "RAG");
    }
}
