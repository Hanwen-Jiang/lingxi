package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * @ClassName Message
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 20:27
 */

@Data
@Accessors(chain = true)
public class Message {

    private String sessionId;

    private List<Long> receiveUserIds;

    private String sendUserId;

    private String avatar;

    private String username;

    private Integer type;

    private String messageId;

    private Integer sessionType;

    private String sessionName;

    private String sessionAvatar;

    private String createdAt;

    private Object body;
}
