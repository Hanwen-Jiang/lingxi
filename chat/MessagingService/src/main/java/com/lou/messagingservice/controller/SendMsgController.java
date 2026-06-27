package com.lou.messagingservice.controller;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.security.RequestContext;
import com.lou.messagingservice.common.Result;
import com.lou.messagingservice.data.sendMsg.SendMsgRequest;
import com.lou.messagingservice.data.sendMsg.SendMsgResponse;
import com.lou.messagingservice.feign.ContactServiceFeign;
import com.lou.messagingservice.service.MessageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api")
public class SendMsgController {

    @Autowired
    private ContactServiceFeign contactServiceFeign;

    @Autowired
    private MessageService messageService;

    @GetMapping("/feign")
    public Result<?> getUser(){
        Result<?> user = contactServiceFeign.getUser();

        return Result.ok(user);
    }

    /**
     * 发消息(单/群)。item3:翻 chat-common 包络(code=0)+ 真实 HTTP + 操作人取 RequestContext。
     * 交接 S4:成功 {@code {code:0,data:SendMsgResponse{sessionId,messageId(string),type,sessionType,body,createdAt}}};
     * 越权 403、未认证 401(网关注入 X-User-Id,客户端只发 JWT 不回传身份)。
     */
    @PostMapping("/v1/chat/session")
    public com.lou.common.api.Result<SendMsgResponse> sendMsg(@RequestBody SendMsgRequest request) throws Exception {
        String currentUserId = RequestContext.requireUserId();
        if (!currentUserId.equals(String.valueOf(request.getSendUserId()))) {
            throw new ApiException(CommonError.FORBIDDEN, "无权代表他人发送消息");
        }
        SendMsgResponse response = messageService.sendMessage(request);
        return com.lou.common.api.Result.ok(response);
    }

    @GetMapping("/hello")
    public Result<?> get(){
//        Result<?> user = contactServiceFeign.getUser();

        return Result.ok("");
    }
}
