package com.lou.infinitechatagent.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.infinitechatagent.chat.dto.ModelConfigRequest;
import com.lou.infinitechatagent.chat.dto.ModelListResponse;
import com.lou.infinitechatagent.chat.dto.ModelOptionResponse;
import com.lou.infinitechatagent.chat.dto.ModelStatusResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class AiModelRuntimeConfig {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Set<String> REASONING_EFFORTS = Set.of("none", "minimal", "low", "medium", "high", "xhigh");

    private final String defaultProvider;
    private final String defaultOpenAiBaseUrl;
    private final String defaultOpenAiApiKey;
    private final String defaultOpenAiChatModel;
    private final Double defaultOpenAiTemperature;
    private final Integer defaultOpenAiMaxOutputTokens;
    private final String defaultOpenAiReasoningEffort;
    private final Integer defaultOpenAiStreamTimeoutSeconds;
    private final String defaultDashScopeApiKey;
    private final String defaultDashScopeChatModel;
    private final AtomicReference<ModelConfig> override = new AtomicReference<>();

    public AiModelRuntimeConfig(
            @Value("${agent.model.provider:auto}") String defaultProvider,
            @Value("${agent.model.openai-compatible.base-url:${AGENT_MODEL_OPENAI_COMPATIBLE_BASE_URL:https://api.openai.com}}") String defaultOpenAiBaseUrl,
            @Value("${agent.model.openai-compatible.api-key:${AGENT_MODEL_OPENAI_COMPATIBLE_API_KEY:}}") String defaultOpenAiApiKey,
            @Value("${agent.model.openai-compatible.chat-model:${AGENT_MODEL_OPENAI_COMPATIBLE_CHAT_MODEL:gpt-5.4-mini}}") String defaultOpenAiChatModel,
            @Value("${agent.model.openai-compatible.temperature:${AGENT_MODEL_OPENAI_COMPATIBLE_TEMPERATURE:0.7}}") Double defaultOpenAiTemperature,
            @Value("${agent.model.openai-compatible.max-output-tokens:${AGENT_MODEL_OPENAI_COMPATIBLE_MAX_OUTPUT_TOKENS:1024}}") Integer defaultOpenAiMaxOutputTokens,
            @Value("${agent.model.openai-compatible.reasoning-effort:high}") String defaultOpenAiReasoningEffort,
            @Value("${agent.model.openai-compatible.stream-timeout-seconds:15}") Integer defaultOpenAiStreamTimeoutSeconds,
            @Value("${langchain4j.community.dashscope.chat-model.api-key:}") String defaultDashScopeApiKey,
            @Value("${langchain4j.community.dashscope.chat-model.model-name:qwen-plus}") String defaultDashScopeChatModel) {
        this.defaultProvider = defaultProvider;
        this.defaultOpenAiBaseUrl = defaultOpenAiBaseUrl;
        this.defaultOpenAiApiKey = defaultOpenAiApiKey;
        this.defaultOpenAiChatModel = defaultOpenAiChatModel;
        this.defaultOpenAiTemperature = defaultOpenAiTemperature;
        this.defaultOpenAiMaxOutputTokens = defaultOpenAiMaxOutputTokens;
        this.defaultOpenAiReasoningEffort = defaultOpenAiReasoningEffort;
        this.defaultOpenAiStreamTimeoutSeconds = defaultOpenAiStreamTimeoutSeconds;
        this.defaultDashScopeApiKey = defaultDashScopeApiKey;
        this.defaultDashScopeChatModel = defaultDashScopeChatModel;
    }

    public ModelConfig current() {
        ModelConfig custom = override.get();
        return custom == null ? defaultConfig() : custom;
    }

    public ModelConfig update(ModelConfigRequest request) {
        ModelConfig current = current();
        String provider = normalizeProvider(firstText(request == null ? null : request.getProvider(), current.provider()));
        boolean openAiCompatible = isOpenAiCompatible(provider);
        ModelConfig next;
        if (openAiCompatible) {
            boolean currentOpenAiCompatible = isOpenAiCompatible(current.provider());
            next = new ModelConfig(
                    provider,
                    firstText(request == null ? null : request.getBaseUrl(), currentOpenAiCompatible ? current.baseUrl() : null, defaultOpenAiBaseUrl),
                    firstText(request == null ? null : request.getApiKey(), currentOpenAiCompatible ? current.apiKey() : null, defaultOpenAiApiKey),
                    firstText(request == null ? null : request.getModel(), currentOpenAiCompatible ? current.model() : null, defaultOpenAiChatModel),
                    firstNumber(request == null ? null : request.getTemperature(), currentOpenAiCompatible ? current.temperature() : null, defaultOpenAiTemperature),
                    firstNumber(request == null ? null : request.getMaxOutputTokens(), currentOpenAiCompatible ? current.maxOutputTokens() : null, defaultOpenAiMaxOutputTokens),
                    normalizeReasoningEffort(firstText(
                            request == null ? null : request.getReasoningEffort(),
                            currentOpenAiCompatible ? current.reasoningEffort() : null,
                            defaultOpenAiReasoningEffort
                    )),
                    currentOpenAiCompatible ? current.streamTimeoutSeconds() : defaultOpenAiStreamTimeoutSeconds
            );
        } else {
            next = new ModelConfig(
                    "dashscope",
                    null,
                    firstText(request == null ? null : request.getApiKey(), defaultDashScopeApiKey),
                    firstText(request == null ? null : request.getModel(), defaultDashScopeChatModel),
                    null,
                    null,
                    null,
                    null
            );
        }
        override.set(next);
        return next;
    }

    public ModelListResponse listModels() {
        ModelConfig config = current();
        boolean openAiCompatible = isOpenAiCompatible(config.provider());
        List<ModelOptionResponse> fallback = configuredModelFallback(config);
        if (!openAiCompatible) {
            return ModelListResponse.builder()
                    .provider(config.provider())
                    .configured(hasText(config.apiKey()))
                    .source("configured")
                    .message("Model listing is only available for OpenAI-compatible providers.")
                    .models(fallback)
                    .build();
        }
        if (!hasText(config.baseUrl()) || !hasText(config.apiKey())) {
            return ModelListResponse.builder()
                    .provider(config.provider())
                    .baseUrl(config.baseUrl())
                    .configured(false)
                    .source("configured")
                    .message("Configure an OpenAI-compatible base URL and API key before loading models.")
                    .models(fallback)
                    .build();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(openAiApiUrl(config.baseUrl(), "/models")))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + config.apiKey())
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return ModelListResponse.builder()
                        .provider(config.provider())
                        .baseUrl(config.baseUrl())
                        .configured(true)
                        .source("configured")
                        .message("Upstream model list failed with HTTP " + response.statusCode() + ".")
                        .models(fallback)
                        .build();
            }
            List<ModelOptionResponse> models = parseModels(response.body(), config.model());
            return ModelListResponse.builder()
                    .provider(config.provider())
                    .baseUrl(config.baseUrl())
                    .configured(true)
                    .source("upstream")
                    .message(models.isEmpty() ? "Upstream returned no models." : "Loaded models from upstream.")
                    .models(models.isEmpty() ? fallback : models)
                    .build();
        } catch (Exception exception) {
            return ModelListResponse.builder()
                    .provider(config.provider())
                    .baseUrl(config.baseUrl())
                    .configured(true)
                    .source("configured")
                    .message("Could not load upstream models: " + exception.getMessage())
                    .models(fallback)
                    .build();
        }
    }

    public ModelStatusResponse status() {
        ModelConfig config = current();
        boolean openAiCompatible = isOpenAiCompatible(config.provider());
        boolean configured = openAiCompatible
                ? hasText(config.baseUrl()) && hasText(config.apiKey()) && hasText(config.model())
                : hasText(defaultDashScopeApiKey);
        String message = configured
                ? "AI model configured"
                : (openAiCompatible
                ? "Missing OpenAI-compatible model API key or base URL"
                : "Missing DASHSCOPE_API_KEY");
        return ModelStatusResponse.builder()
                .provider(config.provider())
                .model(config.model())
                .baseUrl(openAiCompatible ? config.baseUrl() : null)
                .temperature(openAiCompatible ? config.temperature() : null)
                .maxOutputTokens(openAiCompatible ? config.maxOutputTokens() : null)
                .reasoningEffort(openAiCompatible ? config.reasoningEffort() : null)
                .configured(configured)
                .runtimeEditable(true)
                .message(message)
                .build();
    }

    private ModelConfig defaultConfig() {
        String provider = normalizeProvider(defaultProvider);
        if ("auto".equals(provider)) {
            provider = hasText(defaultOpenAiApiKey) || !hasText(defaultDashScopeApiKey) ? "openai-compatible" : "dashscope";
        }
        if (isOpenAiCompatible(provider)) {
            return new ModelConfig(
                    provider,
                    firstText(defaultOpenAiBaseUrl, "https://api.openai.com"),
                    defaultOpenAiApiKey,
                    firstText(defaultOpenAiChatModel, "gpt-5.4-mini"),
                    firstNumber(defaultOpenAiTemperature, 0.7),
                    firstNumber(defaultOpenAiMaxOutputTokens, 1024),
                    normalizeReasoningEffort(firstText(defaultOpenAiReasoningEffort, "high")),
                    firstNumber(defaultOpenAiStreamTimeoutSeconds, 15)
            );
        }
        return new ModelConfig(
                "dashscope",
                null,
                defaultDashScopeApiKey,
                firstText(defaultDashScopeChatModel, "qwen-plus"),
                null,
                null,
                null,
                null
        );
    }

    public static String openAiApiUrl(String baseUrl, String path) {
        String base = firstText(baseUrl, "https://api.openai.com");
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String cleanPath = path.startsWith("/") ? path : "/" + path;
        if (base.toLowerCase(Locale.ROOT).endsWith("/v1")) {
            return base + cleanPath;
        }
        return base + "/v1" + cleanPath;
    }

    public static boolean isOpenAiCompatible(String provider) {
        return "openai-compatible".equalsIgnoreCase(provider)
                || "openai".equalsIgnoreCase(provider)
                || "deepseek".equalsIgnoreCase(provider);
    }

    private static String normalizeProvider(String provider) {
        String value = hasText(provider) ? provider.trim().toLowerCase(Locale.ROOT) : "auto";
        if ("openai".equals(value) || "deepseek".equals(value)) {
            return "openai-compatible";
        }
        return value;
    }

    public static String normalizeReasoningEffort(String value) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.strip().toLowerCase(Locale.ROOT).replace("_", "-");
        if ("x-high".equals(normalized) || "extra-high".equals(normalized)) {
            normalized = "xhigh";
        }
        return REASONING_EFFORTS.contains(normalized) ? normalized : null;
    }

    public static boolean supportsReasoningEffort(String model) {
        if (!hasText(model)) {
            return false;
        }
        String normalized = model.strip().toLowerCase(Locale.ROOT);
        return normalized.startsWith("gpt-5") || normalized.startsWith("o");
    }

    private static boolean hasText(String value) {
        return StringUtils.hasText(value);
    }

    private static String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.strip();
            }
        }
        return null;
    }

    @SafeVarargs
    private static <T extends Number> T firstNumber(T... values) {
        if (values == null) {
            return null;
        }
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    public record ModelConfig(
            String provider,
            String baseUrl,
            String apiKey,
            String model,
            Double temperature,
            Integer maxOutputTokens,
            String reasoningEffort,
            Integer streamTimeoutSeconds
    ) {
    }

    private static List<ModelOptionResponse> configuredModelFallback(ModelConfig config) {
        if (!hasText(config.model())) {
            return List.of();
        }
        return List.of(ModelOptionResponse.builder()
                .id(config.model())
                .ownedBy("configured")
                .build());
    }

    private static List<ModelOptionResponse> parseModels(String responseBody, String configuredModel) throws Exception {
        JsonNode data = OBJECT_MAPPER.readTree(responseBody).path("data");
        if (!data.isArray()) {
            return configuredModelFallback(new ModelConfig(null, null, null, configuredModel, null, null, null, null));
        }
        Set<String> seen = new LinkedHashSet<>();
        List<ModelOptionResponse> models = new ArrayList<>();
        if (hasText(configuredModel)) {
            seen.add(configuredModel);
            models.add(ModelOptionResponse.builder().id(configuredModel).ownedBy("configured").build());
        }
        for (JsonNode item : data) {
            String id = text(item.path("id"));
            if (!hasText(id) || !seen.add(id)) {
                continue;
            }
            models.add(ModelOptionResponse.builder()
                    .id(id)
                    .ownedBy(firstText(text(item.path("owned_by")), text(item.path("ownedBy"))))
                    .build());
        }
        return models;
    }

    private static String text(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() ? null : node.asText();
    }
}
