package com.lou.authenticationservice.data.common.SendMail;

import lombok.Data;

@Data
public class MailRequest {
    private String email;

    private String phone;
}
