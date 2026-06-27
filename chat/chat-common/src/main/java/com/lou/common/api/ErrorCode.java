package com.lou.common.api;

/**
 * 统一错误码契约(03-contracts.md §3)。
 * <p>各域(Auth/Contact/Messaging/RealTime/Offline/Moment)可自定义实现本接口的枚举,
 * 取各自前导数字区段(1xxxx..6xxxx),并复用大类的 HTTP 映射语义。
 */
public interface ErrorCode {

    /** 业务错误码:0=成功;非 0 见 03-contracts.md §3。 */
    int code();

    /** 该错误码对应的真实 HTTP 状态(停止"全 200+体内 code")。 */
    int httpStatus();

    /** 默认提示文案。 */
    String defaultMessage();
}
