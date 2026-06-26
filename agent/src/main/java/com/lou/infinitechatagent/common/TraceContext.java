package com.lou.infinitechatagent.common;

/**
 * 每请求链路 id 持有器。由 TraceIdFilter 在请求入口设置/清理,供统一包络
 * ({@link BaseResponse#traceId})与结构化日志(MDC)取用。
 *
 * <p>纯 ThreadLocal,不依赖 servlet/web,故可被 {@code common} 包安全引用。
 */
public final class TraceContext {

    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    private TraceContext() {
    }

    public static void set(String traceId) {
        TRACE_ID.set(traceId);
    }

    public static String get() {
        return TRACE_ID.get();
    }

    public static void clear() {
        TRACE_ID.remove();
    }
}
