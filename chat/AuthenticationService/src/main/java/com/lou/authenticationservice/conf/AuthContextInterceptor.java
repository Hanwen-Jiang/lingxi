package com.lou.authenticationservice.conf;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lou.common.api.CommonError;
import com.lou.common.api.Result;
import com.lou.common.security.IdentityHeaders;
import com.lou.common.security.RequestContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * 统一鉴权拦截器(v1)。基于 chat-common 身份上下文(03-contracts §1)。
 * <p>网关已统一验签并注入 X-User-Id/X-User-Roles/X-Trace-Id;服务间调用携带 X-Internal-Token。
 */
@Component
public class AuthContextInterceptor implements HandlerInterceptor {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String traceId = request.getHeader(IdentityHeaders.TRACE_ID);
        if (traceId != null && !traceId.trim().isEmpty()) {
            RequestContext.setTraceId(traceId.trim());
        }

        // 服务间调用:校验内部令牌即放行
        String internal = request.getHeader(IdentityHeaders.INTERNAL_TOKEN);
        if (internal != null && internal.equals(internalToken)) {
            String actingUser = request.getHeader(IdentityHeaders.USER_ID);
            if (actingUser != null && !actingUser.trim().isEmpty()) {
                RequestContext.setUserId(actingUser.trim());
                RequestContext.setRolesCsv(request.getHeader(IdentityHeaders.USER_ROLES));
            }
            return true;
        }

        // 网关注入的已认证身份
        String uid = request.getHeader(IdentityHeaders.USER_ID);
        if (uid != null && !uid.trim().isEmpty()) {
            RequestContext.setUserId(uid.trim());
            RequestContext.setRolesCsv(request.getHeader(IdentityHeaders.USER_ROLES));
            return true;
        }

        writeUnauthorized(response);
        return false;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        RequestContext.clear();
    }

    private void writeUnauthorized(HttpServletResponse response) throws Exception {
        response.setStatus(CommonError.UNAUTHENTICATED.httpStatus());
        response.setContentType("application/json;charset=UTF-8");
        Result<?> body = Result.error(CommonError.UNAUTHENTICATED, "未认证或非法请求来源");
        response.getWriter().write(OBJECT_MAPPER.writeValueAsString(body));
    }
}
