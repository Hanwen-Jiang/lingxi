package com.lou.contactservice.data.SearchUser;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
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
    /** D5: id 序列化为 String,避免前端 Long 精度丢失。 */
    @JsonSerialize(using = ToStringSerializer.class)
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
