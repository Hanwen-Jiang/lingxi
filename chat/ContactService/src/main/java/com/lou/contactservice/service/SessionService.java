package com.lou.contactservice.service;

import com.lou.contactservice.data.CreateGroup.CreateGroupRequest;
import com.lou.contactservice.data.CreateGroup.CreateGroupResponse;
import com.lou.contactservice.model.Session;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author Lou
 * @description 针对表【session(会话表)】的数据库操作Service
 * @createDate 2025-06-28 14:30:15
 */
public interface SessionService extends IService<Session> {

    CreateGroupResponse createGroup(CreateGroupRequest request);
}
