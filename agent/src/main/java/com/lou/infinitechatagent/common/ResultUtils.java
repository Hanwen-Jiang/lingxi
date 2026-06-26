package com.lou.infinitechatagent.common;

/**
 * 返回工具类
 */
public class ResultUtils {

    /**
     * 成功
     */
    public static <T> BaseResponse<T> success(T data) {
        return new BaseResponse<>(200, data, "ok");
    }

    /**
     * 成功
     */
    public static <T> BaseResponse<T> success(T data, String message) {
        return new BaseResponse<>(200, data, message);
    }

    /**
     * 成功
     */
    public static BaseResponse<Void> success() {
        return new BaseResponse<>(200, null, "ok");
    }

    /**
     * 失败
     */
    public static BaseResponse error(ErrorCode errorCode) {
        return new BaseResponse<>(errorCode);
    }

    /**
     * 失败
     */
    public static BaseResponse error(int code, String message) {
        return new BaseResponse(code, null, message);
    }

    /**
     * 失败
     */
    public static BaseResponse error(ErrorCode errorCode, String message) {
        return new BaseResponse(errorCode.getCode(), null, message);
    }
}
