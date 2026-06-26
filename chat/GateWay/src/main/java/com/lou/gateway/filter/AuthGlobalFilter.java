package com.lou.gateway.filter;

import com.lou.gatewaylb.GatewayJwtUtil;
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
 * 全局鉴权网关过滤器。
 * <p>
 * 这是整个系统唯一的统一鉴权入口：对所有非白名单请求验签 JWT，验签通过后把
 * 可信的用户ID（JWT subject）写入下游请求头 {@code X-User-Id}，并剥离客户端
 * 自带的同名头以杜绝伪造。下游各微服务只信任本过滤器注入的 {@code X-User-Id}。
 *
 * @author Lou
 */
@Component
public class AuthGlobalFilter implements GlobalFilter, Ordered {

    /** 下游可信用户ID请求头。 */
    public static final String USER_ID_HEADER = "X-User-Id";

    /** 免登录白名单（按路径前缀匹配）。 */
    private static final List<String> WHITELIST = Arrays.asList(
            "/api/v1/user/register",
            "/api/v1/user/login",
            "/api/v1/user/loginCode",
            "/api/v1/user/common/sendMail",
            "/api/v1/user/common/check",
            "/api/v1/netty",   // WebSocket 握手，由 Netty 端在握手时校验 JWT
            "/actuator"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // CORS 预检直接放行
        if (request.getMethod() == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        // 白名单：放行但仍剥离客户端伪造的 X-User-Id
        if (isWhitelisted(path)) {
            return chain.filter(exchange.mutate()
                    .request(builder -> builder.headers(h -> h.remove(USER_ID_HEADER)))
                    .build());
        }

        String token = resolveToken(request.getHeaders());
        String userId = GatewayJwtUtil.parseSubject(token);
        if (!StringUtils.hasText(userId)) {
            return unauthorized(exchange);
        }

        // 用经过验签的 subject 覆盖下游 X-User-Id
        ServerWebExchange mutated = exchange.mutate()
                .request(builder -> builder.headers(h -> {
                    h.remove(USER_ID_HEADER);
                    h.set(USER_ID_HEADER, userId);
                }))
                .build();
        return chain.filter(mutated);
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
        byte[] bytes = "{\"code\":40101,\"msg\":\"未认证或令牌无效\",\"data\":null}"
                .getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = response.bufferFactory().wrap(bytes);
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        // 尽早执行：早于路由转发，晚于 Spring Cloud Gateway 内置的高优先级过滤器
        return -100;
    }
}
