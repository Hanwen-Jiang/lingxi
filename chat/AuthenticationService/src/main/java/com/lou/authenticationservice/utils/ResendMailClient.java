package com.lou.authenticationservice.utils;

import lombok.RequiredArgsConstructor;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class ResendMailClient {

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");

    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build();

    @Value("${resend.api-key:}")
    private String apiKey;

    @Value("${resend.from:}")
    private String from;

    @Value("${resend.api-url:https://api.resend.com/emails}")
    private String apiUrl;

    public void sendText(String to, String subject, String text) {
        if (!StringUtils.hasText(apiKey)) {
            throw new IllegalStateException("RESEND_API_KEY 未配置");
        }
        if (!StringUtils.hasText(from)) {
            throw new IllegalStateException("RESEND_FROM 未配置");
        }

        String body = "{"
                + "\"from\":\"" + jsonEscape(from) + "\","
                + "\"to\":[\"" + jsonEscape(to) + "\"],"
                + "\"subject\":\"" + jsonEscape(subject) + "\","
                + "\"text\":\"" + jsonEscape(text) + "\""
                + "}";

        Request request = new Request.Builder()
                .url(apiUrl)
                .addHeader("Authorization", "Bearer " + apiKey)
                .addHeader("Content-Type", "application/json")
                .addHeader("User-Agent", "infinitechat-authentication-service/1.0")
                .post(RequestBody.create(JSON, body))
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String responseBody = response.body() == null ? "" : response.body().string();
                throw new IllegalStateException("Resend 发信失败: HTTP " + response.code() + " " + responseBody);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Resend 发信请求失败", e);
        }
    }

    private static String jsonEscape(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    escaped.append("\\\"");
                    break;
                case '\\':
                    escaped.append("\\\\");
                    break;
                case '\b':
                    escaped.append("\\b");
                    break;
                case '\f':
                    escaped.append("\\f");
                    break;
                case '\n':
                    escaped.append("\\n");
                    break;
                case '\r':
                    escaped.append("\\r");
                    break;
                case '\t':
                    escaped.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) c));
                    } else {
                        escaped.append(c);
                    }
                    break;
            }
        }
        return escaped.toString();
    }
}
