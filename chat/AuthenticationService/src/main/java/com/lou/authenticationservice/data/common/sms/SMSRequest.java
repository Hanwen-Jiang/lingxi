package com.lou.authenticationservice.data.common.sms;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName SMSRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 17:33
 */


@Data
@Accessors(chain = true)
public class SMSRequest {
    private String phone;
}
