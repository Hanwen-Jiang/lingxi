package com.lou.contactservice.config;

import com.lou.common.security.RequestContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Authentication context interceptor.
 * <p>
 * Trusts the X-User-Id header injected by the gateway after JWT verification,
 * or accepts X-Internal-Token for service-to-service calls that bypass the gateway.
 */
@Component
public class AuthContextInterceptor implements HandlerInterceptor {

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 链路 traceId(网关注入),供 chat-common Result 回写。
        String traceId = request.getHeader("X-Trace-Id");
        if (traceId != null && !traceId.trim().isEmpty()) {
            RequestContext.setTraceId(traceId.trim());
        }

        String token = request.getHeader("X-Internal-Token");
        if (token != null && token.equals(internalToken)) {
            // 服务间调用:如携带代行用户身份,一并写入 chat-common 上下文(新端点需要)。
            String actingUser = request.getHeader("X-User-Id");
            if (actingUser != null && !actingUser.trim().isEmpty()) {
                RequestContext.setUserId(actingUser.trim());
                try {
                    UserContext.set(Long.valueOf(actingUser.trim()));
                } catch (NumberFormatException ignored) {
                    // 内部调用 userId 非数字时忽略,旧端点行为不变。
                }
            }
            return true;
        }

        String uid = request.getHeader("X-User-Id");
        if (uid != null && !uid.trim().isEmpty()) {
            try {
                UserContext.set(Long.valueOf(uid.trim()));
                // 同步写入 chat-common 身份上下文(新端点 RequestContext.requireUserId() 依赖)。
                RequestContext.setUserId(uid.trim());
                return true;
            } catch (NumberFormatException e) {
                writeUnauthorized(response);
                return false;
            }
        }

        writeUnauthorized(response);
        return false;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
        RequestContext.clear();
    }

    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":40101,\"msg\":\"未认证或非法请求来源\",\"data\":null}");
    }
}
