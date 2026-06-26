package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName TextMessageBody
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 20:29
 */

@Data
@Accessors(chain = true)
public class TextMessageBody {

    private String content;

    private String replyId;
}
