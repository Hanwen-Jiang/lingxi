package com.lou.authenticationservice.data.common.sms;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName SMSResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 17:34
 */


@Data
@Accessors(chain = true)
public class SMSResponse {
    private String phone;
}
