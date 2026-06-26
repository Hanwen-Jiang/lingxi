package com.lou.messagingservice.constants;

import lombok.Getter;
import org.apache.commons.lang3.ObjectUtils;

/**
 * @ClassName ConfigEnum
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/1 15:11
 */

@Getter
public enum ConfigEnum {

    TOKEN_SECRET_KEY("tokenSecretKey", config("jwt.secret-key", "JWT_SECRET_KEY", "")),

    WORKED_ID("workedId", "1"),

    DATACENTER_ID("DATACENTER_ID", "1"),

    IMAGE_URI("imageUri", config("chat.image-uri", "CHAT_IMAGE_URI", "http://localhost:9090/infinite-chat/img/avatar")),

    MEDIA_TYPE("mediaType","application/json; charset=utf-8"),

    MSG_URL("msgUrl","/api/v1/message/user/"),  //RealTimeCommunicationService服务推送接口

    KAFKA_TOPICS("kafkaTopcis","thousands_word_message"),

    HTTP_CONFIG("httpConfig","application/json; charset=utf-8"),

    IMAGE_PATH("imagePath","/home/img/avatar");

    private final String value;
    private final String text;

    ConfigEnum(String text, String value) {
        this.text = text;
        this.value = value;
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
