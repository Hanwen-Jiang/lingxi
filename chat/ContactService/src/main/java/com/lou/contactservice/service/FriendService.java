package com.lou.contactservice.service;

import com.lou.contactservice.data.BlockFriend.BlockFriendRequest;
import com.lou.contactservice.data.BlockFriend.BlockFriendResponse;
import com.lou.contactservice.data.DeleteFriend.DeleteFriendRequest;
import com.lou.contactservice.data.DeleteFriend.DeleteFriendResponse;
import com.lou.contactservice.data.FriendDetail.FriendDetailRequest;
import com.lou.contactservice.data.FriendDetail.FriendDetailResponse;
import com.lou.contactservice.data.ModifyApply.ModifyApplyResponse;
import com.lou.contactservice.data.SearchUser.SearchUserRequest;
import com.lou.contactservice.data.SearchUser.SearchUserResponse;
import com.lou.contactservice.model.Friend;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author Lou
 * @description 针对表【friend(联系人表)】的数据库操作Service
 * @createDate 2025-06-26 19:57:12
 */
public interface FriendService extends IService<Friend> {

    SearchUserResponse getUserDetails(SearchUserRequest request);

    DeleteFriendResponse deleteFriend(DeleteFriendRequest request);

    BlockFriendResponse blockFriend(BlockFriendRequest request);

    ModifyApplyResponse addFriend(Long userId, Long friendId) throws Exception;

    FriendDetailResponse getFriendDetails(FriendDetailRequest request);
}
