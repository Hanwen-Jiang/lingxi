package com.lou.infinitechatagent.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * 全局跨域配置。
 *
 * <p>安全约束(F03 / M1):不再使用 {@code "*"} 通配 origin + {@code allowCredentials=true}
 * 的危险组合。允许的来源由 {@code agent.cors.allowed-origins} 显式白名单驱动(profile/env 化),
 * 默认仅放行本地开发前端端口。生产经统一网关同源访问,网关之外不直连,跨域面收敛到最小。
 *
 * <p>过渡说明:本服务以 JWT/{@code X-User-Id}(请求头)鉴权,不依赖跨站 Cookie,因此
 * {@code allow-credentials} 默认为 {@code false};即便误配为携带凭据,也会在 origin 含
 * {@code "*"} 时强制关闭,杜绝反模式。
 */
@Configuration
public class CorsConfig {

    /** 逗号分隔的精确 origin 白名单。留空 = 不放行任何跨域(交由网关同源)。生产用 env 注入真实域名。 */
    @Value("${agent.cors.allowed-origins:http://localhost:5173,http://localhost:5180}")
    private String allowedOrigins;

    @Value("${agent.cors.allowed-methods:GET,POST,PUT,DELETE,OPTIONS}")
    private String allowedMethods;

    @Value("${agent.cors.allow-credentials:false}")
    private boolean allowCredentials;

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public CorsFilter corsFilter() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = splitCsv(allowedOrigins);
        // 显式白名单(精确 origin,非 pattern);空 = 不放行任何跨域来源
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(splitCsv(allowedMethods));
        configuration.setAllowedHeaders(List.of("*"));
        // 仅在显式开启且白名单不含通配时允许携带凭据,从根上杜绝 "*" + credentials 组合
        configuration.setAllowCredentials(allowCredentials && !origins.contains("*"));
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return new CorsFilter(source);
    }

    private static List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }
}
