package com.lou.momentservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 统一鉴权拦截器。
 * <p>
 * - 服务间调用携带 X-Internal-Token，与配置值匹配时视为可信内部调用，直接放行。
 * - 否则要求网关注入的 X-User-Id，解析为 Long 写入 {@link UserContext}。
 * - 两者皆无或非法则返回 401。
 */
@Component
public class AuthContextInterceptor implements HandlerInterceptor {

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String token = request.getHeader("X-Internal-Token");
        if (token != null && token.equals(internalToken)) {
            // 可信内部调用，无需 X-User-Id
            return true;
        }

        String uid = request.getHeader("X-User-Id");
        if (uid != null && !uid.trim().isEmpty()) {
            try {
                UserContext.set(Long.valueOf(uid.trim()));
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
    }

    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":40101,\"msg\":\"未认证或非法请求来源\",\"data\":null}");
    }
}
