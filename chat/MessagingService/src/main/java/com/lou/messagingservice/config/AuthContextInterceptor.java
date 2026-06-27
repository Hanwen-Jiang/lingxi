package com.lou.messagingservice.config;

import com.lou.common.security.RequestContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 统一鉴权拦截器。
 * - X-Internal-Token 命中共享密钥时视为可信内部调用，放行。
 * - 否则要求网关注入的 X-User-Id，并写入 {@link UserContext}。
 * <p>同时桥接 chat-common 的 {@link RequestContext}(供新客户端端点使用 requireUserId 等),
 * 旧端点继续依赖 {@link UserContext}，行为不变。
 */
@Component
public class AuthContextInterceptor implements HandlerInterceptor {

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String traceId = request.getHeader("X-Trace-Id");
        if (traceId != null && !traceId.trim().isEmpty()) {
            RequestContext.setTraceId(traceId.trim());
        }

        String token = request.getHeader("X-Internal-Token");
        if (token != null && token.equals(internalToken)) {
            return true;
        }

        String uid = request.getHeader("X-User-Id");
        if (uid != null && !uid.trim().isEmpty()) {
            try {
                Long userId = Long.valueOf(uid.trim());
                UserContext.set(userId);
                // 桥接 chat-common RequestContext(新端点用),旧端点仍读 UserContext。
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
