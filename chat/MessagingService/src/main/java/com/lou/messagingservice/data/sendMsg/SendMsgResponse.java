package com.lou.messagingservice.data.sendMsg;


import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class SendMsgResponse {

    private String sessionId;

    private Integer sessionType;

    private Integer type;

    /** D5:JSON 内 id 一律 string 化。 */
    private String messageId;

    private Object body;

    private String createdAt;
}
