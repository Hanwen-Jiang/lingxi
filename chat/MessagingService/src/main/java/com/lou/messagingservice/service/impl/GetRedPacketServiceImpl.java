package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.common.ServiceException;
import com.lou.messagingservice.data.getRedPacket.RedPacketResponse;
import com.lou.messagingservice.data.getRedPacket.RedPacketUser;
import com.lou.messagingservice.mapper.RedPacketMapper;
import com.lou.messagingservice.mapper.RedPacketReceiveMapper;
import com.lou.messagingservice.mapper.UserMapper;
import com.lou.messagingservice.model.RedPacket;
import com.lou.messagingservice.model.RedPacketReceive;
import com.lou.messagingservice.model.User;
import com.lou.messagingservice.service.GetRedPacketService;
import com.lou.messagingservice.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class GetRedPacketServiceImpl extends ServiceImpl<RedPacketMapper, RedPacket> implements GetRedPacketService {

    @Autowired
    private RedPacketReceiveMapper redPacketReceiveMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private UserService userService;

    @Override
    public RedPacketResponse getRedPacketDetails(Long redPacketId, Integer pageNum, Integer pageSize) {
        RedPacket redPacket = this.getById(redPacketId);
        if (redPacket == null) {
            throw new ServiceException("红包不存在");
        }

        List<RedPacketReceive> receives = redPacketReceiveMapper.selectByRedPacketId(redPacketId, (pageNum - 1) * pageSize, pageSize);
        List<RedPacketUser> userList = convertToUserList(receives);

        User sender = userService.getById(redPacket.getSenderId());

        return new RedPacketResponse(userList, sender.getUserName(), sender.getAvatar(), redPacket.getRedPacketWrapperText(),
                redPacket.getRedPacketType(), redPacket.getTotalAmount(), redPacket.getTotalCount(), redPacket.getRemainingAmount(), redPacket.getRemainingCount(), redPacket.getStatus());
    }

    private List<RedPacketUser> convertToUserList(List<RedPacketReceive> receives) {
        List<RedPacketUser> userList = new ArrayList<>();
        for (RedPacketReceive receive : receives) {
            User user = userMapper.selectById(receive.getReceiverId());
            userList.add(new RedPacketUser(user.getUserName(), user.getAvatar(), String.valueOf(receive.getReceivedAt()), receive.getAmount()));
        }
        return userList;
    }
}

