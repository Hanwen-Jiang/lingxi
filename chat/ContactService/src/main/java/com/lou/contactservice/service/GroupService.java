package com.lou.contactservice.service;

import com.lou.contactservice.data.inviteGroup.InviteGroupRequest;
import com.lou.contactservice.data.inviteGroup.InviteGroupResponse;

/**
 * 群聊邀请服务接口
 */
public interface GroupService {

    /**
     * 处理群聊邀请逻辑
     */
    InviteGroupResponse inviteGroup(InviteGroupRequest request) throws Exception;
}
