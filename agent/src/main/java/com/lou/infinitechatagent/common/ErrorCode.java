package com.lou.infinitechatagent.common;

/**
 * 错误码,镜像 chat-common {@code CommonError}(契约 03-contracts §3:code → HTTP)。
 *
 * <p>agent 是 Spring Boot 3、不依赖 chat-common 工件,故本地镜像、对齐编号(别两套)。
 * 通用大类用规范码(0/40000/40100/40300/40400/40900/42200/42900/50000/50300),
 * agent 域错误用 {@code 7xxxx}(httpStatus 复用大类语义)。停止"全 200 + 体内 code":
 * 每个码携带真实 HTTP 状态,由 {@code GlobalExceptionHandler} 落到响应。
 */
public enum ErrorCode {

    // ============ 通用(对齐 chat-common CommonError)============
    SUCCESS(0, 200, "ok"),
    PARAMS_ERROR(40000, 400, "请求参数错误"),
    NOT_LOGIN_ERROR(40100, 401, "未登录或身份缺失"),
    FORBIDDEN_ERROR(40300, 403, "禁止访问"),
    NO_AUTH_ERROR(40300, 403, "无权限"),
    NOT_FOUND_ERROR(40400, 404, "请求数据不存在"),
    CONFLICT_ERROR(40900, 409, "状态冲突"),
    INVALID_PARAMETER_ERROR(42200, 422, "参数校验失败"),
    RATE_LIMITED(42900, 429, "请求过于频繁，请稍后再试"),
    SYSTEM_ERROR(50000, 500, "系统内部异常"),
    OPERATION_ERROR(50000, 500, "操作失败"),
    DEPENDENCY_UNAVAILABLE(50300, 503, "依赖服务不可用"),

    // ============ agent 域(7xxxx;httpStatus 复用大类语义)============
    SENSITIVE_WORD_ERROR(71000, 400, "包含敏感词或不安全意图，请求被拒绝");

    private final int code;
    private final int httpStatus;
    private final String message;

    ErrorCode(int code, int httpStatus, String message) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public int getHttpStatus() {
        return httpStatus;
    }

    public String getMessage() {
        return message;
    }

    /**
     * int code → HTTP 状态(供仅持 int code 的 {@code BusinessException} 映射)。
     * 已登记码用其 httpStatus;未登记但符合规范结构(类别*100+子码)的码按 {@code code/100} 推导;否则 500。
     */
    public static int httpStatusForCode(int code) {
        for (ErrorCode value : values()) {
            if (value.code == code) {
                return value.httpStatus;
            }
        }
        int derived = code / 100;
        return derived >= 100 && derived <= 599 ? derived : 500;
    }
}
