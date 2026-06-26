package com.lou.contactservice.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers the authentication context interceptor for all endpoints.
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
