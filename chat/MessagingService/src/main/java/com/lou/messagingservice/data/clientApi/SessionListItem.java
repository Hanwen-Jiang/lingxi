package com.lou.messagingservice.data.clientApi;

import lombok.Data;

/**
 * 会话/收件箱列表项(GET /api/v1/chat/sessions)。所有 id 一律 string 化。
 */
@Data
public class SessionListItem {

    /** 会话 id(string) */
    private String sessionId;

    /** 会话类型:1 单聊,2 群聊 */
    private Integer type;

    /** 单聊对方 userId(string,群聊为 null)。S4 冷开单聊用它作 receiveUserId 发首条。 */
    private String peerUserId;

    /** 展示名:单聊取对方 user_name,群聊取 session.name */
    private String name;

    /** 展示头像:单聊取对方 avatar,群聊取群头像(可空) */
    private String avatar;

    /** 末条消息内容预览(可空) */
    private String lastMessage;

    /** 末条消息时间(可空) */
    private java.util.Date lastMessageTime;

    /** 未读数 */
    private long unreadCount;
}
