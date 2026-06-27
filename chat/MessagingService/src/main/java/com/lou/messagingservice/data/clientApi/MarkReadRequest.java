package com.lou.messagingservice.data.clientApi;

import lombok.Data;

/**
 * 标记已读请求体(可选)。不传则视为推进到该会话最新消息。
 */
@Data
public class MarkReadRequest {

    /** 已读到的最后一条 message_id;不传或为空则推进到该会话最新。 */
    private Long lastReadMessageId;
}
