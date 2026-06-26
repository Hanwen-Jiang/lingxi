package com.lou.infinitechatagent.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 注入当前请求主体 {@link AuthPrincipal}(由 {@link GatewayIdentityFilter} 从网关注入的
 * {@code X-User-Id}/{@code X-User-Roles} 解析)。控制器用它取代请求体/参数里的 userId。
 *
 * <pre>{@code
 * @PostMapping("/chat")
 * public BaseResponse<...> chat(@RequestBody Req req, @CurrentUser AuthPrincipal principal) { ... }
 * }</pre>
 *
 * 解析器 {@link CurrentUserArgumentResolver} 永不返回 null(无身份时返回 {@link AuthPrincipal#anonymous()})。
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
}
