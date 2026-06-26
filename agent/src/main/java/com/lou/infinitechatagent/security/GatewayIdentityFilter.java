package com.lou.infinitechatagent.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * 入网关身份过滤器(D2/D3/B1)。信任【统一网关注入】的 {@code X-User-Id}/{@code X-User-Roles}:
 * <ul>
 *   <li>解析出 {@link AuthPrincipal} 挂到请求属性,供 {@link CurrentUser @CurrentUser} 注入。</li>
 *   <li>enforce 开启时,缺失/非法 {@code X-User-Id} 的【非公开】请求直接 401 —— 挡住绕过网关的直连(IDOR 闭环)。</li>
 * </ul>
 *
 * <p><b>expand/contract:</b> {@code agent.gateway.enforce-identity} 默认 <b>false</b>(网关尚未 front agent 时,
 * 保持可直连、回退 body userId,不破现状);S3 网关上线 + 加 {@code /api/agent|memory|rag} 路由后翻 <b>true</b>,
 * 完成"拒直连 + 只信网关身份"。{@code X-User-Roles} 头名为 S1 提案,待 S3 网关确认。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
@Slf4j
public class GatewayIdentityFilter extends OncePerRequestFilter {

    public static final String USER_ID_HEADER = "X-User-Id";
    public static final String ROLES_HEADER = "X-User-Roles";
    public static final String PRINCIPAL_ATTRIBUTE = AuthPrincipal.class.getName();

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Set<String> PUBLIC_PREFIXES =
            Set.of("/actuator", "/swagger-ui", "/v3/api-docs", "/error", "/favicon.ico");

    private final boolean enforce;

    public GatewayIdentityFilter(@Value("${agent.gateway.enforce-identity:false}") boolean enforce) {
        this.enforce = enforce;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        AuthPrincipal principal = AuthPrincipal.anonymous();
        String rawUserId = trimToNull(request.getHeader(USER_ID_HEADER));
        if (rawUserId != null) {
            Long parsed = parseLongOrNull(rawUserId);
            if (parsed != null) {
                principal = AuthPrincipal.of(rawUserId, parsed, parseRoles(request.getHeader(ROLES_HEADER)));
            } else if (enforce && !isPublic(request)) {
                writeUnauthorized(request, response, "网关身份非法:X-User-Id 不是合法 id");
                return;
            }
        } else if (enforce && !isPublic(request)) {
            writeUnauthorized(request, response, "缺少网关身份(X-User-Id),拒绝直连");
            return;
        }
        request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
        filterChain.doFilter(request, response);
    }

    private boolean isPublic(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = pathWithinApplication(request);
        for (String prefix : PUBLIC_PREFIXES) {
            if (path.equals(prefix) || path.startsWith(prefix + "/")) {
                return true;
            }
        }
        return false;
    }

    private static String pathWithinApplication(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)) {
            return uri.substring(contextPath.length());
        }
        return uri;
    }

    private void writeUnauthorized(HttpServletRequest request, HttpServletResponse response, String message)
            throws IOException {
        log.warn("[gateway-identity] 拒绝直连/非法身份: {} {}", request.getMethod(), request.getRequestURI());
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        BaseResponse<Void> body = new BaseResponse<>(ErrorCode.NOT_LOGIN_ERROR.getCode(), null, message);
        response.getWriter().write(OBJECT_MAPPER.writeValueAsString(body));
    }

    private static Set<String> parseRoles(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        Set<String> roles = new LinkedHashSet<>();
        for (String role : csv.split(",")) {
            String trimmed = role.trim().toLowerCase(Locale.ROOT);
            if (!trimmed.isEmpty()) {
                roles.add(trimmed);
            }
        }
        return roles;
    }

    private static Long parseLongOrNull(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
