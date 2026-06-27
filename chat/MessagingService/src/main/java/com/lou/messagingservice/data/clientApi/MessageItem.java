package com.lou.messagingservice.data.clientApi;

import lombok.Data;

import java.util.Date;

/**
 * 历史消息分页项(GET /api/v1/chat/session/{sessionId}/messages)。所有 id 一律 string 化。
 */
@Data
public class MessageItem {

    /** 消息 id(string) */
    private String messageId;

    /** 会话 id(string) */
    private String sessionId;

    /** 发送者 id(string) */
    private String senderId;

    /** 消息类型 */
    private Integer type;

    /** 消息内容 */
    private String content;

    /** 回复的消息 id(string,可空) */
    private String replyId;

    /** 创建时间 */
    private Date createdAt;
}
