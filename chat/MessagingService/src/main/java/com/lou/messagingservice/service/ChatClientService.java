package com.lou.messagingservice.service;

import com.lou.common.api.PageResult;
import com.lou.messagingservice.data.clientApi.MessageItem;
import com.lou.messagingservice.data.clientApi.SessionListItem;

import java.util.List;

/**
 * 客户端聚合查询服务(P4 新增客户端 API,03-contracts.md)。
 * 操作人一律取 RequestContext,会话相关数据须校验成员资格。
 */
public interface ChatClientService {

    /** 当前用户的会话/收件箱列表。 */
    List<SessionListItem> listSessions(Long userId);

    /** 某会话的历史消息(message_id DESC keyset 分页)。先校验成员。 */
    PageResult<MessageItem> listMessages(Long userId, Long sessionId, String cursor, int limit);

    /**
     * 标记已读:把 (userId,sessionId).last_read_message_id 推进到指定值(不传=该会话最新),只增不减。
     * @return 新的 last_read_message_id(可能为 null,会话无消息且未指定时)
     */
    Long markRead(Long userId, Long sessionId, Long lastReadMessageId);
}
