package com.lou.gatewaylb;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.loadbalancer.DefaultResponse;
import org.springframework.cloud.client.loadbalancer.EmptyResponse;
import org.springframework.cloud.client.loadbalancer.Request;
import org.springframework.cloud.client.loadbalancer.RequestData;
import org.springframework.cloud.client.loadbalancer.RequestDataContext;
import org.springframework.cloud.client.loadbalancer.Response;
import org.springframework.cloud.loadbalancer.core.ReactorServiceInstanceLoadBalancer;
import org.springframework.cloud.loadbalancer.core.ServiceInstanceListSupplier;
import org.springframework.http.HttpHeaders;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Slf4j
public class NettyConsistentHashLoadBalancer implements ReactorServiceInstanceLoadBalancer {

    private final String serviceId;
    private final ObjectProvider<ServiceInstanceListSupplier> serviceInstanceListSupplierProvider;
    private final AtomicReference<RingSnapshot> ringSnapshotRef = new AtomicReference<>();

    public NettyConsistentHashLoadBalancer(ObjectProvider<ServiceInstanceListSupplier> serviceInstanceListSupplierProvider,
                                           String serviceId) {
        this.serviceInstanceListSupplierProvider = serviceInstanceListSupplierProvider;
        this.serviceId = serviceId;
    }

    @Override
    public Mono<Response<ServiceInstance>> choose(Request request) {
        ServiceInstanceListSupplier supplier = serviceInstanceListSupplierProvider.getIfAvailable();
        if (supplier == null) {
            return Mono.just(new EmptyResponse());
        }
        return supplier.get(request).next().map(instances -> chooseInstance(request, instances));
    }

    private Response<ServiceInstance> chooseInstance(Request request, List<ServiceInstance> instances) {
        if (instances == null || instances.isEmpty()) {
            log.warn("No servers available for service: {}", serviceId);
            return new EmptyResponse();
        }

        String routeKey = extractRouteKey(request);
        if (routeKey == null || routeKey.trim().isEmpty()) {
            ServiceInstance instance = instances.get(ThreadLocalRandom.current().nextInt(instances.size()));
            log.info("Netty连接缺少userUuid/token，退化为随机节点: {}", instanceKey(instance));
            return new DefaultResponse(instance);
        }

        RingSnapshot snapshot = getOrCreateSnapshot(instances);
        ServiceInstance instance = snapshot.getRing().get(routeKey);
        if (instance == null) {
            return new EmptyResponse();
        }
        log.info("Netty连接按一致性哈希路由，userId: {}, node: {}", routeKey, instanceKey(instance));
        return new DefaultResponse(instance);
    }

    private RingSnapshot getOrCreateSnapshot(List<ServiceInstance> instances) {
        String signature = instances.stream()
                .map(this::instanceKey)
                .sorted()
                .collect(Collectors.joining("|"));

        RingSnapshot snapshot = ringSnapshotRef.get();
        if (snapshot == null || !snapshot.getSignature().equals(signature)) {
            List<ConsistentHashRing.Node<ServiceInstance>> nodes = instances.stream()
                    .map(instance -> new ConsistentHashRing.Node<>(instanceKey(instance), instance))
                    .collect(Collectors.toList());
            snapshot = new RingSnapshot(signature, new ConsistentHashRing<>(nodes));
            ringSnapshotRef.set(snapshot);
            log.info("刷新NettyService一致性哈希环，节点: {}", signature);
        }
        return snapshot;
    }

    private String extractRouteKey(Request request) {
        if (!(request.getContext() instanceof RequestDataContext)) {
            return null;
        }
        RequestData requestData = ((RequestDataContext) request.getContext()).getClientRequest();
        if (requestData == null) {
            return null;
        }
        HttpHeaders headers = requestData.getHeaders();
        // 优先使用经过验签的 JWT subject，杜绝伪造 userUuid 头劫持他人的粘连节点。
        String token = headers.getFirst("token");
        if (token == null || token.trim().isEmpty()) {
            token = headers.getFirst(HttpHeaders.AUTHORIZATION);
        }
        String subject = GatewayJwtUtil.parseSubject(token);
        if (subject != null && !subject.trim().isEmpty()) {
            return subject;
        }
        // 退化：无有效令牌时才回退到 userUuid 头（仅用于无法携带令牌的客户端）。
        String userUuid = headers.getFirst("userUuid");
        if (userUuid != null && !userUuid.trim().isEmpty()) {
            return userUuid;
        }
        return null;
    }

    private String instanceKey(ServiceInstance instance) {
        return instance.getHost() + ":" + instance.getPort();
    }

    private static class RingSnapshot {
        private final String signature;
        private final ConsistentHashRing<ServiceInstance> ring;

        private RingSnapshot(String signature, ConsistentHashRing<ServiceInstance> ring) {
            this.signature = signature;
            this.ring = ring;
        }

        private String getSignature() {
            return signature;
        }

        private ConsistentHashRing<ServiceInstance> getRing() {
            return ring;
        }
    }
}
