package com.lou.infinitechatagent.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * 把 {@link CurrentUser @CurrentUser} 参数解析为 {@link AuthPrincipal}(由 {@link GatewayIdentityFilter}
 * 写入请求属性)。无身份时返回 {@link AuthPrincipal#anonymous()},永不为 null。
 */
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class)
                && AuthPrincipal.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        Object attribute = request == null ? null : request.getAttribute(GatewayIdentityFilter.PRINCIPAL_ATTRIBUTE);
        return attribute instanceof AuthPrincipal principal ? principal : AuthPrincipal.anonymous();
    }
}
