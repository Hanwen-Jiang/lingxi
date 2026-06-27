package com.lou.common.security;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 每请求身份/链路上下文(ThreadLocal)。各服务的鉴权拦截器从注入头填充,afterCompletion 清理。
 * <p>下游"操作人"一律取 {@link #getUserId()}(网关注入的 X-User-Id),不再信任 body/path 里的 userId。
 */
public final class RequestContext {

    public static final String ROLE_ADMIN = "admin";

    private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();
    private static final ThreadLocal<Set<String>> ROLES = new ThreadLocal<>();
    private static final ThreadLocal<String> TRACE_ID = new ThreadLocal<>();

    private RequestContext() {
    }

    public static void setUserId(String userId) {
        USER_ID.set(userId);
    }

    public static String getUserId() {
        return USER_ID.get();
    }

    public static Long getUserIdAsLong() {
        String s = USER_ID.get();
        if (s == null || s.isEmpty()) {
            return null;
        }
        try {
            return Long.valueOf(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 缺失即 401(03-contracts.md §1:去掉 null 跳过)。 */
    public static String requireUserId() {
        String s = USER_ID.get();
        if (s == null || s.isEmpty()) {
            throw new ApiException(CommonError.UNAUTHENTICATED, "缺少已认证身份");
        }
        return s;
    }

    /** 校验操作人本人:actor 必须等于当前认证主体,否则 403。 */
    public static void requireSelf(String actorId) {
        String self = requireUserId();
        if (actorId == null || !self.equals(actorId.trim())) {
            throw new ApiException(CommonError.FORBIDDEN, "无权代他人操作");
        }
    }

    public static void setRolesCsv(String csv) {
        Set<String> set = new LinkedHashSet<>();
        if (csv != null) {
            for (String r : csv.split(",")) {
                String t = r.trim();
                if (!t.isEmpty()) {
                    set.add(t);
                }
            }
        }
        ROLES.set(set);
    }

    public static Set<String> getRoles() {
        Set<String> r = ROLES.get();
        return r == null ? Collections.<String>emptySet() : r;
    }

    public static boolean hasRole(String role) {
        return getRoles().contains(role);
    }

    public static boolean isAdmin() {
        return hasRole(ROLE_ADMIN);
    }

    public static void requireAdmin() {
        requireUserId();
        if (!isAdmin()) {
            throw new ApiException(CommonError.FORBIDDEN, "需要管理员权限");
        }
    }

    public static void setTraceId(String traceId) {
        TRACE_ID.set(traceId);
    }

    public static String getTraceId() {
        return TRACE_ID.get();
    }

    public static void clear() {
        USER_ID.remove();
        ROLES.remove();
        TRACE_ID.remove();
    }
}
