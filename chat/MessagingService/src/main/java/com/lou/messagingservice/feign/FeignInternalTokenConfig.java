package com.lou.messagingservice.feign;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 给所有 Feign 请求注入 X-Internal-Token，使被调用服务视为可信内部调用。
 */
@Configuration
public class FeignInternalTokenConfig {

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    @Bean
    public RequestInterceptor internalTokenRequestInterceptor() {
        return template -> template.header("X-Internal-Token", internalToken);
    }
}
