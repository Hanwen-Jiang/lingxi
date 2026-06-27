package com.lou.infinitechatagent.security;

import com.lou.infinitechatagent.common.ErrorCode;
import com.lou.infinitechatagent.exception.BusinessException;

import java.util.Set;

/**
 * 当前请求主体。由 {@link GatewayIdentityFilter} 从统一网关注入的可信请求头解析:
 * <ul>
 *   <li>{@code X-User-Id}:string 化 snowflake(D5);在持久化边界转内部 {@code Long}。</li>
 *   <li>{@code X-User-Roles}:逗号分隔角色声明(含 {@code admin})。</li>
 * </ul>
 *
 * <p><b>contract 相(P3,{@code enforce-identity=true}):</b> userId 只来自网关注入头——
 * {@link #requireUserId()} 缺失即 401、{@link #requireSelf} 越权即 403;<b>不再回退请求体/参数里的 userId</b>。
 * 客户端永不自带 {@code X-User-Id}/{@code X-User-Roles}(网关剥离伪造值)。
 */
public record AuthPrincipal(String userId, Long userIdLong, Set<String> roles, boolean authenticated) {

    public static AuthPrincipal anonymous() {
        return new AuthPrincipal(null, null, Set.of(), false);
    }

    public static AuthPrincipal of(String userId, Long userIdLong, Set<String> roles) {
        return new AuthPrincipal(userId, userIdLong, roles == null ? Set.of() : roles, true);
    }

    /** 是否携带可信身份(网关注入了合法 X-User-Id)。 */
    public boolean isPresent() {
        return authenticated && userIdLong != null;
    }

    public boolean isAdmin() {
        return roles != null && roles.contains("admin");
    }

    /**
     * 当前主体的内部 userId(Long);缺失即 401(契约:下游用户态缺失即拒)。
     * enforce-identity=true 下由 {@link GatewayIdentityFilter} 保证恒在;此兜底覆盖 enforce=false 的本地逃生路径。
     */
    public Long requireUserId() {
        if (!isPresent()) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR);
        }
        return userIdLong;
    }

    /**
     * 校验路径/参数里的目标 userId 必须等于当前主体,否则 403(requireSelf 语义);返回主体 userId。
     * 用于仍在 URL 携带 userId 的端点(如 /memory/user/{userId}):只能访问自己的资源。
     */
    public Long requireSelf(Long targetUserId) {
        Long self = requireUserId();
        if (targetUserId != null && !self.equals(targetUserId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN_ERROR, "不可访问他人资源");
        }
        return self;
    }
}
