package com.lou.contactservice.service;

import com.lou.contactservice.data.AddFriend.AddFriendRequest;
import com.lou.contactservice.data.AddFriend.AddFriendResponse;
import com.lou.contactservice.data.ApplyList.ApplyListRequest;
import com.lou.contactservice.data.ApplyList.ApplyListResponse;
import com.lou.contactservice.data.ModifyApply.ModifyApplyRequest;
import com.lou.contactservice.data.ModifyApply.ModifyApplyResponse;
import com.lou.contactservice.data.UnreadApply.UnreadApplyRequest;
import com.lou.contactservice.data.UnreadApply.UnreadApplyResponse;
import com.lou.contactservice.model.ApplyFriend;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.ArrayList;

/**
 * @author Lou
 * @description 针对表【apply_friend(好友申请表)】的数据库操作Service
 * @createDate 2025-06-26 21:27:44
 */
public interface ApplyFriendService extends IService<ApplyFriend> {

    /**
     * 添加好友
     */
    AddFriendResponse addFriend(String userUuid, String receiveUserUuid, AddFriendRequest request) throws Exception;

    /**
     * 获取好友申请列表
     */
    ApplyListResponse getApplyList(ApplyListRequest request);

    UnreadApplyResponse getUnreadApply(UnreadApplyRequest request);

    ModifyApplyResponse modifyApply(ModifyApplyRequest request) throws Exception;

}
