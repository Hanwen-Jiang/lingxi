package com.lou.authenticationservice.data.common.SendMail;

import lombok.Data;

@Data
public class MailResponse {
    private String status = "ok"; // 或者加 code / message
}
