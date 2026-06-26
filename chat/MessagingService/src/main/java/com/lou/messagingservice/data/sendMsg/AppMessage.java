package com.lou.messagingservice.data.sendMsg;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.util.List;

@Data
@Accessors(chain = true)
public class AppMessage {

    protected Long sessionId;

    @NotEmpty(message = "接收者ID列表不能为空")
    @Size(min = 1, message = "至少指定一个接收者")
    private List<Long> receiveUserIds;

    @NotNull(message = "发送者ID不能为空")
    private Long sendUserId;

    protected String userName;

    protected String avatar;

    protected Integer type;

    protected Long messageId;

    protected Integer sessionType;

    protected String seesionName;

    protected String sessionAvatr;

    protected String created;

    protected Object body;
}
