package com.lou.messagingservice.util;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD) //注解应用于方法上
@Retention(RetentionPolicy.RUNTIME)
public @interface PreventDuplicateSubmit {

    /**
     * 超时时间 (单位：毫秒) ， 默认5秒
     */
    long timeout() default 5000;
}
