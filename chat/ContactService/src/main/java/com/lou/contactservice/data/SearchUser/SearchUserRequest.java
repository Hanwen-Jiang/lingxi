package com.lou.contactservice.data.SearchUser;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotNull;

/**
 * @ClassName SearchUserRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/26 19:52
 */

@Data
@Accessors(chain = true)
public class SearchUserRequest {

    @NotNull(message = "发起人不能为空")
    private String userUuid;

    @NotNull(message = "手机号不能为空")
    private String phone;
}
