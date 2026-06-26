package com.lou.momentservice.service;

import com.lou.momentservice.model.Friend;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

/**
* @author Lou
* @description 针对表【friend(联系人表)】的数据库操作Service
* @createDate 2025-06-21 21:14:43
*/
public interface FriendService extends IService<Friend> {

    List<Long> getFriendIds(Long userId);

}
