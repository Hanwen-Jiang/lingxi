package com.lou.offlinedatastoreservice.constants.config;

import org.apache.commons.lang3.ObjectUtils;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public enum ConfigEnum {

    WORKED_ID("WORKED_Id", "1"),

    DATACENTER_ID("DATACENTER_ID", "1"),

    GROUP_TYPE("GROUP_TYPE", "2"),

    MESSAGE_TYPE("MESSAGE_TYPE", "5"),

    GROUP_AVATAR("GROUP_AVATAR", config("chat.group-avatar-url", "CHAT_GROUP_AVATAR_URL", "http://localhost:9090/infinite-chat/WechatIMG1.jpeg"));


    private final String text;

    private final String value;

    ConfigEnum(String text, String value) {
        this.text = text;
        this.value = value;
    }

    public static List<String> getValues() {
        return Arrays.stream(ConfigEnum.values()).map(ConfigEnum::getValue).collect(Collectors.toList());
    }

    public static ConfigEnum getEnumByValue(String value) {
        if (ObjectUtils.isEmpty(value)) {
            return null;
        }
        for (ConfigEnum anEnum : ConfigEnum.values()) {
            if (anEnum.getValue().equals(value)) {
                return anEnum;
            }
        }
        return null;
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
