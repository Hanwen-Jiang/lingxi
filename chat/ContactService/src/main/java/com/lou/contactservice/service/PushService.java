package com.lou.contactservice.service;


import com.lou.contactservice.data.AddFriend.FriendApplicationNotification;
import com.lou.contactservice.data.dto.push.NewGroupSessionNotification;
import com.lou.contactservice.data.dto.push.NewSessionNotification;

public interface PushService {

    /**
     * 推送好友申请
     *
     * @param userId
     * @param notification
     * @throws Exception
     */
    void pushNewApply(Long userId, FriendApplicationNotification notification) throws Exception;

    /**
     * 推送新群聊会话消息
     * @param userId
     * @param notification
     * @throws Exception
     */
    void pushGroupNewSession(Long userId, NewGroupSessionNotification notification) throws Exception;

    /**
     * 推送新会话消息
     * @param userId
     * @param notification
     * @throws Exception
     */
    void pushNewSession(Long userId, NewSessionNotification notification) throws Exception;

}