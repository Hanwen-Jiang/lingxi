package com.lou.messagingservice.config;


import com.lou.messagingservice.common.ServiceException;
import com.lou.messagingservice.util.PreventDuplicateSubmit;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;


@Component
@Slf4j
@Aspect
public class PreventDuplicateSubmitAspect {

    private static final String KEY_PREFIX = "prevent-duplicate-submit:";

    private final StringRedisTemplate stringRedisTemplate;

    public PreventDuplicateSubmitAspect(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Around("@annotation(preventDuplicateSubmit)")
    public Object preventDuplicate(ProceedingJoinPoint joinPoint, PreventDuplicateSubmit preventDuplicateSubmit) throws Throwable {
        // 根据方法名和参数生成唯一请求键
        String key = KEY_PREFIX + joinPoint.getSignature().toShortString() + Arrays.toString(joinPoint.getArgs());

        // 基于 Redis 的分布式幂等：setIfAbsent 原子占位，false 表示重复提交
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent(key, "1", preventDuplicateSubmit.timeout(), TimeUnit.MILLISECONDS);

        if (acquired == null || !acquired) {
            log.warn("Duplicate submission detected for method: {}", key);
            throw new ServiceException("请勿重复提交请求");
        }

        return joinPoint.proceed();
    }
}
