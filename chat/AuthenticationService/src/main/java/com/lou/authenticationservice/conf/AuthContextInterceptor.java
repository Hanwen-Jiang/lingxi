package com.lou.authenticationservice.conf;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 统一鉴权拦截器(v1)。
 * 网关已统一验签并注入 X-User-Id；服务间调用携带 X-Internal-Token。
 */
@Component
public class AuthContextInterceptor implements HandlerInterceptor {

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String internal = request.getHeader("X-Internal-Token");
        if (internal != null && internal.equals(internalToken)) {
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
