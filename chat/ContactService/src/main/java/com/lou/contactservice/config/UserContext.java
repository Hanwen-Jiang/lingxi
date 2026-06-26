package com.lou.contactservice.config;

/**
 * ThreadLocal holder for the current request's trusted user id.
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
