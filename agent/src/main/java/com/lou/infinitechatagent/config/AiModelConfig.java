package com.lou.infinitechatagent.config;

import com.lou.infinitechatagent.exception.MissingAiModelConfigurationException;
import com.lou.infinitechatagent.monitor.AiModelMonitorListener;
import dev.langchain4j.community.model.dashscope.QwenChatModel;
import dev.langchain4j.community.model.dashscope.QwenEmbeddingModel;
import dev.langchain4j.community.model.dashscope.QwenStreamingChatModel;
import dev.langchain4j.model.ModelProvider;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.request.ChatRequestParameters;
import dev.langchain4j.model.chat.request.DefaultChatRequestParameters;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.embedding.EmbeddingModel;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.web.client.RestClient;

import java.util.List;

@Configuration
@Slf4j
public class AiModelConfig {

    @Value("${pgvector.dimension:1024}")
    private int embeddingDimension;

    @Value("${langchain4j.community.dashscope.embedding-model.api-key:}")
    private String dashScopeEmbeddingApiKey;

    @Value("${langchain4j.community.dashscope.embedding-model.model-name:text-embedding-v4}")
    private String dashScopeEmbeddingModel;

    @Resource
    private AiModelMonitorListener aiModelMonitorListener;

    @Resource
    private AiModelRuntimeConfig aiModelRuntimeConfig;

    @Bean
    @Primary
    public ChatModel chatModel(RestClient.Builder restClientBuilder) {
        return new RuntimeSwitchingChatModel(aiModelRuntimeConfig, restClientBuilder, aiModelMonitorListener);
    }

    @Bean
    @Primary
    public StreamingChatModel streamingChatModel(RestClient.Builder restClientBuilder) {
        return new RuntimeSwitchingStreamingChatModel(aiModelRuntimeConfig, restClientBuilder, aiModelMonitorListener);
    }

    @Bean
    @Primary
    public EmbeddingModel embeddingModel() {
        // F06/M15:有 DASHSCOPE_API_KEY 时用真实语义嵌入(text-embedding-v4),dimension 与 PgVector 表对齐;
        // 否则显式降级到 HashEmbeddingModel(哈希伪向量,无语义,仅供本地无网络跑通)。
        if (hasText(dashScopeEmbeddingApiKey)) {
            log.info("RAG Embedding - 使用 DashScope 真实嵌入模型 {}(dimension={})", dashScopeEmbeddingModel, embeddingDimension);
            return QwenEmbeddingModel.builder()
                    .apiKey(dashScopeEmbeddingApiKey)
                    .modelName(dashScopeEmbeddingModel)
                    .dimension(embeddingDimension)
                    .build();
        }
        log.warn("RAG Embedding - 未配置 DASHSCOPE_API_KEY,降级到 HashEmbeddingModel(哈希伪向量,无语义召回)。"
                + "真实检索请配置 DASHSCOPE_API_KEY 以启用 {} 语义嵌入。", dashScopeEmbeddingModel);
        return new HashEmbeddingModel(embeddingDimension);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String openAiCompatibleMissingMessage(AiModelRuntimeConfig.ModelConfig config) {
        if (!hasText(config.baseUrl())) {
            return "AI 模型未配置：请设置 OpenAI-compatible Base URL。";
        }
        if (!hasText(config.apiKey())) {
            return "AI 模型未配置：请设置 OpenAI-compatible API key。";
        }
        if (!hasText(config.model())) {
            return "AI 模型未配置：请设置 OpenAI-compatible model。";
        }
        return null;
    }

    private static class RuntimeSwitchingChatModel implements ChatModel {

        private final AiModelRuntimeConfig runtimeConfig;
        private final RestClient.Builder restClientBuilder;
        private final AiModelMonitorListener listener;

        private RuntimeSwitchingChatModel(AiModelRuntimeConfig runtimeConfig,
                                          RestClient.Builder restClientBuilder,
                                          AiModelMonitorListener listener) {
            this.runtimeConfig = runtimeConfig;
            this.restClientBuilder = restClientBuilder;
            this.listener = listener;
        }

        @Override
        public ChatResponse doChat(ChatRequest request) {
            return delegate().chat(request);
        }

        @Override
        public ChatRequestParameters defaultRequestParameters() {
            return DefaultChatRequestParameters.builder()
                    .modelName(runtimeConfig.current().model())
                    .build();
        }

        @Override
        public ModelProvider provider() {
            AiModelRuntimeConfig.ModelConfig config = runtimeConfig.current();
            return AiModelRuntimeConfig.isOpenAiCompatible(config.provider()) ? ModelProvider.OPEN_AI : ModelProvider.OTHER;
        }

        private ChatModel delegate() {
            AiModelRuntimeConfig.ModelConfig config = runtimeConfig.current();
            if (AiModelRuntimeConfig.isOpenAiCompatible(config.provider())) {
                String missingMessage = openAiCompatibleMissingMessage(config);
                if (missingMessage != null) {
                    return new UnavailableChatModel(missingMessage, config.model());
                }
                return new OpenAiCompatibleChatModel(
                        config.baseUrl(),
                        config.apiKey(),
                        config.model(),
                        config.temperature(),
                        config.maxOutputTokens(),
                        restClientBuilder.build(),
                        List.of(listener),
                        config.reasoningEffort()
                );
            }
            if (!hasText(config.apiKey())) {
                return new UnavailableChatModel("AI 模型未配置：请设置 DASHSCOPE_API_KEY 后重试聊天、Agent 或 RAG 问答。", config.model());
            }
            return QwenChatModel.builder()
                    .apiKey(config.apiKey())
                    .modelName(config.model())
                    .listeners(List.of(listener))
                    .build();
        }
    }

    private static class RuntimeSwitchingStreamingChatModel implements StreamingChatModel {

        private final AiModelRuntimeConfig runtimeConfig;
        private final RestClient.Builder restClientBuilder;
        private final AiModelMonitorListener listener;

        private RuntimeSwitchingStreamingChatModel(AiModelRuntimeConfig runtimeConfig,
                                                   RestClient.Builder restClientBuilder,
                                                   AiModelMonitorListener listener) {
            this.runtimeConfig = runtimeConfig;
            this.restClientBuilder = restClientBuilder;
            this.listener = listener;
        }

        @Override
        public void doChat(ChatRequest request, StreamingChatResponseHandler handler) {
            streamingDelegate().chat(request, handler);
        }

        @Override
        public ChatRequestParameters defaultRequestParameters() {
            return DefaultChatRequestParameters.builder()
                    .modelName(runtimeConfig.current().model())
                    .build();
        }

        private StreamingChatModel streamingDelegate() {
            AiModelRuntimeConfig.ModelConfig config = runtimeConfig.current();
            if (AiModelRuntimeConfig.isOpenAiCompatible(config.provider())) {
                String missingMessage = openAiCompatibleMissingMessage(config);
                if (missingMessage != null) {
                    return new UnavailableStreamingChatModel(missingMessage, config.model());
                }
                return new OpenAiCompatibleChatModel(
                        config.baseUrl(),
                        config.apiKey(),
                        config.model(),
                        config.temperature(),
                        config.maxOutputTokens(),
                        restClientBuilder.build(),
                        List.of(listener),
                        config.reasoningEffort(),
                        config.streamTimeoutSeconds()
                );
            }
            if (!hasText(config.apiKey())) {
                return new UnavailableStreamingChatModel(
                        "AI 模型未配置：请设置 DASHSCOPE_API_KEY 后重试流式聊天。",
                        config.model()
                );
            }
            return QwenStreamingChatModel.builder()
                    .apiKey(config.apiKey())
                    .modelName(config.model())
                    .listeners(List.of(listener))
                    .build();
        }
    }

    private static class UnavailableChatModel implements ChatModel {

        private final String message;
        private final ChatRequestParameters defaultRequestParameters;

        private UnavailableChatModel(String message, String modelName) {
            this.message = message;
            this.defaultRequestParameters = DefaultChatRequestParameters.builder()
                    .modelName(hasText(modelName) ? modelName : "unconfigured")
                    .build();
        }

        @Override
        public ChatResponse doChat(ChatRequest request) {
            throw new MissingAiModelConfigurationException(message);
        }

        @Override
        public ChatRequestParameters defaultRequestParameters() {
            return defaultRequestParameters;
        }

        @Override
        public ModelProvider provider() {
            return ModelProvider.OTHER;
        }
    }

    private static class UnavailableStreamingChatModel implements StreamingChatModel {

        private final String message;
        private final ChatRequestParameters defaultRequestParameters;

        private UnavailableStreamingChatModel(String message, String modelName) {
            this.message = message;
            this.defaultRequestParameters = DefaultChatRequestParameters.builder()
                    .modelName(hasText(modelName) ? modelName : "unconfigured")
                    .build();
        }

        @Override
        public void doChat(ChatRequest request, StreamingChatResponseHandler handler) {
            handler.onError(new MissingAiModelConfigurationException(message));
        }

        @Override
        public ChatRequestParameters defaultRequestParameters() {
            return defaultRequestParameters;
        }

        @Override
        public ModelProvider provider() {
            return ModelProvider.OTHER;
        }
    }

}
