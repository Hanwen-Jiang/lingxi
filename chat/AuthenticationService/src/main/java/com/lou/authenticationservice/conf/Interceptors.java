package com.lou.authenticationservice.conf;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class Interceptors implements WebMvcConfigurer {

    @Autowired
    private AuthContextInterceptor authContextInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authContextInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/api/v1/user/register",
                        "/api/v1/user/login",
                        "/api/v1/user/loginCode",
                        "/api/v1/user/common/sendMail",
                        "/api/v1/user/common/check",
                        "/actuator/**",
                        "/error");
    }

}
