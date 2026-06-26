package com.lou.infinitechatagent.common;

import java.io.Serializable;

import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 通用返回类
 *
 */
@Data
@NoArgsConstructor
public class BaseResponse<T> implements Serializable {

    private int code;

    private T data;

    private String message;

    /** 链路 id(D4 统一包络);由 TraceIdFilter 经 {@link TraceContext} 注入。 */
    private String traceId;

    /** 服务端生成时间戳(epoch millis,D4 统一包络)。 */
    private Long timestamp;

    public BaseResponse(int code, T data, String message) {
        this.code = code;
        this.data = data;
        this.message = message;
        this.traceId = TraceContext.get();
        this.timestamp = System.currentTimeMillis();
    }

    public BaseResponse(int code, T data) {
        this(code, data, "");
    }

    public BaseResponse(ErrorCode errorCode) {
        this(errorCode.getCode(), null, errorCode.getMessage());
    }
}