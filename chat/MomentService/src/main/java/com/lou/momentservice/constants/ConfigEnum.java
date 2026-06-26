package com.lou.momentservice.constants;

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

    TOKEN_SECRET_KEY(config("jwt.secret-key", "JWT_SECRET_KEY", "")),

    PASSWORD_ASLT(config("chat.password-salt", "CHAT_PASSWORD_SALT", "")),

    WX_STATE(config("chat.wx-state", "CHAT_WX_STATE", "")),

    WORKED_ID( "1"),

    DATACENTER_ID( "1"),

    IMAGE_URI(config("chat.image-uri", "CHAT_IMAGE_URI", "http://localhost:9090/infinite-chat/")),

    IMAGE_PATH("/img/avatar"),

    NOTICE_URL("/api/v1/message/push/moment"),

    MEDIA_TYPE("application/json; charset=utf-8"),

    COS_CDN_DOMAIN(config("tencent.cos.cdn-domain", "TENCENT_CLOUD_COS_CDN_DOMAIN", "")),

    COS_SECRET_ID(config("tencent.cos.secret-id", "TENCENT_CLOUD_COS_SECRET_ID", "")),

    COS_SECRET_KEY(config("tencent.cos.secret-key", "TENCENT_CLOUD_COS_SECRET_KEY", "")),

    COS_BUCKET_NAME(config("tencent.cos.bucket", "TENCENT_CLOUD_COS_BUCKET", "")),

    REQUEST_SUCCESSFUL("请求成功");


    private final String value;

    ConfigEnum(String value) {

        this.value = value;
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
