package com.lou.contactservice.service.impl;

import com.alibaba.fastjson.JSON;
import com.lou.contactservice.constants.ConfigEnum;
import com.lou.contactservice.constants.UrlEnum;
import com.lou.contactservice.data.AddFriend.FriendApplicationNotification;
import com.lou.contactservice.data.dto.push.NewGroupSessionNotification;
import com.lou.contactservice.data.dto.push.NewSessionNotification;
import com.lou.contactservice.service.PushService;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

/**
 * @ClassName PushServiceImpl
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/27 17:58
 */

@Service
@Slf4j
public class PushServiceImpl implements PushService {

    private final OkHttpClient client;

    private final RedisTemplate<String, String> redisTemplate;

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    public PushServiceImpl(RedisTemplate<String, String> redisTemplate) {
        this.client = new OkHttpClient();
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void pushNewApply(Long userId, FriendApplicationNotification notification) throws Exception {
        String urlEndpoint = UrlEnum.PUSH_NEW_APPLY.getUrl();
        pushNotification(userId, notification, urlEndpoint, "用户已下线，推送好友申请消息失败");
    }

    @Override
    public void pushGroupNewSession(Long userId, NewGroupSessionNotification notification) throws Exception {
        String urlEndpoint = UrlEnum.PUSH_NEW_GROUP_SESSION.getUrl();
        pushNotification(userId,notification,urlEndpoint,"用户已下线，推送创建群聊新会话消息失败");
    }

    @Override
    public void pushNewSession(Long userId, NewSessionNotification notification) throws Exception {
        String urlEndpoint = UrlEnum.PUSH_NEW_SESSION.getUrl();
        pushNotification(userId,notification,urlEndpoint,"用户已下线，推送创建新会话消息失败");
    }

    private void pushNotification(Long userId, Object notification, String urlEndpoint, String offlineLogMsg) throws Exception {
        String nettyServerIP = redisTemplate.opsForValue().get("user:session:" + userId.toString());


        if (nettyServerIP != null) {
//            String token = redisTemplate.opsForValue().get(String.valueOf(userId));
//            if (token == null || token.isEmpty()) {
//                log.warn("用户token为空，无法推送消息给用户ID: {}", userId);
//                return;
//            }

            String json = JSON.toJSONString(notification);
            MediaType mediaType = MediaType.get(ConfigEnum.MEDIA_TYPE.getValue());
            RequestBody requestBody = RequestBody.create(mediaType, json);
            Request request = new Request.Builder()
                    .url("http://" + nettyServerIP + urlEndpoint + userId)
                    .post(requestBody)
                    .addHeader("X-Internal-Token", internalToken)
//                    .addHeader("Authorization", token)
                    .build();

            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("推送消息失败，用户ID: {},响应码: {},响应消息:{}", userId, response.code(), response.message());
                } else {
                    log.info("成功推送消息给用户ID: {}", userId);
                }
            }
        } else {
            // 用户已下线，处理逻辑
            log.info(offlineLogMsg);
        }
    }
}
