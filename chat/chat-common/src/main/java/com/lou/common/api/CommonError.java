package com.lou.common.api;

/**
 * 跨服务通用错误码 + 真实 HTTP 状态映射(03-contracts.md §3 大类)。
 * <p>编号规范:类别(3) + 子码(2)。各域错误码在此基础上细分,前导数字标识域:
 * 1xxxx Auth · 2xxxx Contact · 3xxxx Messaging/RedPacket · 4xxxx RealTime ·
 * 5xxxx Offline · 6xxxx Moment · 7xxxx agent。域错误码以本接口的 {@link ErrorCode}
 * 自定义枚举实现,httpStatus 复用本表大类语义。
 */
public enum CommonError implements ErrorCode {

    OK(0, 200, "ok"),
    BAD_REQUEST(40000, 400, "请求参数错误"),
    UNAUTHENTICATED(40100, 401, "未认证或令牌失效"),
    FORBIDDEN(40300, 403, "无权限"),
    NOT_FOUND(40400, 404, "资源不存在"),
    CONFLICT(40900, 409, "状态冲突"),
    VALIDATION_FAILED(42200, 422, "字段校验失败"),
    RATE_LIMITED(42900, 429, "请求过于频繁"),
    INTERNAL(50000, 500, "服务器内部错误"),
    DEPENDENCY_UNAVAILABLE(50300, 503, "依赖服务不可用");

    private final int code;
    private final int httpStatus;
    private final String defaultMessage;

    CommonError(int code, int httpStatus, String defaultMessage) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public int code() {
        return code;
    }

    @Override
    public int httpStatus() {
        return httpStatus;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
