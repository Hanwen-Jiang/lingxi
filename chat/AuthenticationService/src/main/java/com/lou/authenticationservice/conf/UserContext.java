package com.lou.authenticationservice.conf;

/**
 * 持当前请求可信用户ID(网关验签通过后注入的 X-User-Id)。
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
