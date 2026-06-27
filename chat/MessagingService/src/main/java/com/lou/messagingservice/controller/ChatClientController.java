package com.lou.messagingservice.controller;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.PageResult;
import com.lou.common.api.Result;
import com.lou.common.security.RequestContext;
import com.lou.messagingservice.data.clientApi.MarkReadRequest;
import com.lou.messagingservice.data.clientApi.MessageItem;
import com.lou.messagingservice.data.clientApi.SessionListItem;
import com.lou.messagingservice.service.ChatClientService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 客户端聊天 API(P4,03-contracts.md):会话/收件箱列表、历史消息分页、标记已读。
 * <p>统一返回 chat-common {@link Result}/{@link PageResult}(成功 code=0);所有 id string 化。
 * 操作人一律取 {@link RequestContext#requireUserId()},会话相关数据校验成员资格。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/chat")
public class ChatClientController {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    private final ChatClientService chatClientService;

    public ChatClientController(ChatClientService chatClientService) {
        this.chatClientService = chatClientService;
    }

    /** 会话/收件箱列表。 */
    @GetMapping("/sessions")
    public Result<List<SessionListItem>> listSessions() {
        Long me = currentUserId();
        return Result.ok(chatClientService.listSessions(me));
    }

    /** 历史消息分页(message_id DESC keyset)。 */
    @GetMapping("/session/{sessionId}/messages")
    public Result<PageResult<MessageItem>> listMessages(@PathVariable("sessionId") Long sessionId,
                                                        @RequestParam(value = "cursor", required = false) String cursor,
                                                        @RequestParam(value = "limit", required = false) Integer limit) {
        Long me = currentUserId();
        int effectiveLimit = normalizeLimit(limit);
        return Result.ok(chatClientService.listMessages(me, sessionId, cursor, effectiveLimit));
    }

    /** 标记已读:推进 last_read_message_id(只增不减),返回新值(string)。 */
    @PostMapping("/sessions/{sessionId}/read")
    public Result<String> markRead(@PathVariable("sessionId") Long sessionId,
                                   @RequestBody(required = false) MarkReadRequest request) {
        Long me = currentUserId();
        Long body = request == null ? null : request.getLastReadMessageId();
        Long newLastRead = chatClientService.markRead(me, sessionId, body);
        return Result.ok(newLastRead == null ? null : String.valueOf(newLastRead));
    }

    // ---- helpers ----

    private Long currentUserId() {
        RequestContext.requireUserId();
        Long me = RequestContext.getUserIdAsLong();
        if (me == null) {
            throw new ApiException(CommonError.UNAUTHENTICATED, "身份无效");
        }
        return me;
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }
}
