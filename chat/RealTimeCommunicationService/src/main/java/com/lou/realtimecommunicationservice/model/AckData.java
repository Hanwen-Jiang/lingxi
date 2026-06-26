package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName AckData
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 15:38
 */

@Data
@Accessors(chain = true)
public class AckData {
    private Long sessionId;

    private Long receiveUserUuid;

    private String msgUuid;
}
