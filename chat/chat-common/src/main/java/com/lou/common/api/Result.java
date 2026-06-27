package com.lou.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.lou.common.security.RequestContext;

/**
 * 统一响应包络(03-contracts.md §2):{@code {code,message,data,traceId,timestamp}}。
 * <p>code=0 表示成功;非 0 为业务/错误码(见 {@link CommonError})。timestamp 为 epoch 毫秒。
 * traceId 取自 {@link RequestContext}(网关注入、拦截器入栈),同时应在响应头 X-Trace-Id 回写。
 *
 * @param <T> data 类型
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Result<T> {

    private int code;
    private String message;
    private T data;
    private String traceId;
    private long timestamp;

    public Result() {
    }

    public Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
        this.traceId = RequestContext.getTraceId();
        this.timestamp = System.currentTimeMillis();
    }

    public static <T> Result<T> ok(T data) {
        return new Result<>(CommonError.OK.code(), CommonError.OK.defaultMessage(), data);
    }

    public static <T> Result<T> ok() {
        return ok(null);
    }

    public static <T> Result<T> error(ErrorCode error) {
        return new Result<>(error.code(), error.defaultMessage(), null);
    }

    public static <T> Result<T> error(ErrorCode error, String message) {
        return new Result<>(error.code(), message != null ? message : error.defaultMessage(), null);
    }

    public static <T> Result<T> error(int code, String message) {
        return new Result<>(code, message, null);
    }

    /** 携带 data 的错误(如 VALIDATION_FAILED 带 fieldErrors)。 */
    public static <T> Result<T> error(ErrorCode error, String message, T data) {
        return new Result<>(error.code(), message != null ? message : error.defaultMessage(), data);
    }

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
