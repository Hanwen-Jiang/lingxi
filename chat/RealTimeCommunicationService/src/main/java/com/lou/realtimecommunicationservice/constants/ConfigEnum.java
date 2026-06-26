package com.lou.realtimecommunicationservice.constants;

import lombok.Getter;

/**
 * @ClassName ConfigEnum
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/1 15:11
 */

@Getter
public enum ConfigEnum {

    TOKEN_SECRET_KEY("tokenSecretKey", config("jwt.secret-key", "JWT_SECRET_KEY", ""));

    private final String value;
    private final String text;

    ConfigEnum(String text, String value) {
        this.text = text;
        this.value = value;
    }

    public String getText() {
        return text;
    }


    public String getValue() {
        return value;
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
