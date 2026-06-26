package com.lou.offlinedatastoreservice.controller;

import com.lou.offlinedatastoreservice.common.Result;
import com.lou.offlinedatastoreservice.config.UserContext;
import com.lou.offlinedatastoreservice.data.offlineMessage.OfflineMsgRequest;
import com.lou.offlinedatastoreservice.data.offlineMessage.OfflineMsgResponse;
import com.lou.offlinedatastoreservice.service.MessageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletResponse;
import javax.validation.Valid;
import java.util.Objects;

@Slf4j
@RestController
@RequestMapping("/api/v1/offline")
public class MessageController {

    @Autowired
    private MessageService messageService;

    @GetMapping("/message")
    public Result<OfflineMsgResponse> getOfflineMessage(@Valid OfflineMsgRequest request, HttpServletResponse httpResponse) {
        // 鉴权收敛: 请求体 userId 表示操作人本人，当可信用户ID存在时校验一致，不一致 403。
        Long currentUserId = UserContext.get();
        if (currentUserId != null && !Objects.equals(currentUserId, request.getUserId())) {
            httpResponse.setStatus(403);
            return Result.UserError(403, "无权访问他人离线消息");
        }

        OfflineMsgResponse response = messageService.getOfflineMessage(request);

        return Result.ok(response);
    }
}
