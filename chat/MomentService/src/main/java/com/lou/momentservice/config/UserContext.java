package com.lou.momentservice.config;

/**
 * 持有当前请求可信用户ID的 ThreadLocal 上下文。
 * 值由 AuthContextInterceptor 在网关注入 X-User-Id 后写入。
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
