package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.model.Friend;
import com.lou.messagingservice.service.FriendService;
import com.lou.messagingservice.mapper.FriendMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【friend(联系人表)】的数据库操作Service实现
* @createDate 2025-06-12 16:47:16
*/
@Service
public class FriendServiceImpl extends ServiceImpl<FriendMapper, Friend>
    implements FriendService{

}




