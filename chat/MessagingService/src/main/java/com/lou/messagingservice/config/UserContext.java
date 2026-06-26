package com.lou.messagingservice.config;

/**
 * 持有当前请求可信用户ID的 ThreadLocal。
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
