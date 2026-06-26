package com.lou.momentservice.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 注册统一鉴权拦截器。
 * MomentService 白名单为空，拦截所有路径。
 */
@Configuration
public class WebMvcAuthConfig implements WebMvcConfigurer {

    @Autowired
    private AuthContextInterceptor authContextInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authContextInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns("/actuator/**", "/error");
    }
}
