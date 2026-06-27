package com.lou.authenticationservice.data.user.refresh;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotEmpty;

/**
 * @ClassName RefreshRequest
 * @Description 刷新令牌请求(03-contracts §7.1 C:用 refreshToken 换新 access)
 * @Author Lou
 * @Date 2026/6/27
 */

@Data
@Accessors(chain = true)
public class RefreshRequest {

    @NotEmpty(message = "refreshToken 不能为空")
    private String refreshToken;
}
