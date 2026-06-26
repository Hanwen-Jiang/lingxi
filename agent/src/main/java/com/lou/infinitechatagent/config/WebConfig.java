package com.lou.infinitechatagent.config;

import com.lou.infinitechatagent.security.CurrentUserArgumentResolver;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Web MVC 装配:注册 {@link CurrentUserArgumentResolver},使控制器可用
 * {@link com.lou.infinitechatagent.security.CurrentUser @CurrentUser} 注入网关身份。
 * (CORS 由 {@link CorsConfig} 的 CorsFilter 单独负责。)
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver());
    }
}
