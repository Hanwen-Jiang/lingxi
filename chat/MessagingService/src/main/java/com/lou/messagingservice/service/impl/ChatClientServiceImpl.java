package com.lou.messagingservice.service.impl;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.PageResult;
import com.lou.messagingservice.constants.SessionType;
import com.lou.messagingservice.data.clientApi.MessageItem;
import com.lou.messagingservice.data.clientApi.SessionListItem;
import com.lou.messagingservice.model.Message;
import com.lou.messagingservice.model.Session;
import com.lou.messagingservice.model.User;
import com.lou.messagingservice.model.UserSession;
import com.lou.messagingservice.service.ChatClientService;
import com.lou.messagingservice.service.MessageService;
import com.lou.messagingservice.service.SessionService;
import com.lou.messagingservice.service.UserService;
import com.lou.messagingservice.service.UserSessionService;
import com.lou.messagingservice.util.CursorCodec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 客户端聚合查询实现。所有 keyset 查询走 MyBatis-Plus lambdaQuery(主键/索引列比较),不使用 LIKE。
 */
@Service
@Slf4j
public class ChatClientServiceImpl implements ChatClientService {

    /** 状态:正常 */
    private static final int STATUS_ACTIVE = 1;

    private final UserSessionService userSessionService;
    private final SessionService sessionService;
    private final MessageService messageService;
    private final UserService userService;

    public ChatClientServiceImpl(UserSessionService userSessionService, SessionService sessionService,
                                 MessageService messageService, UserService userService) {
        this.userSessionService = userSessionService;
        this.sessionService = sessionService;
        this.messageService = messageService;
        this.userService = userService;
    }

    @Override
    public List<SessionListItem> listSessions(Long userId) {
        List<UserSession> myMemberships = userSessionService.lambdaQuery()
                .eq(UserSession::getUserId, userId)
                .eq(UserSession::getStatus, STATUS_ACTIVE)
                .list();

        List<SessionListItem> result = new ArrayList<>();
        for (UserSession ms : myMemberships) {
            Long sessionId = ms.getSessionId();
            Session session = sessionService.getById(sessionId);
            if (session == null || session.getStatus() == null || session.getStatus() != STATUS_ACTIVE) {
                continue;
            }

            SessionListItem item = new SessionListItem();
            item.setSessionId(String.valueOf(sessionId));
            item.setType(session.getType());

            // 名称/头像:单聊取对方,群聊取会话名 + 群头像(无常量则置空)
            if (session.getType() != null && session.getType() == SessionType.SINGLE.getValue()) {
                User peer = findPeer(sessionId, userId);
                if (peer != null) {
                    item.setName(peer.getUserName());
                    item.setAvatar(peer.getAvatar());
                    // S4 缺口:冷开单聊需要对方 userId 作 receiveUserId 才能发首条
                    item.setPeerUserId(String.valueOf(peer.getUserId()));
                }
            } else {
                item.setName(session.getName());
                item.setAvatar(null); // 群头像常量缺失,置空
            }

            // 末条消息 = 该 session 的 max(message_id)
            Message last = messageService.lambdaQuery()
                    .eq(Message::getSessionId, sessionId)
                    .orderByDesc(Message::getMessageId)
                    .last("LIMIT 1")
                    .one();
            if (last != null) {
                item.setLastMessage(last.getContent());
                item.setLastMessageTime(last.getCreatedAt());
            }

            // 未读 = count(message where session_id=? AND message_id > lastRead(NULL→0))
            long lastRead = ms.getLastReadMessageId() == null ? 0L : ms.getLastReadMessageId();
            long unread = messageService.lambdaQuery()
                    .eq(Message::getSessionId, sessionId)
                    .gt(Message::getMessageId, lastRead)
                    .count();
            item.setUnreadCount(unread);

            result.add(item);
        }
        return result;
    }

    @Override
    public PageResult<MessageItem> listMessages(Long userId, Long sessionId, String cursor, int limit) {
        requireMember(userId, sessionId);

        Long cursorId = CursorCodec.decode(cursor);

        // 取 limit+1 判断 hasMore;message_id DESC keyset(message_id < cursor)
        List<Message> rows = messageService.lambdaQuery()
                .eq(Message::getSessionId, sessionId)
                .lt(cursorId != null, Message::getMessageId, cursorId)
                .orderByDesc(Message::getMessageId)
                .last("LIMIT " + (limit + 1))
                .list();

        boolean hasMore = rows.size() > limit;
        if (hasMore) {
            rows = rows.subList(0, limit);
        }

        List<MessageItem> items = new ArrayList<>(rows.size());
        for (Message m : rows) {
            items.add(toItem(m));
        }

        // nextCursor = 末条(即本页最小 message_id)的 base64,仅 hasMore 时给
        String nextCursor = null;
        if (hasMore && !rows.isEmpty()) {
            nextCursor = CursorCodec.encode(rows.get(rows.size() - 1).getMessageId());
        }

        return PageResult.of(items, nextCursor, hasMore);
    }

    @Override
    public Long markRead(Long userId, Long sessionId, Long lastReadMessageId) {
        UserSession membership = getMembership(userId, sessionId);
        if (membership == null) {
            throw new ApiException(CommonError.FORBIDDEN, "无权访问该会话");
        }

        Long target = lastReadMessageId;
        if (target == null) {
            // 不传 → 该会话最新 message_id
            Message last = messageService.lambdaQuery()
                    .eq(Message::getSessionId, sessionId)
                    .orderByDesc(Message::getMessageId)
                    .last("LIMIT 1")
                    .one();
            target = last == null ? null : last.getMessageId();
        }

        long current = membership.getLastReadMessageId() == null ? 0L : membership.getLastReadMessageId();
        // 只增不减
        if (target != null && target > current) {
            UserSession update = new UserSession();
            update.setId(membership.getId());
            update.setLastReadMessageId(target);
            userSessionService.updateById(update);
            return target;
        }

        return membership.getLastReadMessageId();
    }

    // ---- helpers ----

    private void requireMember(Long userId, Long sessionId) {
        if (getMembership(userId, sessionId) == null) {
            throw new ApiException(CommonError.FORBIDDEN, "无权访问该会话");
        }
    }

    private UserSession getMembership(Long userId, Long sessionId) {
        return userSessionService.lambdaQuery()
                .eq(UserSession::getUserId, userId)
                .eq(UserSession::getSessionId, sessionId)
                .eq(UserSession::getStatus, STATUS_ACTIVE)
                .last("LIMIT 1")
                .one();
    }

    /** 单聊取对方用户(user_session 里非 me 的那个成员)。 */
    private User findPeer(Long sessionId, Long userId) {
        UserSession peerMembership = userSessionService.lambdaQuery()
                .eq(UserSession::getSessionId, sessionId)
                .ne(UserSession::getUserId, userId)
                .last("LIMIT 1")
                .one();
        if (peerMembership == null) {
            return null;
        }
        return userService.getById(peerMembership.getUserId());
    }

    private MessageItem toItem(Message m) {
        MessageItem item = new MessageItem();
        item.setMessageId(String.valueOf(m.getMessageId()));
        item.setSessionId(m.getSessionId() == null ? null : String.valueOf(m.getSessionId()));
        item.setSenderId(m.getSenderId() == null ? null : String.valueOf(m.getSenderId()));
        item.setType(m.getType());
        item.setContent(m.getContent());
        item.setReplyId(m.getReplyId() == null ? null : String.valueOf(m.getReplyId()));
        item.setCreatedAt(m.getCreatedAt());
        return item;
    }
}
