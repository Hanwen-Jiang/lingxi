package com.lou.realtimecommunicationservice.constants;

import lombok.Data;

/**
 * @ClassName MessageTypeEnum
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 12:26
 */


public enum MessageTypeEnum {

    ACK(1),

    LOG_OUT(2),

    HEART_BEAT(5),

    ILLEGAL(99);

    private final Integer code;

    MessageTypeEnum(Integer code) {
        this.code = code;
    }

    public static MessageTypeEnum of(Integer type) {
        switch (type) {
            case 1:
                return MessageTypeEnum.ACK;
            case 2:
                return MessageTypeEnum.LOG_OUT;
            case 5:
                return MessageTypeEnum.HEART_BEAT;
            default:
                return MessageTypeEnum.ILLEGAL;

        }
    }

    public Integer getCode() {
        return code;
    }

}
