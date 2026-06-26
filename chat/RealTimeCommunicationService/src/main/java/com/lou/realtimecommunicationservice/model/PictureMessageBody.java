package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName PictureMessageBody
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 20:30
 */

@Data
@Accessors(chain = true)
public class PictureMessageBody {

    private Integer size;

    private String url;

    private String replyId;
}
