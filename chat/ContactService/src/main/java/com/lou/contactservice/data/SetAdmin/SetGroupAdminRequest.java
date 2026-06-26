package com.lou.contactservice.data.SetAdmin;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotNull;

/**
 * @ClassName SetGroupAdminRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/7/1 18:38
 */

@Data
@Accessors(chain = true)
public class SetGroupAdminRequest {

    @NotNull(message = "sessionId不能为空")
    private Long sessionId;  // 群聊ID

    @NotNull(message = "userId不能为空")
    private Long userId;     // 操作人ID（比如群主 / 管理员）

    @NotNull(message = "targetId不能为空")
    private Long targetId;   // 被设置为管理员的用户ID

    @NotNull(message = "isAdmin不能为空")
    private Boolean isAdmin; // true = 设置为管理员, false = 取消管理员

    // getters and setters
}
