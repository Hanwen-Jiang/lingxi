package com.lou.contactservice.constants;

import lombok.Getter;

/**
 * @ClassName ConfigEnum
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/1 15:11
 */

@Getter
public enum ConfigEnum {
    MEDIA_TYPE("application/json; charset=utf-8"),
    WORKED_ID("1"),
    DATACENTER_ID("1"),
    GROUP_AVATAR_URL(config("chat.group-avatar-url", "CHAT_GROUP_AVATAR_URL", "http://localhost:9090/infinite-chat/img/avatar")),
    REQUEST_SUCCESSFUL("请求成功"),
    OPTION_FAILURE("操作失败");


    private final String value;

    ConfigEnum(String value) {
        this.value = value;
    }

    private static String config(String propertyName, String envName, String defaultValue) {
        String propertyValue = System.getProperty(propertyName);
        if (propertyValue != null && !propertyValue.trim().isEmpty()) {
            return propertyValue;
        }
        String envValue = System.getenv(envName);
        return envValue == null || envValue.trim().isEmpty() ? defaultValue : envValue;
    }

}
