package com.lou.infinitechatagent.config;

import com.lou.infinitechatagent.ratelimit.RateLimitInterceptor;
import com.lou.infinitechatagent.security.CurrentUserArgumentResolver;
import jakarta.annotation.Resource;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Web MVC 装配:
 * <ul>
 *   <li>注册 {@link CurrentUserArgumentResolver},使控制器可用
 *       {@link com.lou.infinitechatagent.security.CurrentUser @CurrentUser} 注入网关身份。</li>
 *   <li>注册 {@link RateLimitInterceptor},对 LLM 计费端点按主体限流(L9)。</li>
 * </ul>
 * (CORS 由 {@link CorsConfig} 的 CorsFilter 单独负责。)
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Resource
    private RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver());
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 计费端点 = 会调用 LLM 的对话/检索接口。路径为 context-path(/api)之后的应用内路径。
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns(
                        "/chat", "/streamChat",
                        "/chat/auto", "/chat/auto/stream",
                        "/agent/chat",
                        "/rag/chat", "/rag/adaptive/chat");
    }
}
