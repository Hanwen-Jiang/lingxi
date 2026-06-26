package com.lou.realtimecommunicationservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 统一鉴权拦截器（RTC 变体）。
 * RTC 的 /api/v1/message/** 为纯内部接口（被 Messaging/Contact/Moment 直接调用，不经网关），
 * 因此仅校验 X-Internal-Token，不要求 X-User-Id。
 */
@Component
public class AuthContextInterceptor implements HandlerInterceptor {

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String token = request.getHeader("X-Internal-Token");
        if (token != null && token.equals(internalToken)) {
            return true;
        }
        return unauthorized(response);
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        UserContext.clear();
    }

    private boolean unauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":40101,\"msg\":\"未认证或非法请求来源\",\"data\":null}");
        return false;
    }
}
