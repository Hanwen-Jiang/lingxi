package com.lou.messagingservice.service.impl;

import cn.hutool.core.lang.Snowflake;
import cn.hutool.core.util.IdUtil;
import com.alibaba.fastjson.JSON;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.common.ServiceException;
import com.lou.messagingservice.constants.ConfigEnum;
import com.lou.messagingservice.constants.SessionType;
import com.lou.messagingservice.data.sendMsg.AppMessage;
import com.lou.messagingservice.data.sendMsg.KafkaMsgVO;
import com.lou.messagingservice.data.sendMsg.SendMsgRequest;
import com.lou.messagingservice.data.sendMsg.SendMsgResponse;
import com.lou.messagingservice.mapper.FriendMapper;
import com.lou.messagingservice.mapper.MessageMapper;
import com.lou.messagingservice.model.Friend;
import com.lou.messagingservice.model.Message;
import com.lou.messagingservice.model.Session;
import com.lou.messagingservice.model.User;
import com.lou.messagingservice.route.RealtimeRouteService;
import com.lou.messagingservice.service.MessageService;
import com.lou.messagingservice.service.SessionService;
import com.lou.messagingservice.service.UserService;
import com.lou.messagingservice.service.UserSessionService;
import com.lou.messagingservice.service.KafkaOutboxService;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;


@Service
@Slf4j
public class MessageServiceImpl extends ServiceImpl<MessageMapper, Message> implements MessageService {

    private static final int CORE_POOL_SIZE = 5;
    private static final int MAX_POOL_SIZE = 10;
    private static final long KEEP_ALIVE_TIME = 60L;
    private static final int QUEUE_CAPACITY = 100;


    private static final String DEFAUL_SESSION_AVATAR = config(
            "chat.default-session-avatar",
            "CHAT_DEFAULT_SESSION_AVATAR",
            "http://localhost:9090/infinite-chat/WechatIMG1.jpeg"
    );

    private static final String TIME_ZONE_SHANGHAI = "Asia/Shanghai";

    private static final int STATUS_ACTIVE = 1;

    private final UserService userService;

    private final FriendMapper friendMapper;

    private final UserSessionService userSessionService;

    private final SessionService sessionService;

    private final KafkaOutboxService kafkaOutboxService;

    private final RealtimeRouteService realtimeRouteService;

    private final OkHttpClient httpClient = new OkHttpClient();

    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    private final ThreadPoolExecutor groupMessageExecutor;


    public MessageServiceImpl(UserService userService, FriendMapper friendMapper, UserSessionService userSessionService,
                              SessionService sessionService, KafkaOutboxService kafkaOutboxService,
                              RealtimeRouteService realtimeRouteService) {
        this.userService = userService;
        this.friendMapper = friendMapper;
        this.userSessionService = userSessionService;
        this.sessionService = sessionService;
        this.kafkaOutboxService = kafkaOutboxService;
        this.realtimeRouteService = realtimeRouteService;
        this.groupMessageExecutor = new ThreadPoolExecutor(
                CORE_POOL_SIZE,
                MAX_POOL_SIZE,
                KEEP_ALIVE_TIME,
                TimeUnit.SECONDS,
                new LinkedBlockingDeque<>(QUEUE_CAPACITY),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }

    @Override
    public SendMsgResponse sendMessage(SendMsgRequest request) {
        // 1.校验用户是否存在
        validateSender(request.getSendUserId());

        // 2.判断单聊还是群聊，群聊去获取用户名单
        List<Long> receiveUserIds = getReceiveUserIds(request);
        validateReceiveUserIds(receiveUserIds);

        // 3.构建消息
        AppMessage appMessage = buildAppMessage(request, receiveUserIds);
        Long messageId = generateMessageId();
        Date createdAt = new Date();
        appMessage.setMessageId(messageId).setCreated(formatDate(createdAt));

        // 写入本地outbox后异步发送Kafka，失败时由定时任务补偿
        sendKafkaMessage(request, request.getSendUserId(), messageId, createdAt);

        // 4.Redis保存真实在线路由；缺失说明当前没有长连接，实时推送跳过，离线消息由存储链路兜底
        sendRealTimeMessage(request, appMessage);

        return buildAppMessage(appMessage);
    }

    private void sendKafkaMessage(SendMsgRequest sendMsgRequest, Long sendUserId, Long messageId, Date createdAt) {
        KafkaMsgVO kafkaMsgVO = new KafkaMsgVO();
        BeanUtils.copyProperties(sendMsgRequest, kafkaMsgVO);
        kafkaMsgVO.setMessageId(messageId)
                .setCreateAt(createdAt);

        String kafkaJSON = JSON.toJSONString(kafkaMsgVO);
        log.info("发送Kafka消息: {}", kafkaJSON);

        // B4: 同一本地事务写 message + outbox(提交后才发 Kafka);message 字段映射须与离线投影一致
        Message message = buildMessageEntity(sendMsgRequest, messageId, createdAt);
        kafkaOutboxService.persistMessageAndOutbox(
                message,
                messageId,
                ConfigEnum.KAFKA_TOPICS.getValue(),
                sendMsgRequest.getSessionId().toString(),
                kafkaJSON
        );
    }

    /**
     * B4: 由发送请求构建 message 行,字段映射与离线消费者投影保持一致
     * (content=body.content, replyId=body.replyId, senderId=sendUserId),使两侧幂等写入同一行。
     */
    private Message buildMessageEntity(SendMsgRequest request, Long messageId, Date createdAt) {
        Message message = new Message();
        message.setMessageId(messageId);
        message.setSenderId(request.getSendUserId());
        message.setSessionId(request.getSessionId());
        message.setType(request.getType());
        message.setSessionType(request.getSessionType());
        com.alibaba.fastjson.JSONObject body = parseBody(request.getBody());
        if (body != null) {
            String content = body.getString("content");
            // 媒体消息(图/文件/视频)body 形如 {url,size} 无 content;把 url 落 content,
            // 否则 message.content=null,刷新拉历史时图片丢失(S4 按 content=图片 url 渲染)。
            if (content == null) {
                content = body.getString("url");
            }
            message.setContent(content);
            message.setReplyId(body.getLong("replyId"));
        }
        message.setCreatedAt(createdAt);
        message.setUpdatedAt(createdAt);
        return message;
    }

    private com.alibaba.fastjson.JSONObject parseBody(Object body) {
        if (body == null) {
            return null;
        }
        Object json = JSON.toJSON(body);
        return json instanceof com.alibaba.fastjson.JSONObject ? (com.alibaba.fastjson.JSONObject) json : null;
    }

    private void sendRealTimeMessage(SendMsgRequest sendMsgRequest, AppMessage appMessage) {
        if (sendMsgRequest.getSessionType() == SessionType.SINGLE.getValue()) {
            sendSingleMessage(sendMsgRequest, appMessage);
        } else {
            sendGroupMessage(appMessage);
        }
    }

    private void sendSingleMessage(SendMsgRequest sendMsgRequest, AppMessage appMessage) {
        String receiveUserId = String.valueOf(sendMsgRequest.getReceiveUserId());
        Map<String, List<Long>> routeMap = realtimeRouteService.groupUsersByRoute(appMessage.getReceiveUserIds());
        if (routeMap.isEmpty()) {
            log.info("接收者已下线或无可用实时通信节点: {}", receiveUserId);
            return;
        }

        try {
            Map.Entry<String, List<Long>> routeEntry = routeMap.entrySet().iterator().next();
            Request request = buildRealtimeRequest(routeEntry.getKey(), copyAppMessageForReceivers(appMessage, routeEntry.getValue()));
            executeHttpRequest(request);
        } catch (Exception e) {
            // M8: 实时推送 best-effort——消息已在事务内持久化(B4),推送失败不回滚、不抛错;
            // 清理失效路由,接收方改由离线拉取/重连补投兜底。
            routeMap.forEach(this::removeInvalidRoutes);
            log.error("发送单聊实时消息失败(消息已持久化,转离线/补偿): {}", e.getMessage());
        }
    }

    private void sendGroupMessage(AppMessage appMessage) {
        Map<String, List<Long>> routeMap = realtimeRouteService.groupUsersByRoute(appMessage.getReceiveUserIds());
        if (routeMap.isEmpty()) {
            log.info("群聊消息无在线接收者或无可用实时通信节点，sessionId: {}", appMessage.getSessionId());
            return;
        }

        for (Map.Entry<String, List<Long>> routeEntry : routeMap.entrySet()) {
            groupMessageExecutor.submit(() -> {
                try {
                    Request request = buildRealtimeRequest(
                            routeEntry.getKey(),
                            copyAppMessageForReceivers(appMessage, routeEntry.getValue())
                    );
                    executeHttpRequest(request);
                    log.info("成功发送群聊消息到 {}, 接收者: {}", routeEntry.getKey(), routeEntry.getValue());
                } catch (Exception e) {
                    removeInvalidRoutes(routeEntry.getKey(), routeEntry.getValue());
                    log.error("发送群聊消息到 {} 失败: {}", routeEntry.getKey(), e.getMessage());
                }
            });
        }
    }

    private void removeInvalidRoutes(String route, List<Long> receiveUserIds) {
        for (Long receiveUserId : receiveUserIds) {
            realtimeRouteService.removeRouteIfMatch(receiveUserId, route);
        }
    }

    private Request buildRealtimeRequest(String route, AppMessage appMessage) {
        RequestBody requestBody = RequestBody.create(
                MediaType.parse(ConfigEnum.MEDIA_TYPE.getValue()),
                JSON.toJSONString(appMessage)
        );
        return new Request.Builder()
                .url(route + ConfigEnum.MSG_URL.getValue())
                .header("X-Internal-Token", internalToken)
                .post(requestBody)
                .build();
    }

    private AppMessage copyAppMessageForReceivers(AppMessage appMessage, List<Long> receiveUserIds) {
        AppMessage routedMessage = new AppMessage();
        BeanUtils.copyProperties(appMessage, routedMessage);
        routedMessage.setReceiveUserIds(receiveUserIds);
        return routedMessage;
    }

    private void executeHttpRequest(Request request) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("Http请求失败:" + response);
            }
            ResponseBody responseBody = response.body();
            if (responseBody != null) {
                String responseString = responseBody.string();
                //处理响应内容
                log.info("HTTP响应: {}", responseString);
            }
        }
    }

    private SendMsgResponse buildAppMessage(AppMessage appMessage) {
        SendMsgResponse responseMsgVo = new SendMsgResponse();
        BeanUtils.copyProperties(appMessage, responseMsgVo);
        responseMsgVo.setSessionId(String.valueOf(appMessage.getSessionId()));
        responseMsgVo.setMessageId(String.valueOf(appMessage.getMessageId())); // D5 string 化
        responseMsgVo.setCreatedAt(appMessage.getCreated());

        log.info("消息 appMessage: {}", appMessage);
        log.info("消息 responseMsgVo: {}", responseMsgVo);

        return responseMsgVo;
    }

    private Long generateMessageId() {
        Snowflake snowflake = IdUtil.getSnowflake(
                Integer.parseInt(ConfigEnum.WORKED_ID.getValue()),
                Integer.parseInt(ConfigEnum.DATACENTER_ID.getValue())
        );
        return snowflake.nextId();
    }

    private static String config(String propertyName, String envName, String defaultValue) {
        String propertyValue = System.getProperty(propertyName);
        if (propertyValue != null && !propertyValue.trim().isEmpty()) {
            return propertyValue;
        }
        String envValue = System.getenv(envName);
        return envValue == null || envValue.trim().isEmpty() ? defaultValue : envValue;
    }

    private void validateSender(Long sendUserId) {
        User sendUser = userService.getById(sendUserId);
        log.info("发送者状态: {}", sendUserId);
        if (sendUser == null || sendUser.getStatus() != STATUS_ACTIVE) {
            throw new ServiceException("发送者状态异常");
        }
    }

    private void validateReceiveUserIds(List<Long> receiveUserIds) {
        if (receiveUserIds == null || receiveUserIds.isEmpty()) {
            throw new ServiceException("接收者列表不能为空");
        }
    }

    private List<Long> getReceiveUserIds(SendMsgRequest sendMsgRequest) {
        List<Long> receiveUserIds = new ArrayList<>();
        int sessionType = sendMsgRequest.getSessionType();

        if (sessionType == SessionType.SINGLE.getValue()) {
            Long receiveUserId = sendMsgRequest.getReceiveUserId();
            receiveUserIds.add(receiveUserId);
            validateSingleSession(sendMsgRequest.getSendUserId(), receiveUserId);
        } else {
            receiveUserIds.addAll(userSessionService.getUserIdsBySessionId(sendMsgRequest.getSessionId()));
            log.info("群聊接收者列表: {}", receiveUserIds);
            boolean removed = receiveUserIds.remove(sendMsgRequest.getSendUserId());
            if (removed) {
                log.info("移除发送者后的接收者列表: {}", receiveUserIds);
            } else {
                throw new ServiceException("发送者不在群聊内");
            }
        }
        return receiveUserIds;
    }


    private void validateSingleSession(Long sendUserId, Long receiveUserId) {
        User receiveUser = userService.getById(receiveUserId);

        if (receiveUser == null || receiveUser.getStatus() != STATUS_ACTIVE) {
            throw new ServiceException("接收者" + receiveUserId + "状态异常");
        }

        Friend friend = friendMapper.selectFriendship(sendUserId, receiveUserId);
        log.info("发送者ID: {}, 接收者ID: {}", sendUserId, receiveUserId);
        if (friend == null || friend.getStatus() != STATUS_ACTIVE) {
            throw new ServiceException("发送者" + sendUserId + "与接收者" + receiveUserId + "不是好友关系");
        }
    }

    private AppMessage buildAppMessage(SendMsgRequest sendMsgRequest, List<Long> receiveUserIds) {
        AppMessage appMessage = new AppMessage();
        BeanUtils.copyProperties(sendMsgRequest, appMessage);
        appMessage.setBody(sendMsgRequest.getBody()).setReceiveUserIds(receiveUserIds);

        User senderUser = userService.getById(sendMsgRequest.getSendUserId());
        appMessage.setAvatar(senderUser.getAvatar()).setUserName(senderUser.getUserName());

        Session session = sessionService.getById(sendMsgRequest.getSessionId());
        log.info("会话ID: {}", sendMsgRequest.getSessionId());
        log.info("会话信息: {}", session);

        if (appMessage.getSessionType() == SessionType.SINGLE.getValue()) {
            appMessage.setAvatar(null).setSeesionName(null);
        } else {
            appMessage.setSessionAvatr(DEFAUL_SESSION_AVATAR).setSeesionName(session.getName());
        }

        log.info("Appmessage: {}", appMessage);
        return appMessage;
    }


    private String formatDate(Date date) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        formatter.setTimeZone(TimeZone.getTimeZone(TIME_ZONE_SHANGHAI));
        return formatter.format(date);
    }

}
