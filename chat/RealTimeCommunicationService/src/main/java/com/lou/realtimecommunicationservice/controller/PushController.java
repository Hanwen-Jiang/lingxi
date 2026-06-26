package com.lou.realtimecommunicationservice.controller;

import com.lou.realtimecommunicationservice.common.Result;
import com.lou.realtimecommunicationservice.data.ApplyFriend.FriendApplicationNotification;
import com.lou.realtimecommunicationservice.data.PushMoment.PushMomentRequest;
import com.lou.realtimecommunicationservice.data.PushSession.NewGroupSessionNotification;
import com.lou.realtimecommunicationservice.data.PushSession.NewSessionNotification;
import com.lou.realtimecommunicationservice.service.impl.NettyMessageService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

/**
 * @ClassName PushController
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/21 21:41
 */

@RestController
@RequestMapping("/api/v1/message/push")
@Slf4j
public class PushController {

    @Autowired
    private NettyMessageService nettyMessageService;

    @PostMapping("/moment")
    public Result<?> receiveNoticeMoment(@RequestBody PushMomentRequest request) {
        nettyMessageService.sendNoticeMoment(request);
        return Result.ok(null);
    }

    @PostMapping("/friendApplication/{userId}")
    public Result<?> pushFriendApplication(@PathVariable("userId") String userId,
                                           @RequestBody FriendApplicationNotification notification) {
        nettyMessageService.sendFriendApplicationNotification(notification, userId);
        return Result.ok("Friend application notification pushed.");
    }

    @PostMapping("/newSession/{userId}")
    public Result<?> pushNewSession(@PathVariable("userId") String userId
            , @RequestBody NewSessionNotification notification) {
        nettyMessageService.sendNewSessionNotification(notification, userId);

        return Result.ok("New session notification pushed");
    }

    @PostMapping("/newGroupSession/{userId}")
    public Result<?> pushNewGroupSession(
            @PathVariable("userId") String userId,
            @RequestBody NewGroupSessionNotification notification
    ) {
        nettyMessageService.sendNewGroupSessionNotification(notification, userId);
        return Result.ok("New Group session notification pushed.");
    }

}
