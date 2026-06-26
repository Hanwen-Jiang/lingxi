package com.lou.infinitechatagent.chat;

import com.lou.infinitechatagent.chat.dto.ChatSessionCreateRequest;
import com.lou.infinitechatagent.chat.dto.ChatSessionDetail;
import com.lou.infinitechatagent.chat.dto.ChatSessionSummary;
import com.lou.infinitechatagent.chat.dto.ChatTurnSummary;
import com.lou.infinitechatagent.chat.dto.ModelConfigRequest;
import com.lou.infinitechatagent.chat.dto.ModelListResponse;
import com.lou.infinitechatagent.chat.dto.ModelStatusResponse;
import com.lou.infinitechatagent.config.AiModelRuntimeConfig;
import com.lou.infinitechatagent.config.RagJdbcConfig;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.request.ChatRequest;
import dev.langchain4j.model.chat.response.ChatResponse;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class ChatHistoryService {

    private static final int MAX_TITLE_CHARS = 48;
    private static final int MAX_SUMMARY_CHARS = 220;
    private static final int MAX_MINI_SUMMARY_CHARS = 180;

    @Resource
    private JdbcTemplate ragJdbcTemplate;

    @Resource
    private ChatModel chatModel;

    @Resource
    private AiModelRuntimeConfig aiModelRuntimeConfig;

    public ChatSessionSummary createSession(ChatSessionCreateRequest request) {
        Long userId = request == null || request.getUserId() == null ? 1L : request.getUserId();
        Long sessionId = request == null || request.getSessionId() == null ? System.currentTimeMillis() : request.getSessionId();
        String mode = normalizeMode(request == null ? null : request.getMode());
        String title = StringUtils.hasText(request == null ? null : request.getTitle())
                ? limit(request.getTitle().strip(), MAX_TITLE_CHARS)
                : "New conversation";
        ensureSession(userId, sessionId, mode, title);
        return findSession(userId, sessionId).orElseThrow();
    }

    public List<ChatSessionSummary> listSessions(Long userId, int limit) {
        long safeUserId = userId == null ? 1L : userId;
        int safeLimit = Math.max(1, Math.min(limit, 100));
        return ragJdbcTemplate.query("""
                select user_id, session_id, title, mode, summary, turn_count, last_status, last_message_at, created_at, updated_at
                from chat_session
                where user_id = ?
                order by coalesce(last_message_at, updated_at, created_at) desc
                limit ?
                """, this::mapSession, safeUserId, safeLimit);
    }

    public ChatSessionDetail getSession(Long userId, Long sessionId) {
        long safeUserId = userId == null ? 1L : userId;
        ChatSessionSummary session = findSession(safeUserId, sessionId)
                .orElseGet(() -> createSession(defaultRequest(safeUserId, sessionId)));
        List<ChatTurnSummary> turns = ragJdbcTemplate.query("""
                select id, user_id, session_id, mode, prompt, answer, status, request_id, mini_summary, error_message, metadata_json, created_at
                from chat_turn
                where user_id = ? and session_id = ?
                order by created_at asc, id asc
                """, this::mapTurn, safeUserId, sessionId);
        return ChatSessionDetail.builder()
                .session(session)
                .turns(turns)
                .build();
    }

    public ChatSessionSummary summarize(Long userId, Long sessionId) {
        long safeUserId = userId == null ? 1L : userId;
        ChatSessionDetail detail = getSession(safeUserId, sessionId);
        String summary = buildRefreshSummary(detail.getSession().getSummary(), detail.getTurns());
        if (RagJdbcConfig.isH2(ragJdbcTemplate)) {
            ragJdbcTemplate.update("""
                    update chat_session
                    set summary = ?, updated_at = current_timestamp
                    where user_id = ? and session_id = ?
                    """, summary, safeUserId, sessionId);
        } else {
            ragJdbcTemplate.update("""
                    update chat_session
                    set summary = ?, updated_at = now()
                    where user_id = ? and session_id = ?
                    """, summary, safeUserId, sessionId);
        }
        return findSession(safeUserId, sessionId).orElseThrow();
    }

    public void recordSuccess(Long userId, Long sessionId, String mode, String prompt, String answer, String requestId, String metadataJson) {
        recordTurn(userId, sessionId, mode, prompt, answer, "SUCCESS", requestId, null, metadataJson);
    }

    public void recordError(Long userId, Long sessionId, String mode, String prompt, String errorMessage, String requestId, String metadataJson) {
        recordTurn(userId, sessionId, mode, prompt, null, "ERROR", requestId, errorMessage, metadataJson);
    }

    public ModelStatusResponse modelStatus() {
        return aiModelRuntimeConfig.status();
    }

    public ModelStatusResponse updateModelConfig(ModelConfigRequest request) {
        aiModelRuntimeConfig.update(request);
        return aiModelRuntimeConfig.status();
    }

    public ModelListResponse listModels() {
        return aiModelRuntimeConfig.listModels();
    }

    private void recordTurn(Long userId, Long sessionId, String mode, String prompt, String answer, String status, String requestId, String errorMessage, String metadataJson) {
        if (sessionId == null) {
            return;
        }
        long safeUserId = userId == null ? 1L : userId;
        String safeMode = normalizeMode(mode);
        String title = titleFromPrompt(prompt);
        String miniSummary = buildMiniSummary(prompt, answer, errorMessage, status);
        ensureSession(safeUserId, sessionId, safeMode, title);
        ragJdbcTemplate.update("""
                insert into chat_turn (user_id, session_id, mode, prompt, answer, status, request_id, mini_summary, error_message, metadata_json, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
                """, safeUserId, sessionId, safeMode, nullToBlank(prompt), answer, status, requestId, miniSummary, errorMessage, metadataJson);
        int turnCount = countTurns(safeUserId, sessionId);
        String summary = buildSessionSummary(latestTurns(safeUserId, sessionId, 8));
        if (RagJdbcConfig.isH2(ragJdbcTemplate)) {
            ragJdbcTemplate.update("""
                    update chat_session
                    set title = case when title = 'New conversation' then ? else title end,
                        mode = ?,
                        summary = ?,
                        turn_count = ?,
                        last_status = ?,
                        last_message_at = current_timestamp,
                        updated_at = current_timestamp
                    where user_id = ? and session_id = ?
                    """, title, safeMode, summary, turnCount, status, safeUserId, sessionId);
        } else {
            ragJdbcTemplate.update("""
                    update chat_session
                    set title = case when title = 'New conversation' then ? else title end,
                        mode = ?,
                        summary = ?,
                        turn_count = ?,
                        last_status = ?,
                        last_message_at = now(),
                        updated_at = now()
                    where user_id = ? and session_id = ?
                    """, title, safeMode, summary, turnCount, status, safeUserId, sessionId);
        }
    }

    private void ensureSession(Long userId, Long sessionId, String mode, String title) {
        if (findSession(userId, sessionId).isPresent()) {
            return;
        }
        ragJdbcTemplate.update("""
                insert into chat_session (user_id, session_id, title, mode, summary, turn_count, last_status, last_message_at, created_at, updated_at)
                values (?, ?, ?, ?, '', 0, null, null, current_timestamp, current_timestamp)
                """, userId, sessionId, title, normalizeMode(mode));
    }

    private Optional<ChatSessionSummary> findSession(Long userId, Long sessionId) {
        if (sessionId == null) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(ragJdbcTemplate.queryForObject("""
                    select user_id, session_id, title, mode, summary, turn_count, last_status, last_message_at, created_at, updated_at
                    from chat_session
                    where user_id = ? and session_id = ?
                    """, this::mapSession, userId, sessionId));
        } catch (EmptyResultDataAccessException exception) {
            return Optional.empty();
        }
    }

    private int countTurns(Long userId, Long sessionId) {
        Integer count = ragJdbcTemplate.queryForObject("""
                select count(1)
                from chat_turn
                where user_id = ? and session_id = ?
                """, Integer.class, userId, sessionId);
        return count == null ? 0 : count;
    }

    private List<ChatTurnSummary> latestTurns(Long userId, Long sessionId, int limit) {
        return ragJdbcTemplate.query("""
                select *
                from (
                    select id, user_id, session_id, mode, prompt, answer, status, request_id, mini_summary, error_message, metadata_json, created_at
                    from chat_turn
                    where user_id = ? and session_id = ?
                    order by created_at desc, id desc
                    limit ?
                ) recent
                order by created_at asc, id asc
                """, this::mapTurn, userId, sessionId, limit);
    }

    private ChatSessionSummary mapSession(ResultSet rs, int rowNum) throws java.sql.SQLException {
        return ChatSessionSummary.builder()
                .userId(rs.getLong("user_id"))
                .sessionId(rs.getLong("session_id"))
                .title(rs.getString("title"))
                .mode(rs.getString("mode"))
                .summary(rs.getString("summary"))
                .turnCount(rs.getInt("turn_count"))
                .lastStatus(rs.getString("last_status"))
                .lastMessageAt(toLocalDateTime(rs.getTimestamp("last_message_at")))
                .createdAt(toLocalDateTime(rs.getTimestamp("created_at")))
                .updatedAt(toLocalDateTime(rs.getTimestamp("updated_at")))
                .build();
    }

    private ChatTurnSummary mapTurn(ResultSet rs, int rowNum) throws java.sql.SQLException {
        return ChatTurnSummary.builder()
                .id(rs.getLong("id"))
                .userId(rs.getLong("user_id"))
                .sessionId(rs.getLong("session_id"))
                .mode(rs.getString("mode"))
                .prompt(rs.getString("prompt"))
                .answer(rs.getString("answer"))
                .status(rs.getString("status"))
                .requestId(rs.getString("request_id"))
                .miniSummary(rs.getString("mini_summary"))
                .errorMessage(rs.getString("error_message"))
                .metadataJson(rs.getString("metadata_json"))
                .createdAt(toLocalDateTime(rs.getTimestamp("created_at")))
                .build();
    }

    private String buildMiniSummary(String prompt, String answer, String errorMessage, String status) {
        if ("ERROR".equals(status)) {
            return limit("请求失败：" + friendlyError(errorMessage), MAX_MINI_SUMMARY_CHARS);
        }
        String promptPart = limit(nullToBlank(prompt), 72);
        String answerPart = limit(nullToBlank(answer), 84);
        if (!StringUtils.hasText(answerPart)) {
            return limit("用户：" + promptPart, MAX_MINI_SUMMARY_CHARS);
        }
        return limit("用户问：" + promptPart + "；回复：" + answerPart, MAX_MINI_SUMMARY_CHARS);
    }

    private String buildSessionSummary(List<ChatTurnSummary> turns) {
        if (turns == null || turns.isEmpty()) {
            return "当前 session 暂无对话。";
        }
        long success = turns.stream().filter(turn -> "SUCCESS".equals(turn.getStatus())).count();
        long failed = turns.stream().filter(turn -> "ERROR".equals(turn.getStatus())).count();
        String last = turns.get(turns.size() - 1).getMiniSummary();
        return limit("本次 session 已记录 " + turns.size() + " 轮对话，成功 " + success + " 轮，失败 " + failed + " 轮。最近：" + last, MAX_SUMMARY_CHARS);
    }

    private String buildRefreshSummary(String currentSummary, List<ChatTurnSummary> turns) {
        String fallback = buildSessionSummary(turns);
        if (!Boolean.TRUE.equals(modelStatus().getConfigured()) || turns == null || turns.isEmpty()) {
            return fallback;
        }
        try {
            String transcript = turns.stream()
                    .map(turn -> "用户：" + nullToBlank(turn.getPrompt()) + "\n助手："
                            + ("ERROR".equals(turn.getStatus())
                            ? friendlyError(turn.getErrorMessage())
                            : nullToBlank(turn.getAnswer())))
                    .reduce((left, right) -> left + "\n\n" + right)
                    .orElse("");
            ChatResponse response = chatModel.chat(ChatRequest.builder()
                    .messages(
                            SystemMessage.from("""
                                    你是 InfiniteChat 会话摘要助手。请把当前 session 压缩成可用于前端右侧 insight 面板的短摘要。
                                    要求：
                                    1. 不编造不存在的事实。
                                    2. 保留用户目标、已完成事项、失败/阻塞点。
                                    3. 中文输出，最多 180 字。
                                    """),
                            UserMessage.from("""
                                    当前摘要：
                                    %s

                                    会话记录：
                                    %s
                                    """.formatted(StringUtils.hasText(currentSummary) ? currentSummary : "暂无。", transcript))
                    )
                    .maxOutputTokens(240)
                    .build());
            String generated = response.aiMessage().text();
            return StringUtils.hasText(generated) ? limit(generated, MAX_SUMMARY_CHARS) : fallback;
        } catch (Exception exception) {
            log.warn("Chat History - LLM summary refresh failed, using deterministic fallback: {}", exception.getMessage());
            return fallback;
        }
    }

    private String titleFromPrompt(String prompt) {
        if (!StringUtils.hasText(prompt)) {
            return "New conversation";
        }
        return limit(prompt.strip().replaceAll("\\s+", " "), MAX_TITLE_CHARS);
    }

    private ChatSessionCreateRequest defaultRequest(Long userId, Long sessionId) {
        ChatSessionCreateRequest request = new ChatSessionCreateRequest();
        request.setUserId(userId);
        request.setSessionId(sessionId);
        request.setMode("stream");
        request.setTitle("New conversation");
        return request;
    }

    private String normalizeMode(String mode) {
        return StringUtils.hasText(mode) ? mode.strip() : "chat";
    }

    private String friendlyError(String message) {
        if (!StringUtils.hasText(message)) {
            return "请求未完成。";
        }
        if (message.contains("DASHSCOPE_API_KEY")) {
            return "AI 模型未配置，等待配置模型密钥后可继续。";
        }
        return message;
    }

    private String limit(String value, int max) {
        String normalized = nullToBlank(value).strip().replaceAll("\\s+", " ");
        if (normalized.length() <= max) {
            return normalized;
        }
        return normalized.substring(0, Math.max(0, max - 1)) + "…";
    }

    private String nullToBlank(String value) {
        return value == null ? "" : value;
    }

    private LocalDateTime toLocalDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime();
    }
}
