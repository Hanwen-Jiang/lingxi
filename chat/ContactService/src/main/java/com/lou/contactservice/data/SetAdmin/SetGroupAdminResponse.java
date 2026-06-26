package com.lou.contactservice.data.SetAdmin;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName SetGroupAdminResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/7/1 18:38
 */

@Data
@Accessors(chain = true)
public class SetGroupAdminResponse {
    private boolean success;
    private String message;
}

