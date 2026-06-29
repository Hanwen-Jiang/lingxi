package com.lou.infinitechatagent.common.json;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.infinitechatagent.agent.dto.AgentRequest;
import com.lou.infinitechatagent.model.dto.ChatRequest;
import com.lou.infinitechatagent.memory.dto.MemoryItem;
import com.lou.infinitechatagent.model.dto.StreamChatEvent;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * D5(契约 §5)+ SSE §9 序列化纯逻辑测试(ObjectMapper,无 Mockito → 可 forkCount=0 跑)。
 */
class SnowflakeIdSerializationTest {

    /** 镜像应用配置:NON_NULL(契约 §2 全栈一致)。 */
    private final ObjectMapper mapper = new ObjectMapper()
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    @Test
    void snowflakeId_serializesLongAsJsonString() throws Exception {
        MemoryItem item = MemoryItem.builder()
                .userId(2070816390297817088L)
                .sessionId(123L)
                .build();
        String json = mapper.writeValueAsString(item);
        // id 字段 string 化
        assertThat(json).contains("\"userId\":\"2070816390297817088\"");
        assertThat(json).contains("\"sessionId\":\"123\"");
        // 不得出现裸数字形式
        assertThat(json).doesNotContain("\"userId\":2070816390297817088");
    }

    @Test
    void doubleRead_acceptsBothStringAndNumberId() throws Exception {
        // 新前端发字符串
        AgentRequest fromString = mapper.readValue(
                "{\"userId\":\"2070816390297817088\",\"sessionId\":\"123\",\"prompt\":\"hi\"}",
                AgentRequest.class);
        assertThat(fromString.getUserId()).isEqualTo(2070816390297817088L);
        assertThat(fromString.getSessionId()).isEqualTo("123");
        assertThat(fromString.internalSessionId()).isEqualTo(123L);

        // 老前端发数字(expand/contract 双读过渡)
        AgentRequest fromNumber = mapper.readValue(
                "{\"userId\":2070816390297817088,\"sessionId\":123,\"prompt\":\"hi\"}",
                AgentRequest.class);
        assertThat(fromNumber.getUserId()).isEqualTo(2070816390297817088L);
        assertThat(fromNumber.getSessionId()).isEqualTo("123");
        assertThat(fromNumber.internalSessionId()).isEqualTo(123L);
    }

    @Test
    void sessionId_acceptsClientOnlyStringWithoutJacksonFailure() throws Exception {
        ChatRequest chatRequest = mapper.readValue(
                "{\"sessionId\":\"s-lingxi\",\"prompt\":\"hi\"}",
                ChatRequest.class);
        AgentRequest agentRequest = mapper.readValue(
                "{\"sessionId\":\"s-lingxi\",\"prompt\":\"hi\"}",
                AgentRequest.class);

        assertThat(chatRequest.getSessionId()).isEqualTo("s-lingxi");
        assertThat(agentRequest.getSessionId()).isEqualTo("s-lingxi");
        assertThat(chatRequest.internalSessionId()).isEqualTo(agentRequest.internalSessionId());
        assertThat(chatRequest.internalSessionId()).isPositive();
    }

    @Test
    void nullId_omittedUnderNonNull_notSerializedAsStringNull() throws Exception {
        String json = mapper.writeValueAsString(MemoryItem.builder().build());
        assertThat(json).doesNotContain("userId");
        assertThat(json).doesNotContain("\"null\"");
    }

    @Test
    void streamChatEvent_carriesSchemaVersionAndStringSessionId() throws Exception {
        StreamChatEvent event = StreamChatEvent.builder()
                .type("delta")
                .sessionId("123")
                .text("hi")
                .build();
        String json = mapper.writeValueAsString(event);
        // §9:版本字段 v 默认 "1"
        assertThat(json).contains("\"v\":\"1\"");
        assertThat(json).contains("\"type\":\"delta\"");
        // D5:sessionId string 化
        assertThat(json).contains("\"sessionId\":\"123\"");
        // buffered 为 null → NON_NULL 省略
        assertThat(json).doesNotContain("buffered");
    }

    @Test
    void streamChatEvent_bufferedTrueMarked() throws Exception {
        StreamChatEvent event = StreamChatEvent.builder()
                .type("delta")
                .buffered(Boolean.TRUE)
                .build();
        String json = mapper.writeValueAsString(event);
        assertThat(json).contains("\"buffered\":true");
    }
}
