package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName LogOutData
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 15:43
 */

@Data
@Accessors(chain = true)
public class LogOutData {
    private Integer userUuid;
}
