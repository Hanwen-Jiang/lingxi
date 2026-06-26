package com.lou.authenticationservice.data.user.updateAvatar;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class UpdateAvatarResponse {

    private Long userId;

    private String userName;

    private String email;

    private String phone;

    private String avatar;

    private String signature;

    private Integer gender;

    private Integer status;
}
