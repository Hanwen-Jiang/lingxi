package com.lou.authenticationservice.data.common.SendMail;

import lombok.Data;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotEmpty;

@Data
public class MailRequest {

    @NotEmpty(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;

    /** 兼容字段:不再使用。 */
    private String phone;
}
