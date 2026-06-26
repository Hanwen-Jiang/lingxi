package com.lou.authenticationservice.data.user.updateAvatar;

import javax.validation.constraints.NotEmpty;

public class UpdateAvatarRequest {

    @NotEmpty(message = "头像地址不能为空")
    public String avatarUrl;
}
