package com.lou.common.security;

/**
 * 身份/链路头常量(03-contracts.md §1)。客户端永不自带 X-User-Id/X-User-Roles(网关剥离)。
 */
public final class IdentityHeaders {

    /** 已认证主体(string 化 snowflake),网关验签后注入。 */
    public static final String USER_ID = "X-User-Id";

    /** 角色,csv,含 admin;网关注入。 */
    public static final String USER_ROLES = "X-User-Roles";

    /** 链路 id;网关生成/透传,各服务进 MDC、回写响应头。 */
    public static final String TRACE_ID = "X-Trace-Id";

    /** 服务间调用令牌;须配显式 acting-user 头,不得回退信任 body userId。 */
    public static final String INTERNAL_TOKEN = "X-Internal-Token";

    private IdentityHeaders() {
    }
}
