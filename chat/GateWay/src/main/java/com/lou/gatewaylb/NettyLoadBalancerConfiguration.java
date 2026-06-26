package com.lou.gatewaylb;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.loadbalancer.core.ReactorLoadBalancer;
import org.springframework.cloud.loadbalancer.core.ServiceInstanceListSupplier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
public class NettyLoadBalancerConfiguration {

    @Bean
    public ReactorLoadBalancer<ServiceInstance> nettyConsistentHashLoadBalancer(
            Environment environment,
            ObjectProvider<ServiceInstanceListSupplier> serviceInstanceListSupplierProvider) {
        String serviceId = environment.getProperty("spring.cloud.loadbalancer.client.name", "NettyService");
        return new NettyConsistentHashLoadBalancer(serviceInstanceListSupplierProvider, serviceId);
    }
}
