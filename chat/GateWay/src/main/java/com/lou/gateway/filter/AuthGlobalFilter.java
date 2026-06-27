package com.lou.gateway.filter;

import com.lou.common.security.IdentityHeaders;
import com.lou.common.security.JwtUtil;
import io.jsonwebtoken.Claims;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

/**
 * 全局鉴权网关过滤器(03-contracts.md §1/§6)。
 * <p>系统唯一统一鉴权入口:对所有非白名单请求(含 chat /api/v1/** 与 agent /api/{agent,memory,rag}/**)
 * 用 chat-common {@link JwtUtil} 验签 JWT,通过后把可信 {@code X-User-Id}(JWT sub)与
 * {@code X-User-Roles}(roles 声明 csv)注入下游,并**剥离客户端自带的同名头**杜绝伪造。
 * 下游只信任本过滤器注入的身份头。
 *
 * @author Lou
 */
@Component
public class AuthGlobalFilter implements GlobalFilter, Ordered {

    /** 免登录白名单(按路径前缀匹配)。 */
    private static final List<String> WHITELIST = Arrays.asList(
            "/api/v1/user/register",
            "/api/v1/user/login",
            "/api/v1/user/loginCode",
            "/api/v1/user/refresh",            // 刷新令牌:自带 refresh token,不需 access
            "/api/v1/user/common/sendMail",
            "/api/v1/user/common/check",
            "/api/v1/netty",                   // WebSocket 握手,由 Netty 端校验 JWT(§8)
            "/actuator"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        if (request.getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        // 白名单:放行,但仍剥离客户端伪造的身份头
        if (isWhitelisted(path)) {
            return chain.filter(exchange.mutate()
                    .request(builder -> builder.headers(this::stripInjectedHeaders))
                    .build());
        }

        Claims claims;
        try {
            claims = JwtUtil.parse(resolveToken(request.getHeaders()));
        } catch (Exception e) {
            return unauthorized(exchange);
        }
        String userId = claims.getSubject();
        if (!StringUtils.hasText(userId)) {
            return unauthorized(exchange);
        }
        String rolesCsv = JwtUtil.getRolesCsv(claims);

        ServerWebExchange mutated = exchange.mutate()
                .request(builder -> builder.headers(headers -> {
                    stripInjectedHeaders(headers);
                    headers.set(IdentityHeaders.USER_ID, userId);
                    if (StringUtils.hasText(rolesCsv)) {
                        headers.set(IdentityHeaders.USER_ROLES, rolesCsv);
                    }
                }))
                .build();
        return chain.filter(mutated);
    }

    /** 剥离客户端自带的注入头(防伪造):X-User-Id / X-User-Roles。 */
    private void stripInjectedHeaders(HttpHeaders headers) {
        headers.remove(IdentityHeaders.USER_ID);
        headers.remove(IdentityHeaders.USER_ROLES);
    }

    private boolean isWhitelisted(String path) {
        for (String prefix : WHITELIST) {
            if (path.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    private String resolveToken(HttpHeaders headers) {
        String authorization = headers.getFirst(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(authorization)) {
            return authorization;
        }
        return headers.getFirst("token");
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String body = "{\"code\":40100,\"message\":\"未认证或令牌无效\",\"data\":null,\"timestamp\":"
                + System.currentTimeMillis() + "}";
        DataBuffer buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
