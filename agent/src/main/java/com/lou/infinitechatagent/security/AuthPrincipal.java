package com.lou.infinitechatagent.security;

import java.util.Set;

/**
 * 当前请求主体。由 {@link GatewayIdentityFilter} 从统一网关注入的可信请求头解析:
 * <ul>
 *   <li>{@code X-User-Id}:string 化 snowflake(D5);在持久化边界转内部 {@code Long}。</li>
 *   <li>{@code X-User-Roles}:逗号分隔角色声明(含 {@code admin})。<b>该头名为 S1 提案,待 S3 网关确认。</b></li>
 * </ul>
 *
 * <p>expand/contract:网关上线前(`agent.gateway.enforce-identity=false`)主体可能为
 * {@link #anonymous()},调用方暂回退请求体里的 userId;网关上线并 enforce 后,主体恒存在、
 * body userId 被忽略并最终移除(contract 相)。
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
     * 解析 userId 的便捷方法:主体存在则用主体(网关身份),否则回退给定的 body/param 值(过渡)。
     * 网关 enforce 后 body 永不被用到。
     */
    public Long resolveUserId(Long fallbackBodyUserId) {
        return isPresent() ? userIdLong : fallbackBodyUserId;
    }
}
