package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName TEXT_MESSAGE
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 20:26
 */

@Data
@Accessors(chain = true)
public class TextMessage extends Message {

    private TextMessageBody body;

    @Override
    public String toString() {
        return super.toString();
    }
}
