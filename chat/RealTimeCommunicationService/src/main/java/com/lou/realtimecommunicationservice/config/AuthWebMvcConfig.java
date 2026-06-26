package com.lou.realtimecommunicationservice.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 注册统一鉴权拦截器。
 * RTC 仅对纯内部 HTTP 接口 /api/v1/message/** 做内部令牌校验；
 * Netty WS 握手鉴权保持原样，不受此拦截器影响。
 */
@Configuration
public class AuthWebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private AuthContextInterceptor authContextInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authContextInterceptor)
                .addPathPatterns("/api/v1/message/**");
    }
}
