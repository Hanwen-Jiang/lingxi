package com.lou.contactservice.service;

import com.lou.contactservice.data.ExitGroup.ExitGroupRequest;
import com.lou.contactservice.data.ExitGroup.ExitGroupResponse;

/**
 * 退出群聊服务接口
 */
public interface ExitGroupService {
    ExitGroupResponse exitGroup(ExitGroupRequest request);
}
