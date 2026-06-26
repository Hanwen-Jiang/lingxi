package com.lou.infinitechatagent.config;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.ModelProvider;
import dev.langchain4j.model.chat.Capability;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.listener.ChatModelListener;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.request.ChatRequestParameters;
import dev.langchain4j.model.chat.request.DefaultChatRequestParameters;
import dev.langchain4j.model.chat.request.ToolChoice;
import dev.langchain4j.model.chat.request.json.JsonAnyOfSchema;
import dev.langchain4j.model.chat.request.json.JsonArraySchema;
import dev.langchain4j.model.chat.request.json.JsonBooleanSchema;
import dev.langchain4j.model.chat.request.json.JsonEnumSchema;
import dev.langchain4j.model.chat.request.json.JsonIntegerSchema;
import dev.langchain4j.model.chat.request.json.JsonNullSchema;
import dev.langchain4j.model.chat.request.json.JsonNumberSchema;
import dev.langchain4j.model.chat.request.json.JsonObjectSchema;
import dev.langchain4j.model.chat.request.json.JsonReferenceSchema;
import dev.langchain4j.model.chat.request.json.JsonSchemaElement;
import dev.langchain4j.model.chat.request.json.JsonStringSchema;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.ChatResponseMetadata;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import dev.langchain4j.model.output.FinishReason;
import dev.langchain4j.model.output.TokenUsage;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class OpenAiCompatibleChatModel implements ChatModel, StreamingChatModel {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
            .setDefaultPropertyInclusion(JsonInclude.Include.NON_NULL);
    private static final String CODEX_DESKTOP_USER_AGENT =
            "Codex Desktop/0.142.0 (Windows 10.0.26200; x86_64) unknown (Codex Desktop; 26.616.71553)";

    private final String baseUrl;
    private final String apiKey;
    private final String modelName;
    private final String reasoningEffort;
    private final RestClient restClient;
    private final HttpClient httpClient;
    private final List<ChatModelListener> listeners;
    private final ChatRequestParameters defaultRequestParameters;

    public OpenAiCompatibleChatModel(String baseUrl,
                                     String apiKey,
                                     String modelName,
                                     Double temperature,
                                     Integer maxOutputTokens,
                                     RestClient restClient) {
        this(baseUrl, apiKey, modelName, temperature, maxOutputTokens, restClient, List.of());
    }

    public OpenAiCompatibleChatModel(String baseUrl,
                                     String apiKey,
                                     String modelName,
                                     Double temperature,
                                     Integer maxOutputTokens,
                                     RestClient restClient,
                                     List<ChatModelListener> listeners) {
        this(baseUrl, apiKey, modelName, temperature, maxOutputTokens, restClient, listeners, null);
    }

    public OpenAiCompatibleChatModel(String baseUrl,
                                     String apiKey,
                                     String modelName,
                                     Double temperature,
                                     Integer maxOutputTokens,
                                     RestClient restClient,
                                     List<ChatModelListener> listeners,
                                     String reasoningEffort) {
        this.baseUrl = trimTrailingSlash(requireText(baseUrl, "baseUrl"));
        this.apiKey = requireText(apiKey, "apiKey");
        this.modelName = requireText(modelName, "modelName");
        this.reasoningEffort = AiModelRuntimeConfig.normalizeReasoningEffort(reasoningEffort);
        this.restClient = Objects.requireNonNull(restClient, "restClient");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
        this.listeners = listeners == null ? List.of() : List.copyOf(listeners);
        this.defaultRequestParameters = DefaultChatRequestParameters.builder()
                .modelName(this.modelName)
                .temperature(temperature)
                .maxOutputTokens(maxOutputTokens)
                .build();
    }

    @Override
    public ChatResponse doChat(ChatRequest request) {
        Map<String, Object> body = buildRequestBody(request, false);
        String requestModel = firstText(request.parameters().modelName(), request.modelName(), modelName);
        var requestSpec = restClient.post()
                .uri(AiModelRuntimeConfig.openAiApiUrl(baseUrl, "/chat/completions"))
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
                .header("Authorization", "Bearer " + apiKey);
        if (isGptSeriesModel(requestModel)) {
            requestSpec = requestSpec.header("User-Agent", CODEX_DESKTOP_USER_AGENT);
        }
        String responseBody = requestSpec
                .body(body)
                .retrieve()
                .body(String.class);

        JsonNode response = parseResponseBody(responseBody);

        String id = text(response.path("id"));
        String responseModel = text(response.path("model"));
        JsonNode choice = response.path("choices").isArray() && !response.path("choices").isEmpty()
                ? response.path("choices").get(0)
                : null;
        if (choice == null) {
            throw new IllegalStateException("OpenAI-compatible response has no choices: " + response);
        }

        JsonNode message = choice.path("message");
        String content = text(message.path("content"));
        AiMessage aiMessage = buildAiMessage(message, content);
        TokenUsage tokenUsage = tokenUsage(response.path("usage"));
        FinishReason finishReason = finishReason(text(choice.path("finish_reason")));

        ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                .id(id)
                .modelName(responseModel != null ? responseModel : modelName)
                .tokenUsage(tokenUsage)
                .finishReason(finishReason)
                .build();

        return ChatResponse.builder()
                .aiMessage(aiMessage)
                .metadata(metadata)
                .build();
    }

    @Override
    public void doChat(ChatRequest request, StreamingChatResponseHandler handler) {
        Map<String, Object> body = buildRequestBody(request, true);
        String requestModel = firstText(request.parameters().modelName(), request.modelName(), modelName);
        try {
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(URI.create(AiModelRuntimeConfig.openAiApiUrl(baseUrl, "/chat/completions")))
                    .timeout(Duration.ofMinutes(5))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Accept", "text/event-stream, application/json")
                    .header("Content-Type", "application/json");
            if (isGptSeriesModel(requestModel)) {
                requestBuilder.header("User-Agent", CODEX_DESKTOP_USER_AGENT);
            }
            HttpResponse<Stream<String>> response = httpClient.send(
                    requestBuilder.POST(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(body))).build(),
                    HttpResponse.BodyHandlers.ofLines()
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String responseBody;
                try (Stream<String> lines = response.body()) {
                    responseBody = lines.collect(Collectors.joining("\n"));
                }
                throw new IllegalStateException("OpenAI-compatible stream failed with HTTP "
                        + response.statusCode() + ": " + responseBody);
            }

            StringBuilder content = new StringBuilder();
            StringBuilder nonSseBody = new StringBuilder();
            String[] responseId = new String[1];
            String[] responseModel = new String[] {requestModel};
            String[] finishReason = new String[1];

            try (Stream<String> lines = response.body()) {
                lines.forEach(rawLine -> handleStreamingLine(
                        rawLine,
                        content,
                        nonSseBody,
                        responseId,
                        responseModel,
                        finishReason,
                        handler
                ));
            }

            if (content.isEmpty() && !nonSseBody.isEmpty()) {
                JsonNode fallback = parseResponseBody(nonSseBody.toString());
                JsonNode choice = fallback.path("choices").isArray() && !fallback.path("choices").isEmpty()
                        ? fallback.path("choices").get(0)
                        : null;
                if (choice != null) {
                    String text = text(choice.path("message").path("content"));
                    if (text != null && !text.isEmpty()) {
                        content.append(text);
                        handler.onPartialResponse(text);
                    }
                    responseId[0] = firstText(responseId[0], text(fallback.path("id")));
                    responseModel[0] = firstText(responseModel[0], text(fallback.path("model")));
                    finishReason[0] = firstText(finishReason[0], text(choice.path("finish_reason")));
                }
            }

            handler.onCompleteResponse(chatResponseFromText(
                    content.toString(),
                    responseId[0],
                    responseModel[0],
                    finishReason[0]
            ));
        } catch (Throwable throwable) {
            handler.onError(throwable);
        }
    }

    private JsonNode parseResponseBody(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            throw new IllegalStateException("OpenAI-compatible response is empty");
        }
        String trimmed = responseBody.trim();
        try {
            if (!trimmed.startsWith("data:")) {
                return OBJECT_MAPPER.readTree(trimmed);
            }
            return parseSseResponse(trimmed);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse OpenAI-compatible response", e);
        }
    }

    private JsonNode parseSseResponse(String responseBody) throws java.io.IOException {
        StringBuilder content = new StringBuilder();
        JsonNode completedResponse = null;
        JsonNode lastChatCompletionChunk = null;

        for (String rawLine : responseBody.split("\\R")) {
            String line = rawLine.trim();
            if (!line.startsWith("data:")) {
                continue;
            }
            String payload = line.substring("data:".length()).trim();
            if (payload.isEmpty() || "[DONE]".equals(payload)) {
                continue;
            }
            JsonNode event = OBJECT_MAPPER.readTree(payload);
            String type = text(event.path("type"));
            if ("response.output_text.delta".equals(type)) {
                content.append(text(event.path("delta")));
            } else if ("response.completed".equals(type)) {
                completedResponse = event.path("response");
            } else if (event.has("choices")) {
                lastChatCompletionChunk = event;
                JsonNode choices = event.path("choices");
                if (choices.isArray() && !choices.isEmpty()) {
                    JsonNode delta = choices.get(0).path("delta");
                    if (!delta.isMissingNode()) {
                        String deltaContent = text(delta.path("content"));
                        if (deltaContent != null) {
                            content.append(deltaContent);
                        }
                    } else {
                        String messageContent = text(choices.get(0).path("message").path("content"));
                        if (messageContent != null) {
                            content.append(messageContent);
                        }
                    }
                }
            }
        }

        if (completedResponse != null && !completedResponse.isMissingNode() && !completedResponse.isNull()) {
            String completedText = extractResponseOutputText(completedResponse);
            if (completedText != null && !completedText.isBlank()) {
                content.setLength(0);
                content.append(completedText);
            }
            return chatCompletionNode(content.toString(), text(completedResponse.path("id")),
                    firstText(text(completedResponse.path("model")), modelName));
        }
        if (!content.isEmpty()) {
            return chatCompletionNode(content.toString(),
                    lastChatCompletionChunk == null ? null : text(lastChatCompletionChunk.path("id")),
                    lastChatCompletionChunk == null ? modelName : firstText(text(lastChatCompletionChunk.path("model")), modelName));
        }
        throw new IllegalStateException("OpenAI-compatible SSE response has no content");
    }

    private String extractResponseOutputText(JsonNode response) {
        JsonNode output = response.path("output");
        if (!output.isArray()) {
            return null;
        }
        StringBuilder text = new StringBuilder();
        for (JsonNode item : output) {
            JsonNode content = item.path("content");
            if (!content.isArray()) {
                continue;
            }
            for (JsonNode part : content) {
                String partText = text(part.path("text"));
                if (partText != null) {
                    text.append(partText);
                }
            }
        }
        return text.toString();
    }

    private JsonNode chatCompletionNode(String content, String id, String model) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("role", "assistant");
        message.put("content", content == null ? "" : content);
        Map<String, Object> choice = new LinkedHashMap<>();
        choice.put("index", 0);
        choice.put("message", message);
        choice.put("finish_reason", "stop");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", id);
        response.put("model", firstText(model, modelName));
        response.put("choices", List.of(choice));
        return OBJECT_MAPPER.valueToTree(response);
    }

    @Override
    public ChatRequestParameters defaultRequestParameters() {
        return defaultRequestParameters;
    }

    @Override
    public List<ChatModelListener> listeners() {
        return listeners;
    }

    @Override
    public ModelProvider provider() {
        return ModelProvider.OPEN_AI;
    }

    @Override
    public Set<Capability> supportedCapabilities() {
        return Set.of();
    }

    private Map<String, Object> buildRequestBody(ChatRequest request, boolean stream) {
        Map<String, Object> body = new LinkedHashMap<>();
        ChatRequestParameters parameters = request.parameters();
        String requestModel = firstText(parameters.modelName(), request.modelName(), modelName);
        body.put("model", requestModel);
        body.put("messages", request.messages().stream().map(this::toOpenAiMessage).toList());
        body.put("stream", stream);
        if (reasoningEffort != null && AiModelRuntimeConfig.supportsReasoningEffort(requestModel)) {
            body.put("reasoning_effort", reasoningEffort);
        }
        if (parameters.temperature() != null) {
            body.put("temperature", parameters.temperature());
        }
        if (parameters.topP() != null) {
            body.put("top_p", parameters.topP());
        }
        if (parameters.frequencyPenalty() != null) {
            body.put("frequency_penalty", parameters.frequencyPenalty());
        }
        if (parameters.presencePenalty() != null) {
            body.put("presence_penalty", parameters.presencePenalty());
        }
        if (parameters.maxOutputTokens() != null) {
            body.put("max_tokens", parameters.maxOutputTokens());
        }
        if (parameters.stopSequences() != null && !parameters.stopSequences().isEmpty()) {
            body.put("stop", parameters.stopSequences());
        }
        if (parameters.toolSpecifications() != null && !parameters.toolSpecifications().isEmpty()) {
            body.put("tools", parameters.toolSpecifications().stream().map(this::toOpenAiTool).toList());
            ToolChoice toolChoice = parameters.toolChoice();
            if (toolChoice != null) {
                body.put("tool_choice", toolChoice == ToolChoice.REQUIRED ? "required" : "auto");
            }
        }
        return body;
    }

    private void handleStreamingLine(String rawLine,
                                     StringBuilder content,
                                     StringBuilder nonSseBody,
                                     String[] responseId,
                                     String[] responseModel,
                                     String[] finishReason,
                                     StreamingChatResponseHandler handler) {
        String line = rawLine == null ? "" : rawLine.trim();
        if (line.isEmpty()) {
            return;
        }
        if (!line.startsWith("data:")) {
            nonSseBody.append(line).append('\n');
            return;
        }
        String payload = line.substring("data:".length()).trim();
        if (payload.isEmpty() || "[DONE]".equals(payload)) {
            return;
        }
        try {
            JsonNode event = OBJECT_MAPPER.readTree(payload);
            String delta = streamingDelta(event, content.isEmpty());
            responseId[0] = firstText(responseId[0], text(event.path("id")), text(event.path("response").path("id")));
            responseModel[0] = firstText(responseModel[0], text(event.path("model")), text(event.path("response").path("model")));
            if (event.has("choices") && event.path("choices").isArray() && !event.path("choices").isEmpty()) {
                finishReason[0] = firstText(finishReason[0], text(event.path("choices").get(0).path("finish_reason")));
            }
            if (delta != null && !delta.isEmpty()) {
                content.append(delta);
                handler.onPartialResponse(delta);
            }
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to parse OpenAI-compatible stream payload", exception);
        }
    }

    private String streamingDelta(JsonNode event, boolean allowCompletedText) {
        String type = text(event.path("type"));
        if ("response.output_text.delta".equals(type)) {
            return text(event.path("delta"));
        }
        if ("response.completed".equals(type) && allowCompletedText) {
            return extractResponseOutputText(event.path("response"));
        }
        if (!event.has("choices") || !event.path("choices").isArray() || event.path("choices").isEmpty()) {
            return null;
        }
        JsonNode choice = event.path("choices").get(0);
        JsonNode delta = choice.path("delta");
        if (!delta.isMissingNode()) {
            String deltaContent = text(delta.path("content"));
            if (deltaContent != null) {
                return deltaContent;
            }
        }
        return text(choice.path("message").path("content"));
    }

    private ChatResponse chatResponseFromText(String content, String id, String responseModel, String finishReasonText) {
        ChatResponseMetadata metadata = ChatResponseMetadata.builder()
                .id(id)
                .modelName(firstText(responseModel, modelName))
                .finishReason(finishReason(finishReasonText))
                .build();
        return ChatResponse.builder()
                .aiMessage(AiMessage.from(content == null ? "" : content))
                .metadata(metadata)
                .build();
    }

    private Map<String, Object> toOpenAiMessage(ChatMessage message) {
        Map<String, Object> item = new LinkedHashMap<>();
        switch (message.type()) {
            case SYSTEM -> {
                item.put("role", "system");
                item.put("content", ((SystemMessage) message).text());
            }
            case USER -> {
                UserMessage userMessage = (UserMessage) message;
                item.put("role", "user");
                item.put("content", userMessage.hasSingleText() ? userMessage.singleText() : userMessage.toString());
            }
            case AI -> {
                AiMessage aiMessage = (AiMessage) message;
                item.put("role", "assistant");
                item.put("content", aiMessage.text());
                if (aiMessage.hasToolExecutionRequests()) {
                    item.put("tool_calls", aiMessage.toolExecutionRequests().stream()
                            .map(this::toOpenAiToolCall)
                            .toList());
                }
            }
            case TOOL_EXECUTION_RESULT -> {
                ToolExecutionResultMessage toolResult = (ToolExecutionResultMessage) message;
                item.put("role", "tool");
                item.put("tool_call_id", toolResult.id());
                item.put("content", toolResult.text());
            }
            default -> {
                item.put("role", "user");
                item.put("content", message.toString());
            }
        }
        return item;
    }

    private Map<String, Object> toOpenAiTool(ToolSpecification specification) {
        Map<String, Object> function = new LinkedHashMap<>();
        function.put("name", specification.name());
        function.put("description", specification.description());
        function.put("parameters", toJsonSchema(specification.parameters()));
        return Map.of("type", "function", "function", function);
    }

    private Map<String, Object> toJsonSchema(JsonSchemaElement schema) {
        Map<String, Object> json = new LinkedHashMap<>();
        if (schema == null) {
            json.put("type", "object");
            json.put("properties", Map.of());
            return json;
        }
        putIfNotBlank(json, "description", schema.description());

        if (schema instanceof JsonObjectSchema objectSchema) {
            json.put("type", "object");
            Map<String, Object> properties = new LinkedHashMap<>();
            if (objectSchema.properties() != null) {
                objectSchema.properties().forEach((name, propertySchema) ->
                        properties.put(name, toJsonSchema(propertySchema)));
            }
            json.put("properties", properties);
            if (objectSchema.required() != null && !objectSchema.required().isEmpty()) {
                json.put("required", objectSchema.required());
            }
            if (objectSchema.additionalProperties() != null) {
                json.put("additionalProperties", objectSchema.additionalProperties());
            }
            if (objectSchema.definitions() != null && !objectSchema.definitions().isEmpty()) {
                Map<String, Object> definitions = new LinkedHashMap<>();
                objectSchema.definitions().forEach((name, definitionSchema) ->
                        definitions.put(name, toJsonSchema(definitionSchema)));
                json.put("$defs", definitions);
            }
        } else if (schema instanceof JsonStringSchema) {
            json.put("type", "string");
        } else if (schema instanceof JsonIntegerSchema) {
            json.put("type", "integer");
        } else if (schema instanceof JsonNumberSchema) {
            json.put("type", "number");
        } else if (schema instanceof JsonBooleanSchema) {
            json.put("type", "boolean");
        } else if (schema instanceof JsonNullSchema) {
            json.put("type", "null");
        } else if (schema instanceof JsonEnumSchema enumSchema) {
            json.put("type", "string");
            json.put("enum", enumSchema.enumValues());
        } else if (schema instanceof JsonArraySchema arraySchema) {
            json.put("type", "array");
            json.put("items", toJsonSchema(arraySchema.items()));
        } else if (schema instanceof JsonReferenceSchema referenceSchema) {
            json.put("$ref", referenceSchema.reference());
        } else if (schema instanceof JsonAnyOfSchema anyOfSchema) {
            json.put("anyOf", anyOfSchema.anyOf().stream().map(this::toJsonSchema).toList());
        } else {
            json.put("type", "object");
        }
        return json;
    }

    private static void putIfNotBlank(Map<String, Object> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    private Map<String, Object> toOpenAiToolCall(ToolExecutionRequest request) {
        Map<String, Object> function = new LinkedHashMap<>();
        function.put("name", request.name());
        function.put("arguments", request.arguments());
        Map<String, Object> toolCall = new LinkedHashMap<>();
        toolCall.put("id", request.id());
        toolCall.put("type", "function");
        toolCall.put("function", function);
        return toolCall;
    }

    private AiMessage buildAiMessage(JsonNode message, String content) {
        JsonNode toolCalls = message.path("tool_calls");
        if (!toolCalls.isArray() || toolCalls.isEmpty()) {
            return AiMessage.from(content == null ? "" : content);
        }
        List<ToolExecutionRequest> requests = new ArrayList<>();
        for (JsonNode toolCall : toolCalls) {
            JsonNode function = toolCall.path("function");
            requests.add(ToolExecutionRequest.builder()
                    .id(text(toolCall.path("id")))
                    .name(text(function.path("name")))
                    .arguments(text(function.path("arguments")))
                    .build());
        }
        return AiMessage.from(content == null ? "" : content, requests);
    }

    private static TokenUsage tokenUsage(JsonNode usage) {
        if (usage == null || usage.isMissingNode() || usage.isNull()) {
            return null;
        }
        Integer input = integer(usage.path("prompt_tokens"));
        Integer output = integer(usage.path("completion_tokens"));
        Integer total = integer(usage.path("total_tokens"));
        return new TokenUsage(input, output, total);
    }

    private static FinishReason finishReason(String value) {
        if (value == null) {
            return null;
        }
        return switch (value.toLowerCase(Locale.ROOT)) {
            case "stop" -> FinishReason.STOP;
            case "length" -> FinishReason.LENGTH;
            case "tool_calls", "function_call" -> FinishReason.TOOL_EXECUTION;
            case "content_filter" -> FinishReason.CONTENT_FILTER;
            default -> FinishReason.OTHER;
        };
    }

    private static String text(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() ? null : node.asText();
    }

    private static Integer integer(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() ? null : node.asInt();
    }

    private static String firstText(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static boolean isGptSeriesModel(String model) {
        return model != null && model.trim().toLowerCase(Locale.ROOT).startsWith("gpt");
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return value;
    }

    private static String trimTrailingSlash(String value) {
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }
}
