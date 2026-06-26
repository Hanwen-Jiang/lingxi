package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * @ClassName PictureMessage
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 20:27
 */


@Data
@Accessors(chain = true)
public class PictureMessage extends Message {

    private PictureMessageBody body;

    @Override
    public String toString() {
        return super.toString();
    }
}
