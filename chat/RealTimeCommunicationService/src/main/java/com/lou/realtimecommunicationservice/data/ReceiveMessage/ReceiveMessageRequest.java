package com.lou.realtimecommunicationservice.data.ReceiveMessage;

import lombok.Data;
import lombok.experimental.Accessors;
import org.hibernate.validator.constraints.Length;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.util.List;

/**
 * @ClassName ReceiveMessageRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 16:36
 */

@Data
@Accessors(chain = true)
public class ReceiveMessageRequest {

    @NotEmpty(message = "接收者ID列表不能为空")
    @Size(min = 1, message = "至少指定一个接收者")
    private List<Long> receiveUserIds;

    @NotNull(message = "发送者ID不能为空")
    private Long sendUserId;

    private String sessionId;

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
