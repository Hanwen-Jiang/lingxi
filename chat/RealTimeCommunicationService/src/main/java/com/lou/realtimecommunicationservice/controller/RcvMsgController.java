package com.lou.realtimecommunicationservice.controller;

import com.lou.realtimecommunicationservice.common.Result;
import com.lou.realtimecommunicationservice.data.ReceiveMessage.ReceiveMessageRequest;
import com.lou.realtimecommunicationservice.data.ReceiveMessage.ReceiveMessageResponse;
import com.lou.realtimecommunicationservice.service.RcvMsgService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

/**
 * @ClassName RcvMsgController
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 16:32
 */

@RestController
@RequestMapping("/api/v1/message")
@Slf4j
@RequiredArgsConstructor
public class RcvMsgController {

    @Autowired
    private RcvMsgService rcvMsgService;

    @PostMapping("/user")
    public Result<ReceiveMessageResponse> receiveMessage(@Valid @RequestBody ReceiveMessageRequest request) {
        ReceiveMessageResponse response = rcvMsgService.receiveMessage(request);

        return Result.ok(response);
    }
}
