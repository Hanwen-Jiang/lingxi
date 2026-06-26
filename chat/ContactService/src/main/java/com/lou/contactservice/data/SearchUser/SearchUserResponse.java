package com.lou.contactservice.data.SearchUser;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName SearchUserResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/26 19:51
 */

@Data
@Accessors(chain = true)
public class SearchUserResponse {
    private Long userUuid;

    private String nickname;

    private String avatar;

    private String email;

    private String phone;

    private String signature;

    private Integer gender;

    private Integer status;

    private String sessionId;
}
