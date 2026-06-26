package com.lou.messagingservice.feign;

import com.lou.messagingservice.common.Result;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient("ContactService")
public interface ContactServiceFeign {

    @GetMapping("/api/v1/contact/user")
    Result<?> getUser();
}
