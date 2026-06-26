package com.lou.momentservice.utils;

import com.alibaba.fastjson.JSON;

import com.lou.momentservice.Exception.MessageSendFailureException;
import com.lou.momentservice.Exception.ServiceUnavailableException;
import com.lou.momentservice.constants.ConfigEnum;
import com.lou.momentservice.constants.ErrorEnum;

import com.lou.momentservice.model.vo.MomentRTCVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * HTTP请求发送组件
 * 负责向实时通信服务发送通知
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SendOkHttpRequest {

    /**
     * 用于线程池的默认线程数
     */
    private static final int DEFAULT_THREAD_POOL_SIZE = 5;

    /**
     * 服务间调用共享密钥
     */
    @Value("${internal.service.token:infinite-chat-internal-dev-token}")
    private String internalToken;

    /**
     * 复用的 HTTP 客户端
     */
    private final OkHttpClient client = new OkHttpClient();

    /**
     * Redis模板
     */
    @Autowired
    private final RedisTemplate<String, String> stringRedisTemplate;

    /**
     * 服务发现客户端
     */
    private final DiscoveryClient discoveryClient;

    /**
     * 发送通知
     *
     * @param notificationData 通知数据
     * @param senderUserId 发送者用户ID
     * @param notificationType 通知类型
     * @param momentId 朋友圈ID
     * @throws Exception 发送过程中可能发生的异常
     */
    public void sendNotification(MomentRTCVO notificationData, Long senderUserId, Integer notificationType, Long momentId) throws Exception {
        // 获取可用的实时通信服务实例
        List<ServiceInstance> instances = getServiceInstances();

//        // 准备请求数据
//        String token = stringRedisTemplate.opsForValue().get(senderUserId.toString());
//        if (token == null) {
//            log.error("找不到用户 {} 的认证令牌", senderUserId);
//            throw new ServiceUnavailableException();
//
//        }
        String requestBody = JSON.toJSONString(notificationData);

        // 发送请求
        sendRequestsToServices(instances, requestBody);
    }

    /**
     * 获取实时通信服务实例
     *
     * @return 服务实例列表
     * @throws ServiceUnavailableException 服务不可用时抛出异常
     */
    private List<ServiceInstance> getServiceInstances() throws ServiceUnavailableException {
        List<ServiceInstance> instances = discoveryClient.getInstances("RealTimeCommunicationService");

        if (instances.isEmpty()) {
            log.error("找不到可用的实时通信服务实例");
            throw new ServiceUnavailableException();
        }

        return instances;
    }

    /**
     * 向服务实例发送请求
     *
     * @param instances 服务实例列表
     * @param requestBodyJson JSON格式的请求体
     */
    private void sendRequestsToServices(List<ServiceInstance> instances, String requestBodyJson) {
        // 创建线程池
        ExecutorService executorService = Executors.newFixedThreadPool(DEFAULT_THREAD_POOL_SIZE);

        // 复用HTTP客户端字段
        MediaType mediaType = MediaType.get(ConfigEnum.MEDIA_TYPE.getValue());
        RequestBody requestBody = RequestBody.create(mediaType, requestBodyJson);

        // 向每个实例发送请求
        for (ServiceInstance instance : instances) {
            executorService.submit(() -> {
                sendRequestToInstance(instance, client, requestBody, requestBodyJson);
            });
        }

        // 关闭线程池
        executorService.shutdown();
    }

    /**
     * 向单个服务实例发送请求
     *
     * @param instance 服务实例
     * @param client HTTP客户端
     * @param requestBody 请求体
     * @param originalJson 原始JSON字符串（用于错误报告）
     */
    private void sendRequestToInstance(ServiceInstance instance, OkHttpClient client,
                                       RequestBody requestBody, String originalJson) {
        try {
            // 构建请求
            String url = instance.getUri().toString() + ConfigEnum.NOTICE_URL.getValue();
            Request request = new Request.Builder()
                    .url(url)
                    .post(requestBody)
                    .addHeader("X-Internal-Token", internalToken)
                    .build();

            // 执行请求，确保 Response 被关闭，避免连接泄漏
            try (Response response = client.newCall(request).execute()) {
                log.info("成功向实例 {} 发送通知, 响应码: {}", instance.getUri(), response.code());
            }

        } catch (Exception e) {
            log.error("向实例 {} 发送通知失败: {}", instance.getUri(), e.getMessage());

            throw new MessageSendFailureException(
                    ErrorEnum.MESSAGE_SEND_FAILURE,
                    originalJson,
                    e
            );
        }
    }
}