package com.lou.common.api;

/**
 * 业务异常:携带 {@link ErrorCode},由各服务的 @RestControllerAdvice 统一转成
 * {@link Result} + 真实 HTTP 状态(error.httpStatus())。
 */
public class ApiException extends RuntimeException {

    private final ErrorCode error;

    public ApiException(ErrorCode error) {
        super(error.defaultMessage());
        this.error = error;
    }

    public ApiException(ErrorCode error, String message) {
        super(message != null ? message : error.defaultMessage());
        this.error = error;
    }

    public ErrorCode getError() {
        return error;
    }

    public static ApiException of(ErrorCode error) {
        return new ApiException(error);
    }

    public static ApiException of(ErrorCode error, String message) {
        return new ApiException(error, message);
    }
}
