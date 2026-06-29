package com.lou.infinitechatagent.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiDocumentationConfig {

    @Bean
    public OpenAPI agentOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("InfiniteChat Agent API")
                        .version("1.0.0")
                        .description("Agent、RAG、Memory 与 Tool Governance 调试接口文档")
                        .contact(new Contact().name("InfiniteChat")));
    }
}
