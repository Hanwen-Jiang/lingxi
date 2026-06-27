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
import com.lou.contactservice.data.FriendList.FriendListItem;
import com.lou.contactservice.model.Friend;
import com.baomidou.mybatisplus.extension.service.IService;
import com.lou.common.api.PageResult;

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

    /**
     * 好友列表(游标分页,新客户端 API)。
     *
     * @param userId 当前认证用户(friend.user_id)
     * @param status 关系状态过滤(默认 1 好友)
     * @param cursor 不透明游标(base64 末条 friend.id),首页为 null
     * @param limit  每页条数(已由上层规整,默认 20 上限 100)
     */
    PageResult<FriendListItem> listFriends(Long userId, Integer status, String cursor, int limit);
}
