package com.lou.messagingservice.controller;

import com.lou.messagingservice.common.Result;
import com.lou.messagingservice.config.UserContext;
import com.lou.messagingservice.data.getRedPacket.RedPacketRequest;
import com.lou.messagingservice.data.getRedPacket.RedPacketResponse;
import com.lou.messagingservice.data.receviceRedPacket.ReceiveRedPacketRequest;
import com.lou.messagingservice.data.receviceRedPacket.ReceiveRedPacketResponse;
import com.lou.messagingservice.data.sendRedPacket.SendRedPacketRequest;
import com.lou.messagingservice.data.sendRedPacket.SendRedPacketResponse;
import com.lou.messagingservice.service.GetRedPacketService;
import com.lou.messagingservice.service.RedPacketReceiveService;
import com.lou.messagingservice.service.RedPacketService;
import com.lou.messagingservice.util.PreventDuplicateSubmit;
import lombok.SneakyThrows;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/chat/redPacket")
public class RedPacketController {


    @Autowired
    private RedPacketService redPacketService;

    @Autowired
    private RedPacketReceiveService redPacketReceiveService;

    @Autowired
    private GetRedPacketService getRedPacketService;

    @SneakyThrows
    @PreventDuplicateSubmit
    @PostMapping("/send")
    public Result<SendRedPacketResponse> sendRedPacket(@RequestBody SendRedPacketRequest request) {
        Long currentUserId = UserContext.get();
        if (currentUserId != null && !currentUserId.equals(request.getSendUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人发送红包");
        }
        SendRedPacketResponse response = redPacketService.sendRedPacket(request);

        return Result.ok(response);
    }

    @SneakyThrows
    @PostMapping("/receive")
    public Result<ReceiveRedPacketResponse> receiveRedPacket(@RequestBody ReceiveRedPacketRequest request) {
        Long currentUserId = UserContext.get();
        if (currentUserId != null && !currentUserId.equals(request.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权代表他人领取红包");
        }
        ReceiveRedPacketResponse response = redPacketReceiveService.receiveRedPacket(request.getUserId(), request.getRedPacketId());

        return Result.ok(response);
    }

    @GetMapping("/{redPacketId}")
    public Result<RedPacketResponse> getRedPacket(@ModelAttribute RedPacketRequest request) {
        RedPacketResponse response = getRedPacketService.getRedPacketDetails(request.getRedPacketId(), request.getPageNum(), request.getPageSize());
        return Result.ok(response);
    }
}
