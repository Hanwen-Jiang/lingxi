package com.lou.infinitechatagent.config;

import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.request.DefaultChatRequestParameters;
import dev.langchain4j.model.chat.request.json.JsonObjectSchema;
import dev.langchain4j.model.chat.request.json.JsonStringSchema;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OpenAiCompatibleChatModelTest {

    @Test
    void postsChatCompletionToConfiguredBaseUrlAndMapsResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OpenAiCompatibleChatModel model = new OpenAiCompatibleChatModel(
                "https://ai.example.test",
                "test-key",
                "gpt-test",
                0.2,
                123,
                builder.build()
        );

        server.expect(once(), requestTo("https://ai.example.test/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("gpt-test"))
                .andExpect(jsonPath("$.messages[0].role").value("system"))
                .andExpect(jsonPath("$.messages[0].content").value("system prompt"))
                .andExpect(jsonPath("$.messages[1].role").value("user"))
                .andExpect(jsonPath("$.messages[1].content").value("hello"))
                .andRespond(withSuccess("""
                        {
                          "id": "chatcmpl-test",
                          "model": "gpt-test",
                          "choices": [{"message": {"content": "world"}, "finish_reason": "stop"}],
                          "usage": {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5}
                        }
                        """, MediaType.APPLICATION_JSON));

        var response = model.chat(ChatRequest.builder()
                .messages(SystemMessage.from("system prompt"), UserMessage.from("hello"))
                .build());

        assertThat(response.aiMessage().text()).isEqualTo("world");
        assertThat(response.metadata().modelName()).isEqualTo("gpt-test");
        assertThat(response.metadata().tokenUsage().inputTokenCount()).isEqualTo(3);
        assertThat(response.metadata().tokenUsage().outputTokenCount()).isEqualTo(2);
        assertThat(response.metadata().tokenUsage().totalTokenCount()).isEqualTo(5);
        server.verify();
    }
    @Test
    void serializesToolParameterSchemaAsOpenAiJsonSchema() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OpenAiCompatibleChatModel model = new OpenAiCompatibleChatModel(
                "https://ai.example.test",
                "test-key",
                "gpt-test",
                0.2,
                123,
                builder.build()
        );

        ToolSpecification tool = ToolSpecification.builder()
                .name("send_email")
                .description("send an email")
                .parameters(JsonObjectSchema.builder()
                        .addStringProperty("to", "recipient")
                        .addProperty("subject", JsonStringSchema.builder().description("subject line").build())
                        .required("to")
                        .build())
                .build();

        server.expect(once(), requestTo("https://ai.example.test/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.tools[0].type").value("function"))
                .andExpect(jsonPath("$.tools[0].function.name").value("send_email"))
                .andExpect(jsonPath("$.tools[0].function.parameters.type").value("object"))
                .andExpect(jsonPath("$.tools[0].function.parameters.properties.to.type").value("string"))
                .andExpect(jsonPath("$.tools[0].function.parameters.properties.to.description").value("recipient"))
                .andExpect(jsonPath("$.tools[0].function.parameters.properties.subject.type").value("string"))
                .andExpect(jsonPath("$.tools[0].function.parameters.required[0]").value("to"))
                .andRespond(withSuccess("""
                        {
                          "id": "chatcmpl-test",
                          "model": "gpt-test",
                          "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                          "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
                        }
                        """, MediaType.APPLICATION_JSON));

        var response = model.chat(ChatRequest.builder()
                .messages(UserMessage.from("hello"))
                .parameters(DefaultChatRequestParameters.builder()
                        .toolSpecifications(tool)
                        .build())
                .build());

        assertThat(response.aiMessage().text()).isEqualTo("ok");
        server.verify();
    }

    @Test
    void streamingChatPostsStreamTrueAndReasoningEffort() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = """
                    data: {"id":"resp-test","model":"gpt-5-test","choices":[{"delta":{"content":"hel"},"finish_reason":null}]}

                    data: {"id":"resp-test","model":"gpt-5-test","choices":[{"delta":{"content":"lo"},"finish_reason":"stop"}]}

                    data: [DONE]

                    """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "text/event-stream");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            OpenAiCompatibleChatModel model = new OpenAiCompatibleChatModel(
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    "test-key",
                    "gpt-5-test",
                    0.2,
                    123,
                    RestClient.builder().build(),
                    List.of(),
                    "high"
            );
            StringBuilder partials = new StringBuilder();
            CountDownLatch done = new CountDownLatch(1);

            model.chat(ChatRequest.builder()
                    .messages(UserMessage.from("hello"))
                    .build(), new StreamingChatResponseHandler() {
                @Override
                public void onPartialResponse(String partialResponse) {
                    partials.append(partialResponse);
                }

                @Override
                public void onCompleteResponse(ChatResponse completeResponse) {
                    done.countDown();
                }

                @Override
                public void onError(Throwable error) {
                    throw new AssertionError(error);
                }
            });

            assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(partials.toString()).isEqualTo("hello");
            assertThat(requestBody.get()).contains("\"stream\":true");
            assertThat(requestBody.get()).contains("\"reasoning_effort\":\"high\"");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void normalizesCurrentOpenAiReasoningEffortValues() {
        assertThat(AiModelRuntimeConfig.normalizeReasoningEffort("none")).isEqualTo("none");
        assertThat(AiModelRuntimeConfig.normalizeReasoningEffort("x-high")).isEqualTo("xhigh");
        assertThat(AiModelRuntimeConfig.normalizeReasoningEffort("extra-high")).isEqualTo("xhigh");
        assertThat(AiModelRuntimeConfig.normalizeReasoningEffort("invalid")).isNull();
    }

}
