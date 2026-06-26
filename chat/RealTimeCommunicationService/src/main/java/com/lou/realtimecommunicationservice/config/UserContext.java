package com.lou.realtimecommunicationservice.config;

/**
 * 统一鉴权：ThreadLocal 持当前请求可信用户ID。
 * RTC 的 HTTP 接口为纯内部接口，仅做内部令牌校验，此类可选，主要为跨服务约定保持一致。
 */
public class UserContext {

    private static final ThreadLocal<Long> CURRENT = new ThreadLocal<>();

    public static void set(Long id) {
        CURRENT.set(id);
    }

    public static Long get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}
